BEGIN;
SET LOCAL lock_timeout = '15s';

ALTER TABLE vales.ruta_trabajo
    ADD COLUMN origen_latitud double precision,
    ADD COLUMN origen_longitud double precision,
    ADD COLUMN origen_localidad varchar(2) REFERENCES vales.localidad,
    ADD CONSTRAINT ruta_trabajo_origen_valido CHECK (
        (origen_latitud IS NULL AND origen_longitud IS NULL AND origen_localidad IS NULL)
        OR (
            origen_latitud IS NOT NULL AND origen_longitud IS NOT NULL
            AND origen_latitud BETWEEN -90 AND 90
            AND origen_longitud BETWEEN -180 AND 180
        )
    );

CREATE OR REPLACE FUNCTION vales.ruta_json(p_id bigint) RETURNS jsonb LANGUAGE sql STABLE
SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT (to_jsonb(r) - ARRAY['origen_latitud', 'origen_longitud', 'origen_localidad'])
        || jsonb_build_object(
            'id', r.id::text,
            'origen', CASE WHEN r.origen_latitud IS NOT NULL THEN
                jsonb_strip_nulls(jsonb_build_object(
                    'latitud', r.origen_latitud,
                    'longitud', r.origen_longitud,
                    'localidad', r.origen_localidad
                ))
            END,
            'paradas', coalesce((
                SELECT jsonb_agg(to_jsonb(p) - 'ruta' ORDER BY p.orden)
                FROM ruta_parada p WHERE p.ruta = r.id
            ), '[]'),
            'trabajadores', coalesce((
                SELECT jsonb_agg(a.trabajador ORDER BY a.trabajador)
                FROM ruta_asignacion a WHERE a.ruta = r.id
            ), '[]')
        )
    FROM ruta_trabajo r WHERE r.id = p_id;
$$;

CREATE OR REPLACE FUNCTION vales.rutas_contexto(p_actor integer, p_fecha date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    jefe boolean := tiene_funcion(p_actor, 'JEFE');
BEGIN
    IF NOT jefe AND NOT tiene_funcion(p_actor, 'OPERATIVO') THEN
        RAISE EXCEPTION 'Solo Jefatura y Operativo pueden consultar rutas.' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'rutas', coalesce((
            SELECT jsonb_agg(ruta_json(r.id) ORDER BY r.desde DESC, r.id DESC)
            FROM ruta_trabajo r
            WHERE (jefe AND tiene_rol(p_actor, 'JEFE', r.cod_zonal))
                OR (NOT jefe AND r.activa AND p_fecha BETWEEN r.desde AND r.hasta AND EXISTS (
                    SELECT 1 FROM ruta_asignacion a
                    JOIN usuario u ON u.id_trabajador = a.trabajador
                    WHERE a.ruta = r.id AND u.id_usuario = p_actor
                        AND tiene_rol(p_actor, 'OPERATIVO', r.cod_zonal)
                ))
        ), '[]'),
        'trabajadores', CASE WHEN jefe THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', t.id_trabajador,
                'nombre', concat_ws(' ', p.nombre, p.ap_paterno, p.ap_materno),
                'zonal', t.cod_zonal,
                'localidad', t.cod_localidad
            ) ORDER BY p.nombre)
            FROM trabajador t JOIN persona p USING (dni) JOIN usuario u USING (id_trabajador)
            WHERE t.activo AND u.activo AND tiene_rol(u.id_usuario, 'OPERATIVO', t.cod_zonal)
                AND tiene_rol(p_actor, 'JEFE', t.cod_zonal)
        ), '[]') ELSE '[]'::jsonb END,
        'centros', CASE WHEN jefe THEN coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'codigo', c.cod_centro_costo, 'nombre', c.descripcion, 'localidad', l.nom_localidad
            ) ORDER BY c.descripcion)
            FROM centro_costo c LEFT JOIN localidad l ON l.id_localidad = c.cod_localidad
        ), '[]') ELSE '[]'::jsonb END
    );
