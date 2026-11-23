BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE FUNCTION vales.tiene_funcion(p_actor integer,p_rol text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,vales,pg_temp AS $$
    SELECT EXISTS(SELECT 1 FROM usuario u JOIN usuario_rol r USING(id_usuario)
                  WHERE u.id_usuario=p_actor AND u.activo AND r.codigo_rol=p_rol);
$$;
REVOKE ALL ON FUNCTION vales.tiene_funcion(integer,text) FROM PUBLIC;

CREATE TABLE vales.correlativo_factura (
    cod_proveedor varchar(11) REFERENCES vales.proveedor,
    serie varchar(8) NOT NULL,
    ultimo bigint NOT NULL CHECK (ultimo BETWEEN 0 AND 999999999999999),
    PRIMARY KEY (cod_proveedor, serie)
);
INSERT INTO vales.correlativo_factura
SELECT cod_proveedor, serie, max(numero::bigint) FROM vales.factura
WHERE numero ~ '^[0-9]{1,15}$' GROUP BY cod_proveedor, serie;

CREATE TABLE vales.emision_factura (
    codigo_factura bigint PRIMARY KEY REFERENCES vales.factura,
    solicitud uuid NOT NULL UNIQUE,
    emitido_por integer NOT NULL REFERENCES vales.usuario,
    emitido_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    vales bigint[] NOT NULL,
    fecha date NOT NULL
);
CREATE TABLE vales.emision_factura_vale (
    id_vale bigint PRIMARY KEY REFERENCES vales.vales,
    codigo_factura bigint NOT NULL REFERENCES vales.emision_factura
);
CREATE INDEX emision_factura_vale_factura ON vales.emision_factura_vale(codigo_factura);

CREATE FUNCTION vales.emitir_factura_grifo(p_actor integer, p_ids bigint[], p_solicitud uuid, p_fecha date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    grifo text; zona text; lista bigint[]; anterior emision_factura; consecutivo bigint;
    identificador bigint; monto numeric; serie_grifo constant text := 'F001';
BEGIN
    SELECT r.cod_proveedor, r.cod_zonal INTO grifo, zona FROM usuario_rol r
    WHERE r.id_usuario = p_actor AND r.codigo_rol = 'GRIFO'
      AND tiene_rol(p_actor, 'GRIFO', r.cod_zonal, r.cod_proveedor);
    IF grifo IS NULL THEN RAISE EXCEPTION 'Solo el grifo puede emitir sus facturas.' USING ERRCODE='42501'; END IF;
    IF p_solicitud IS NULL OR p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'Selecciona entre 1 y 500 tickets.' USING ERRCODE='22023'; END IF;
    SELECT array_agg(i ORDER BY i) INTO lista FROM unnest(p_ids) i;
    IF cardinality(lista) <> (SELECT count(DISTINCT i) FROM unnest(lista) i) THEN
        RAISE EXCEPTION 'La selección contiene tickets repetidos.' USING ERRCODE='22023'; END IF;
    -- Serialize numbering and idempotent retries for this supplier before locking vouchers.
    PERFORM 1 FROM proveedor WHERE cod_proveedor=grifo FOR UPDATE;
    SELECT * INTO anterior FROM emision_factura WHERE solicitud=p_solicitud;
    IF FOUND THEN
        IF anterior.emitido_por<>p_actor OR anterior.vales<>lista OR anterior.fecha IS DISTINCT FROM p_fecha THEN
            RAISE EXCEPTION 'La solicitud ya se utilizó con otros datos.' USING ERRCODE='22023'; END IF;
        RETURN (SELECT to_jsonb(f) || jsonb_build_object('numero_completo',f.serie||'-'||f.numero)
                FROM factura f WHERE f.codigo_factura=anterior.codigo_factura);
    END IF;
    IF p_fecha IS NULL OR NOT isfinite(p_fecha) OR p_fecha > (now() AT TIME ZONE 'America/Lima')::date THEN
        RAISE EXCEPTION 'La fecha de factura no puede ser futura.' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM bloquear_vales(lista);
    IF (SELECT count(*) FROM vales WHERE id_vale=ANY(lista))<>cardinality(lista)
       OR EXISTS (SELECT 1 FROM vales v WHERE v.id_vale=ANY(lista) AND
          (v.cod_proveedor<>grifo OR v.cod_zonal<>zona OR v.estado_vale<>3 OR v.ticket IS NULL
           OR v.codigo_factura IS NOT NULL OR v.fecha_consumo>p_fecha))
       OR EXISTS (SELECT 1 FROM emision_factura_vale WHERE id_vale=ANY(lista)) THEN
        RAISE EXCEPTION 'Los tickets deben ser atenciones del grifo y su zonal, sin facturar y anteriores a la factura.' USING ERRCODE='22023';
    END IF;
    SELECT sum(importe) INTO monto FROM vales WHERE id_vale=ANY(lista);
    INSERT INTO correlativo_factura AS c VALUES (grifo,serie_grifo,1)
    ON CONFLICT (cod_proveedor,serie) DO UPDATE SET ultimo=c.ultimo+1
    WHERE c.ultimo<999999999999999 RETURNING ultimo INTO consecutivo;
    IF consecutivo IS NULL THEN RAISE EXCEPTION 'Se agotó la numeración de facturas.' USING ERRCODE='22023'; END IF;
    INSERT INTO factura(cod_proveedor,serie,numero,fecha_emision,total)
    VALUES(grifo,serie_grifo,lpad(consecutivo::text,greatest(8,length(consecutivo::text)),'0'),p_fecha,monto)
    RETURNING codigo_factura INTO identificador;
    INSERT INTO emision_factura(codigo_factura,solicitud,emitido_por,vales,fecha)
    VALUES(identificador,p_solicitud,p_actor,lista,p_fecha);
    INSERT INTO emision_factura_vale SELECT i,identificador FROM unnest(lista) i;
    INSERT INTO factura_ticket SELECT identificador,grifo,ticket FROM vales WHERE id_vale=ANY(lista);
    RETURN (SELECT to_jsonb(f)||jsonb_build_object('numero_completo',f.serie||'-'||f.numero)
            FROM factura f WHERE f.codigo_factura=identificador);
END;
$$;

CREATE FUNCTION vales.facturacion_grifo(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE grifo text; zona text;
BEGIN
    SELECT r.cod_proveedor,r.cod_zonal INTO grifo,zona FROM usuario_rol r WHERE r.id_usuario=p_actor
       AND r.codigo_rol='GRIFO' AND tiene_rol(p_actor,'GRIFO',r.cod_zonal,r.cod_proveedor);
    IF grifo IS NULL THEN RAISE EXCEPTION 'Solo el grifo puede consultar sus facturas.' USING ERRCODE='42501'; END IF;
    RETURN jsonb_build_object(
      'serie','F001', 'simulada',true,
      'pendientes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id_vale::text,'codigo',v.codigo_vale,
          'ticket',v.ticket,'fecha',v.fecha_consumo,'importe',v.importe,'cantidad',v.cantidad_consumida,
          'suministro',s.descripcion) ORDER BY v.fecha_consumo,v.id_vale)
          FROM vales v JOIN suministro s USING(id_suministro)
          WHERE v.cod_proveedor=grifo AND v.cod_zonal=zona AND v.estado_vale=3 AND v.codigo_factura IS NULL
          AND NOT EXISTS(SELECT 1 FROM emision_factura_vale e WHERE e.id_vale=v.id_vale)),'[]'),
      'facturas',coalesce((SELECT jsonb_agg(to_jsonb(f)||jsonb_build_object('tickets',
          (SELECT jsonb_agg(t.ticket ORDER BY t.ticket) FROM factura_ticket t WHERE t.codigo_factura=f.codigo_factura))
          ORDER BY f.fecha_emision DESC,f.codigo_factura DESC) FROM factura f WHERE f.cod_proveedor=grifo),'[]')
    );
