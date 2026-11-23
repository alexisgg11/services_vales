BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE TABLE vales.ruta_trabajo (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nombre varchar(120) NOT NULL CHECK (length(trim(nombre))>0),
 cod_zonal varchar(2) NOT NULL REFERENCES vales.zonal,
 desde date NOT NULL, hasta date NOT NULL,
 activa boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,
 creado_por integer NOT NULL REFERENCES vales.usuario,
 actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (isfinite(desde) AND isfinite(hasta) AND desde<=hasta)
);
CREATE TABLE vales.ruta_parada (
 ruta bigint NOT NULL REFERENCES vales.ruta_trabajo,
 orden integer NOT NULL CHECK (orden BETWEEN 1 AND 8),
 nombre varchar(150) NOT NULL CHECK (length(trim(nombre))>0),
 centro varchar(15) REFERENCES vales.centro_costo,
 latitud double precision NOT NULL CHECK (latitud BETWEEN -90 AND 90),
 longitud double precision NOT NULL CHECK (longitud BETWEEN -180 AND 180),
 PRIMARY KEY (ruta,orden)
);
CREATE TABLE vales.ruta_asignacion (
 ruta bigint NOT NULL REFERENCES vales.ruta_trabajo,
 trabajador integer NOT NULL REFERENCES vales.trabajador,
 PRIMARY KEY (ruta,trabajador)
);
CREATE INDEX ruta_asignacion_trabajador ON vales.ruta_asignacion(trabajador);
CREATE TABLE vales.vale_ruta (
 id_vale bigint PRIMARY KEY REFERENCES vales.vales,
 ruta bigint NOT NULL REFERENCES vales.ruta_trabajo,
 version integer NOT NULL,
 detalle jsonb NOT NULL,
 origen jsonb,
 registrado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION vales.ruta_json(p_id bigint) RETURNS jsonb LANGUAGE sql STABLE
 SET search_path=pg_catalog,vales,pg_temp AS $$
 SELECT to_jsonb(r)||jsonb_build_object('id',r.id::text,
  'paradas',coalesce((SELECT jsonb_agg(to_jsonb(p)-'ruta' ORDER BY p.orden) FROM ruta_parada p WHERE p.ruta=r.id),'[]'),
  'trabajadores',coalesce((SELECT jsonb_agg(a.trabajador ORDER BY a.trabajador) FROM ruta_asignacion a WHERE a.ruta=r.id),'[]'))
 FROM ruta_trabajo r WHERE r.id=p_id;
$$;

CREATE FUNCTION vales.rutas_contexto(p_actor integer,p_fecha date) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
DECLARE jefe boolean:=tiene_funcion(p_actor,'JEFE');
BEGIN
 IF NOT jefe AND NOT tiene_funcion(p_actor,'OPERATIVO') THEN
  RAISE EXCEPTION 'Solo Jefatura y Operativo pueden consultar rutas.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('rutas',coalesce((SELECT jsonb_agg(ruta_json(r.id) ORDER BY r.desde DESC,r.id DESC)
 FROM ruta_trabajo r WHERE (jefe AND tiene_rol(p_actor,'JEFE',r.cod_zonal)) OR
 (NOT jefe AND r.activa AND p_fecha BETWEEN r.desde AND r.hasta AND EXISTS
  (SELECT 1 FROM ruta_asignacion a JOIN usuario u ON u.id_trabajador=a.trabajador
   WHERE a.ruta=r.id AND u.id_usuario=p_actor AND tiene_rol(p_actor,'OPERATIVO',r.cod_zonal)))),'[]'),
 'trabajadores',CASE WHEN jefe THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id_trabajador,
  'nombre',concat_ws(' ',p.nombre,p.ap_paterno,p.ap_materno),'zonal',t.cod_zonal) ORDER BY p.nombre)
  FROM trabajador t JOIN persona p USING(dni) JOIN usuario u USING(id_trabajador)
  WHERE t.activo AND u.activo AND tiene_rol(u.id_usuario,'OPERATIVO',t.cod_zonal)
   AND tiene_rol(p_actor,'JEFE',t.cod_zonal)),'[]') ELSE '[]'::jsonb END,
 'centros',CASE WHEN jefe THEN coalesce((SELECT jsonb_agg(jsonb_build_object('codigo',c.cod_centro_costo,
 'nombre',c.descripcion,'localidad',l.nom_localidad) ORDER BY c.descripcion)
 FROM centro_costo c LEFT JOIN localidad l ON l.id_localidad=c.cod_localidad),'[]') ELSE '[]'::jsonb END);
