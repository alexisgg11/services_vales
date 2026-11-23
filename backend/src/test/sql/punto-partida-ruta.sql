\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = vales, pg_catalog;

DO $$
DECLARE
    jefe integer;
    operativo integer;
    trabajador_id integer;
    localidad_id text;
    vale_id bigint;
    fecha_vale date;
    datos jsonb;
    partida jsonb;
    guardada jsonb;
    actualizada jsonb;
    ruta_id bigint;
BEGIN
    SELECT id_usuario INTO STRICT jefe FROM usuario WHERE login = 'demo.jefe.piura';
    SELECT u.id_usuario, t.id_trabajador, t.cod_localidad
    INTO STRICT operativo, trabajador_id, localidad_id
    FROM usuario u JOIN trabajador t USING (id_trabajador)
    WHERE u.login = 'demo.operativo.piura';

    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(rutas_contexto(jefe, NULL)->'trabajadores') AS t
        WHERE t->>'id' = trabajador_id::text AND t->>'localidad' = localidad_id
    ) THEN
        RAISE EXCEPTION 'Falta la localidad del operativo en Jefatura';
    END IF;

    SELECT v.id_vale, v.fecha_emision INTO STRICT vale_id, fecha_vale
    FROM vales v
    WHERE v.registrado_por = operativo AND v.estado_vale = 0
        AND NOT EXISTS (SELECT 1 FROM vale_ruta vr WHERE vr.id_vale = v.id_vale)
    ORDER BY v.id_vale LIMIT 1;

    datos := jsonb_build_object(
        'nombre', 'Ruta de prueba de partida', 'cod_zonal', '01',
        'desde', fecha_vale, 'hasta', fecha_vale, 'trabajadores', ARRAY[trabajador_id],
        'paradas', '[{"nombre":"Primera visita","latitud":-5.19,"longitud":-80.63}]'::jsonb
    );
    partida := jsonb_build_object('latitud', -5.2, 'longitud', -80.62, 'localidad', localidad_id);
    guardada := guardar_ruta(jefe, NULL, datos || jsonb_build_object('origen', partida));
    ruta_id := (guardada->>'id')::bigint;
    IF guardada->'origen' IS DISTINCT FROM partida
        OR ruta_emision(operativo, ruta_id, fecha_vale)->'origen' IS DISTINCT FROM partida THEN
        RAISE EXCEPTION 'La partida guardada no coincide con la que recibe el operativo';
    END IF;

    BEGIN
        PERFORM guardar_ruta(jefe, ruta_id, datos || jsonb_build_object(
            'version', 1, 'origen', '{"latitud":91,"longitud":-80.62}'::jsonb
        ));
        RAISE EXCEPTION 'Se aceptaron coordenadas fuera del mapa';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;

    actualizada := guardar_ruta(jefe, ruta_id, datos || '{"version":1}'::jsonb);
    IF actualizada->'origen' IS DISTINCT FROM partida OR (actualizada->>'version')::integer <> 2 THEN
        RAISE EXCEPTION 'La edición sin origen perdió la partida anterior';
    END IF;
    PERFORM vincular_ruta_vale(operativo, vale_id, ruta_id, 2, NULL);

    actualizada := guardar_ruta(jefe, ruta_id, datos || '{
        "version":2, "origen":{"latitud":-5.17,"longitud":-80.61}
    }'::jsonb);
    IF actualizada->'origen' IS DISTINCT FROM '{"latitud":-5.17,"longitud":-80.61}'::jsonb
        OR ruta_del_vale(operativo, vale_id)->'origen' IS DISTINCT FROM partida THEN
        RAISE EXCEPTION 'El cambio de partida no conservó la copia del vale';
    END IF;
    RAISE NOTICE 'Partida, localidad, validación, edición compatible y copia del vale verificadas.';
END;
$$;

ROLLBACK;