END;
$$;

CREATE OR REPLACE FUNCTION vales.guardar_ruta(p_actor integer, p_id bigint, p_datos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    r ruta_trabajo;
    identificador bigint;
    p jsonb;
    t jsonb;
    n integer := 0;
    zona text := p_datos->>'cod_zonal';
    d date := (p_datos->>'desde')::date;
    h date := (p_datos->>'hasta')::date;
    partida jsonb := nullif(p_datos->'origen', 'null'::jsonb);
    partida_latitud double precision;
    partida_longitud double precision;
    partida_localidad text;
BEGIN
    IF NOT tiene_rol(p_actor, 'JEFE', zona) THEN
        RAISE EXCEPTION 'Solo el jefe de la zonal puede gestionar sus rutas.' USING ERRCODE = '42501';
    END IF;
    IF coalesce(length(trim(p_datos->>'nombre')), 0) NOT BETWEEN 1 AND 120 OR d IS NULL OR h IS NULL
        OR NOT isfinite(d) OR NOT isfinite(h) OR d > h
        OR jsonb_typeof(p_datos->'paradas') IS DISTINCT FROM 'array'
        OR jsonb_typeof(p_datos->'trabajadores') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Indica nombre, fechas, paradas y operativos válidos.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_datos->'paradas') NOT BETWEEN 1 AND 8
        OR jsonb_array_length(p_datos->'trabajadores') NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'Asigna al menos un operativo y entre una y ocho paradas.' USING ERRCODE = '22023';
    END IF;
    FOR t IN SELECT value FROM jsonb_array_elements(p_datos->'trabajadores') LOOP
        IF NOT EXISTS (
            SELECT 1 FROM trabajador w JOIN usuario u USING (id_trabajador)
            WHERE w.id_trabajador = t::text::integer AND w.activo AND w.cod_zonal = zona
                AND u.activo AND tiene_rol(u.id_usuario, 'OPERATIVO', zona)
        ) THEN
            RAISE EXCEPTION 'Los operativos deben estar activos y pertenecer a la zonal de la ruta.' USING ERRCODE = '22023';
        END IF;
    END LOOP;

    IF partida IS NOT NULL THEN
        IF jsonb_typeof(partida) IS DISTINCT FROM 'object'
            OR jsonb_typeof(partida->'latitud') IS DISTINCT FROM 'number'
            OR jsonb_typeof(partida->'longitud') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Indica un punto de partida válido en el mapa.' USING ERRCODE = '22023';
        END IF;
        IF (partida->>'latitud')::numeric NOT BETWEEN -90 AND 90
            OR (partida->>'longitud')::numeric NOT BETWEEN -180 AND 180 THEN
            RAISE EXCEPTION 'Indica un punto de partida válido en el mapa.' USING ERRCODE = '22023';
        END IF;
        partida_localidad := nullif(partida->>'localidad', '');
        IF partida_localidad IS NOT NULL AND (
            jsonb_typeof(partida->'localidad') IS DISTINCT FROM 'string'
            OR NOT EXISTS (SELECT 1 FROM localidad WHERE id_localidad = partida_localidad)
        ) THEN
            RAISE EXCEPTION 'Elige una localidad de partida válida.' USING ERRCODE = '22023';
        END IF;
        partida_latitud := (partida->>'latitud')::double precision;
        partida_longitud := (partida->>'longitud')::double precision;
    END IF;

    IF p_id IS NULL THEN
        INSERT INTO ruta_trabajo(nombre, cod_zonal, desde, hasta, activa, creado_por,
            origen_latitud, origen_longitud, origen_localidad)
        VALUES (trim(p_datos->>'nombre'), zona, d, h, coalesce((p_datos->>'activa')::boolean, true), p_actor,
            partida_latitud, partida_longitud, partida_localidad)
        RETURNING id INTO identificador;
    ELSE
        SELECT * INTO r FROM ruta_trabajo WHERE id = p_id FOR UPDATE;
        IF NOT FOUND OR NOT tiene_rol(p_actor, 'JEFE', r.cod_zonal) THEN
            RAISE EXCEPTION 'No tienes acceso a esa ruta.' USING ERRCODE = '42501';
        END IF;
        IF r.version IS DISTINCT FROM (p_datos->>'version')::integer THEN
            RAISE EXCEPTION 'La ruta cambió. Actualiza la lista antes de guardar.' USING ERRCODE = '22023';
        END IF;
        identificador := r.id;
        IF partida IS NULL THEN
            partida_latitud := r.origen_latitud;
            partida_longitud := r.origen_longitud;
            partida_localidad := r.origen_localidad;
        END IF;
        UPDATE ruta_trabajo
        SET nombre = trim(p_datos->>'nombre'), cod_zonal = zona, desde = d, hasta = h,
            activa = coalesce((p_datos->>'activa')::boolean, true), version = version + 1,
            actualizado_en = clock_timestamp(), origen_latitud = partida_latitud,
            origen_longitud = partida_longitud, origen_localidad = partida_localidad
        WHERE id = identificador;
        DELETE FROM ruta_asignacion WHERE ruta = identificador;
        DELETE FROM ruta_parada WHERE ruta = identificador;
    END IF;

    FOR p IN SELECT value FROM jsonb_array_elements(p_datos->'paradas') LOOP
        n := n + 1;
        IF coalesce(length(trim(p->>'nombre')), 0) NOT BETWEEN 1 AND 150
            OR p->>'latitud' IS NULL OR p->>'longitud' IS NULL THEN
            RAISE EXCEPTION 'Cada parada necesita un nombre y un punto en el mapa.' USING ERRCODE = '22023';
        END IF;
        INSERT INTO ruta_parada
        VALUES (identificador, n, trim(p->>'nombre'), nullif(p->>'centro', ''),
            (p->>'latitud')::double precision, (p->>'longitud')::double precision);
    END LOOP;
    INSERT INTO ruta_asignacion
    SELECT identificador, value::text::integer FROM jsonb_array_elements(p_datos->'trabajadores');
    RETURN ruta_json(identificador);
