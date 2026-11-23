BEGIN;
SET LOCAL lock_timeout = '15s';

ALTER TABLE vales.ruta_parada
    DROP CONSTRAINT ruta_parada_orden_check,
    ADD CONSTRAINT ruta_parada_orden_check CHECK (orden BETWEEN 1 AND 15);

CREATE OR REPLACE FUNCTION vales.guardar_ruta(p_actor integer, p_id bigint, p_datos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    r ruta_trabajo;
    identificador bigint;
    p jsonb;
    t jsonb;
    n integer := 0;
    maximo_paradas CONSTANT integer := 15;
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
    IF jsonb_array_length(p_datos->'paradas') NOT BETWEEN 1 AND maximo_paradas
        OR jsonb_array_length(p_datos->'trabajadores') NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'Asigna al menos un operativo e indica de 1 a % paradas.', maximo_paradas
            USING ERRCODE = '22023';
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

COMMIT;