END; $$;

CREATE FUNCTION vales.guardar_ruta(p_actor integer,p_id bigint,p_datos jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
DECLARE r ruta_trabajo; identificador bigint; p jsonb; t jsonb; n integer:=0;
 zona text:=p_datos->>'cod_zonal'; d date:=(p_datos->>'desde')::date; h date:=(p_datos->>'hasta')::date;
BEGIN
 IF NOT tiene_rol(p_actor,'JEFE',zona) THEN RAISE EXCEPTION 'Solo el jefe de la zonal puede gestionar sus rutas.' USING ERRCODE='42501'; END IF;
 IF coalesce(length(trim(p_datos->>'nombre')),0) NOT BETWEEN 1 AND 120 OR d IS NULL OR h IS NULL
 OR NOT isfinite(d) OR NOT isfinite(h) OR d>h
 OR jsonb_typeof(p_datos->'paradas') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_datos->'trabajadores') IS DISTINCT FROM 'array' THEN
 RAISE EXCEPTION 'Indica nombre, fechas, paradas y operativos válidos.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_datos->'paradas') NOT BETWEEN 1 AND 8
 OR jsonb_array_length(p_datos->'trabajadores') NOT BETWEEN 1 AND 100 THEN
 RAISE EXCEPTION 'Asigna al menos un operativo y entre una y ocho paradas.' USING ERRCODE='22023'; END IF;
 FOR t IN SELECT * FROM jsonb_array_elements(p_datos->'trabajadores') LOOP
 IF NOT EXISTS (SELECT 1 FROM trabajador w JOIN usuario u USING(id_trabajador)
 WHERE w.id_trabajador=t::text::integer AND w.activo AND w.cod_zonal=zona AND u.activo
 AND tiene_rol(u.id_usuario,'OPERATIVO',zona)) THEN
 RAISE EXCEPTION 'Los operativos deben estar activos y pertenecer a la zonal de la ruta.' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF p_id IS NULL THEN
 INSERT INTO ruta_trabajo(nombre,cod_zonal,desde,hasta,activa,creado_por)
 VALUES(trim(p_datos->>'nombre'),zona,d,h,coalesce((p_datos->>'activa')::boolean,true),p_actor) RETURNING id INTO identificador;
 ELSE
 SELECT * INTO r FROM ruta_trabajo WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT tiene_rol(p_actor,'JEFE',r.cod_zonal) THEN
 RAISE EXCEPTION 'No tienes acceso a esa ruta.' USING ERRCODE='42501'; END IF;
 IF r.version IS DISTINCT FROM (p_datos->>'version')::integer THEN
 RAISE EXCEPTION 'La ruta cambió. Actualiza la lista antes de guardar.' USING ERRCODE='22023'; END IF;
 identificador:=r.id;
 UPDATE ruta_trabajo SET nombre=trim(p_datos->>'nombre'),cod_zonal=zona,desde=d,hasta=h,
 activa=coalesce((p_datos->>'activa')::boolean,true),version=version+1,actualizado_en=clock_timestamp() WHERE id=identificador;
 DELETE FROM ruta_asignacion WHERE ruta=identificador;
 DELETE FROM ruta_parada WHERE ruta=identificador;
 END IF;
 FOR p IN SELECT * FROM jsonb_array_elements(p_datos->'paradas') LOOP
 n:=n+1;
 IF coalesce(length(trim(p->>'nombre')),0) NOT BETWEEN 1 AND 150
 OR p->>'latitud' IS NULL OR p->>'longitud' IS NULL THEN
 RAISE EXCEPTION 'Cada parada necesita un nombre y un punto en el mapa.' USING ERRCODE='22023'; END IF;
 INSERT INTO ruta_parada VALUES(identificador,n,trim(p->>'nombre'),nullif(p->>'centro',''),(p->>'latitud')::double precision,(p->>'longitud')::double precision);
 END LOOP;
 INSERT INTO ruta_asignacion SELECT identificador,(value::text)::integer FROM jsonb_array_elements(p_datos->'trabajadores');
 RETURN ruta_json(identificador);