END;
$$;

CREATE OR REPLACE FUNCTION vales.vincular_ruta_vale(p_actor integer, p_vale bigint, p_ruta bigint, p_version integer, p_origen jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    v vales;
    detalle jsonb;
    origen_vale jsonb;
BEGIN
    SELECT * INTO v FROM vales WHERE id_vale = p_vale AND registrado_por = p_actor AND estado_vale = 0;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se puede asignar la ruta a este vale.' USING ERRCODE = '42501';
    END IF;
    PERFORM 1 FROM ruta_trabajo WHERE id = p_ruta FOR SHARE;
    detalle := ruta_emision(p_actor, p_ruta, v.fecha_emision);
    IF (detalle->>'version')::integer IS DISTINCT FROM p_version THEN
        RAISE EXCEPTION 'La ruta cambió. Genera nuevamente la mejor opción.' USING ERRCODE = '22023';
    END IF;
    origen_vale := coalesce(nullif(p_origen, 'null'::jsonb), nullif(detalle->'origen', 'null'::jsonb));
    IF origen_vale IS NOT NULL AND (
        NOT coalesce((origen_vale->>'latitud')::double precision BETWEEN -90 AND 90, false)
        OR NOT coalesce((origen_vale->>'longitud')::double precision BETWEEN -180 AND 180, false)
    ) THEN
        RAISE EXCEPTION 'El origen no es válido.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO vale_ruta(id_vale, ruta, version, detalle, origen)
    VALUES (p_vale, p_ruta, p_version, detalle, origen_vale);
END;
$$;

COMMIT;