END;
$$;

CREATE FUNCTION vales.identidad_local(p_actor integer,p_documento text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog,vales,pg_temp AS $$
DECLARE resultado jsonb;
BEGIN
    IF NOT (tiene_funcion(p_actor,'OPERATIVO') OR tiene_funcion(p_actor,'GRIFO')) THEN
        RAISE EXCEPTION 'El perfil no puede consultar documentos.' USING ERRCODE='42501'; END IF;
    IF p_documento !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'Indica un DNI de ocho dígitos.' USING ERRCODE='22023'; END IF;
    SELECT jsonb_build_object('documento',dni,'nombre',concat_ws(' ',nombre,ap_paterno,ap_materno),'origen','Catálogo local')
    INTO resultado FROM persona WHERE dni=p_documento;
    IF resultado IS NULL THEN
        SELECT jsonb_build_object('documento',documento,'nombre',nombre,'origen','Catálogo local')
        INTO resultado FROM tercero WHERE documento=p_documento;
    END IF;
    RETURN resultado;
END;
$$;
CREATE FUNCTION vales.registrar_tercero_identificado(p_actor integer,p_documento text,p_nombre text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,vales,pg_temp AS $$
DECLARE identificador integer;
BEGIN
    IF NOT tiene_funcion(p_actor,'OPERATIVO') THEN RAISE EXCEPTION 'Solo Operativo puede registrar un tercero.' USING ERRCODE='42501'; END IF;
    IF p_documento !~ '^[0-9]{8}$' OR length(btrim(p_nombre)) NOT BETWEEN 3 AND 150 THEN
        RAISE EXCEPTION 'Los datos del tercero no son válidos.' USING ERRCODE='22023'; END IF;
    INSERT INTO tercero(documento,nombre) VALUES(p_documento,btrim(p_nombre)) ON CONFLICT(documento) DO NOTHING;
    SELECT codigo_tercero INTO identificador FROM tercero WHERE documento=p_documento;
    RETURN identificador;
END;
$$;

CREATE TABLE vales.ubicacion_grifo (
    cod_proveedor varchar(11) PRIMARY KEY REFERENCES vales.proveedor,
    latitud numeric(9,6) NOT NULL CHECK(latitud BETWEEN -90 AND 90),
    longitud numeric(9,6) NOT NULL CHECK(longitud BETWEEN -180 AND 180),
    demostracion boolean NOT NULL DEFAULT false
);
-- Coordinates are fictitious test points, never assigned to real suppliers.
INSERT INTO vales.ubicacion_grifo
SELECT p.cod_proveedor,d.lat,d.lon,true FROM vales.proveedor p JOIN (VALUES
 ('20000000001',-5.194490,-80.632820),('20000000002',-4.890000,-80.680000),
 ('20000000004',-5.090000,-81.110000),('20000000005',-4.580000,-81.270000),
 ('20000000006',-5.180000,-80.610000)) d(id,lat,lon) ON p.cod_proveedor=d.id
WHERE p.razon_social ILIKE '%demo%';

CREATE FUNCTION vales.ubicaciones_emision(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
BEGIN
    IF NOT tiene_funcion(p_actor,'OPERATIVO') THEN RAISE EXCEPTION 'Solo Operativo puede comparar grifos.' USING ERRCODE='42501'; END IF;
    RETURN coalesce((SELECT jsonb_agg(to_jsonb(u)) FROM ubicacion_grifo u),'[]');
END;
$$;
CREATE FUNCTION vales.resumen_presupuesto(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
BEGIN
    IF NOT (tiene_rol(p_actor,'CONTABILIDAD') OR tiene_rol(p_actor,'ADMIN')) THEN
       RAISE EXCEPTION 'Solo Contabilidad o Administrador pueden consultar presupuestos.' USING ERRCODE='42501'; END IF;
    RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('contrato',c.cod_contrato,'grifo',p.razon_social,
        'total',c.monto_total,'comprometido',c.monto_comprometido,'disponible',c.monto_disponible,
        'desde',c.fecha_inicio,'hasta',c.fecha_fin,'activo',c.activo,
        'precios',(SELECT jsonb_object_agg(s.id_suministro,s.precio_pactado) FROM contrato_suministro s WHERE s.cod_contrato=c.cod_contrato)))
        FROM contrato_vale c JOIN proveedor p ON p.cod_proveedor=c.ruc),'[]');
END;
$$;

CREATE OR REPLACE FUNCTION vales.habilitar_unidad(p_actor integer,p_unidad integer,p_zonal text,p_centro text,p_desde date,p_hasta date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
DECLARE base text;
BEGIN
    SELECT cod_zonal INTO base FROM unidad_maquinaria WHERE codigo=p_unidad FOR SHARE;
    IF NOT tiene_rol(p_actor,'JEFE',base) AND NOT tiene_rol(p_actor,'ADMIN') THEN
        RAISE EXCEPTION 'El préstamo requiere al jefe de la zonal base de la unidad.' USING ERRCODE='42501'; END IF;
    IF base IS NULL OR base=p_zonal OR NOT EXISTS(SELECT 1 FROM zonal WHERE id_zona=p_zonal)
       OR NOT EXISTS(SELECT 1 FROM centro_costo WHERE cod_centro_costo=p_centro)
       OR p_desde IS NULL OR p_hasta IS NULL OR NOT isfinite(p_desde) OR NOT isfinite(p_hasta) OR p_desde>p_hasta THEN
        RAISE EXCEPTION 'Selecciona otra zonal, un trabajo y fechas válidas.' USING ERRCODE='22023'; END IF;
    INSERT INTO habilitacion_unidad VALUES(p_unidad,p_zonal,p_centro,p_desde,p_hasta,p_actor)
    ON CONFLICT(codigo_unidad,cod_zonal,cod_centro_costo,desde) DO UPDATE SET hasta=excluded.hasta,habilitado_por=excluded.habilitado_por;
END;
$$;

CREATE FUNCTION vales.unidades_jefatura(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
BEGIN
    IF NOT tiene_funcion(p_actor,'JEFE') THEN RAISE EXCEPTION 'Solo Jefatura puede consultar préstamos.' USING ERRCODE='42501'; END IF;
    RETURN jsonb_build_object('unidades',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM unidad_maquinaria m
      WHERE tiene_rol(p_actor,'JEFE',m.cod_zonal)),'[]'),
      'centros',(SELECT jsonb_agg(to_jsonb(c)) FROM centro_costo c),
      'habilitaciones',coalesce((SELECT jsonb_agg(to_jsonb(h)) FROM habilitacion_unidad h JOIN unidad_maquinaria m ON m.codigo=h.codigo_unidad
      WHERE tiene_rol(p_actor,'JEFE',m.cod_zonal)),'[]'));
END;
$$;

REVOKE ALL ON FUNCTION vales.emitir_factura_grifo(integer,bigint[],uuid,date),vales.facturacion_grifo(integer),
    vales.identidad_local(integer,text),vales.registrar_tercero_identificado(integer,text,text),
    vales.ubicaciones_emision(integer),vales.resumen_presupuesto(integer),vales.unidades_jefatura(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.emitir_factura_grifo(integer,bigint[],uuid,date),vales.facturacion_grifo(integer),
    vales.identidad_local(integer,text),vales.registrar_tercero_identificado(integer,text,text),
    vales.ubicaciones_emision(integer),vales.resumen_presupuesto(integer),vales.unidades_jefatura(integer) TO vales_app;
COMMIT;
