BEGIN;
SET LOCAL lock_timeout = '15s';

ALTER TABLE vales.centro_costo
    ADD COLUMN direccion text,
    ADD COLUMN latitud double precision,
    ADD COLUMN longitud double precision,
    ADD CONSTRAINT centro_costo_coordenadas_validas CHECK (
        (latitud IS NULL AND longitud IS NULL)
        OR (
            latitud IS NOT NULL AND longitud IS NOT NULL
            AND latitud BETWEEN -90 AND 90
            AND longitud BETWEEN -180 AND 180
        )
    );

-- Referencias ficticias para los centros físicos del catálogo de ejemplo.
UPDATE vales.centro_costo c
SET direccion = u.direccion, latitud = u.latitud, longitud = u.longitud
FROM (VALUES
    ('90211101', 'Camino de Servicio 120, sector Curumuy, Piura', -5.03364, -80.66832),
    ('90211212', 'Calle de los Pozos 220, Pachitea, Piura', -5.18877, -80.63744),
    ('90211213', 'Pasaje San Pedro 130, Piura', -5.19872, -80.65474),
    ('90211214', 'Calle de los Algarrobos 140, Piura', -5.17285, -80.63620),
    ('90211215', 'Calle de los Molinos 150, Piura', -5.18531, -80.63277),
    ('90212204', 'Calle Las Flores 204, Los Jazmines, Piura', -5.18051, -80.65691),
    ('90212205', 'Pasaje del Reservorio 205, Santa Rosa, Piura', -5.19015, -80.66226),
    ('90212211', 'Pasaje de la Estación 211, Piura', -5.17562, -80.63886),
    ('90321109', 'Calle del Canal 109, Catacaos', -5.26604, -80.68375)
) AS u(codigo, direccion, latitud, longitud)
WHERE c.cod_centro_costo = u.codigo;

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
                'codigo', c.cod_centro_costo,
                'nombre', c.descripcion,
                'localidad', l.nom_localidad,
                'direccion', c.direccion,
                'punto', CASE WHEN c.latitud IS NOT NULL THEN jsonb_build_object(
                    'latitud', c.latitud,
                    'longitud', c.longitud
                ) END
            ) ORDER BY c.descripcion)
            FROM centro_costo c LEFT JOIN localidad l ON l.id_localidad = c.cod_localidad
        ), '[]') ELSE '[]'::jsonb END
    );
END;
$$;

COMMIT;