END; $$;

CREATE FUNCTION vales.ruta_emision(p_actor integer,p_ruta bigint,p_fecha date) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM ruta_trabajo r JOIN ruta_asignacion a ON a.ruta=r.id
 JOIN usuario u ON u.id_trabajador=a.trabajador WHERE r.id=p_ruta AND u.id_usuario=p_actor
 AND r.activa AND p_fecha BETWEEN r.desde AND r.hasta AND tiene_rol(p_actor,'OPERATIVO',r.cod_zonal)) THEN
 RAISE EXCEPTION 'La ruta no está asignada al operativo o no está vigente en esa fecha.' USING ERRCODE='42501'; END IF;
 RETURN ruta_json(p_ruta);
END; $$;

CREATE FUNCTION vales.vincular_ruta_vale(p_actor integer,p_vale bigint,p_ruta bigint,p_version integer,p_origen jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
DECLARE v vales; detalle jsonb;
BEGIN
 SELECT * INTO v FROM vales WHERE id_vale=p_vale AND registrado_por=p_actor AND estado_vale=0;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se puede asignar la ruta a este vale.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM ruta_trabajo WHERE id=p_ruta FOR SHARE;
 detalle:=ruta_emision(p_actor,p_ruta,v.fecha_emision);
 IF (detalle->>'version')::integer IS DISTINCT FROM p_version THEN
 RAISE EXCEPTION 'La ruta cambió. Genera nuevamente la mejor opción.' USING ERRCODE='22023'; END IF;
 IF p_origen IS NOT NULL AND (NOT coalesce((p_origen->>'latitud')::double precision BETWEEN -90 AND 90,false)
 OR NOT coalesce((p_origen->>'longitud')::double precision BETWEEN -180 AND 180,false)) THEN
 RAISE EXCEPTION 'El origen no es válido.' USING ERRCODE='22023'; END IF;
 INSERT INTO vale_ruta(id_vale,ruta,version,detalle,origen) VALUES(p_vale,p_ruta,p_version,detalle,p_origen);
END; $$;

CREATE FUNCTION vales.ruta_del_vale(p_actor integer,p_vale bigint) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
DECLARE v vales;
BEGIN
 SELECT * INTO v FROM vales WHERE id_vale=p_vale;
 IF NOT FOUND OR NOT (v.registrado_por=p_actor OR tiene_rol(p_actor,'JEFE',v.cod_zonal)
 OR tiene_rol(p_actor,'GRIFO',v.cod_zonal,v.cod_proveedor) OR tiene_funcion(p_actor,'CONTABILIDAD') OR tiene_funcion(p_actor,'ADMIN')) THEN
 RAISE EXCEPTION 'No tienes acceso a este vale.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT detalle||jsonb_build_object('origen',origen) FROM vale_ruta WHERE id_vale=p_vale);
END; $$;
REVOKE ALL ON TABLE vales.ruta_trabajo,vales.ruta_parada,vales.ruta_asignacion,vales.vale_ruta FROM PUBLIC,vales_app;
REVOKE ALL ON FUNCTION vales.ruta_json(bigint),vales.rutas_contexto(integer,date),vales.guardar_ruta(integer,bigint,jsonb),
 vales.ruta_emision(integer,bigint,date),vales.vincular_ruta_vale(integer,bigint,bigint,integer,jsonb),vales.ruta_del_vale(integer,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.rutas_contexto(integer,date),vales.guardar_ruta(integer,bigint,jsonb),
 vales.ruta_emision(integer,bigint,date),vales.vincular_ruta_vale(integer,bigint,bigint,integer,jsonb),vales.ruta_del_vale(integer,bigint) TO vales_app;
COMMIT;
