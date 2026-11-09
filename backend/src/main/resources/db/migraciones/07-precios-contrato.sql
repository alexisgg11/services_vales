BEGIN;

CREATE OR REPLACE FUNCTION vales.contratos_vigentes_administracion(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    hoy date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date;
BEGIN
    IF NOT tiene_rol(p_actor, 'ADMIN') THEN
        RAISE EXCEPTION 'Solo Administrador puede consultar los precios de contrato.' USING ERRCODE = '42501';
    END IF;

    RETURN (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', c.cod_contrato, 'proveedor', c.ruc,
            'inicio', c.fecha_inicio, 'fin', c.fecha_fin,
            'precios', coalesce((
                SELECT jsonb_object_agg(s.id_suministro, s.precio_pactado)
                FROM contrato_suministro s WHERE s.cod_contrato = c.cod_contrato
            ), '{}')
        ) ORDER BY c.ruc, c.fecha_inicio, c.cod_contrato), '[]')
        FROM contrato_vale c
        WHERE c.activo AND hoy BETWEEN c.fecha_inicio AND c.fecha_fin
    );
END;
$$;

CREATE OR REPLACE FUNCTION vales.registrar_precio_contrato(p_actor integer, p_grifo text, p_contrato text,
                                                           p_suministro text, p_precio numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    hoy date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date;
BEGIN
    PERFORM bloquear_administracion(p_actor);
    PERFORM validar_magnitud(p_precio, 'El precio pactado');
    PERFORM 1 FROM contrato_vale
    WHERE cod_contrato = p_contrato AND ruc = p_grifo AND activo
      AND hoy BETWEEN fecha_inicio AND fecha_fin
    FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El contrato seleccionado debe estar vigente y pertenecer al proveedor.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM suministro WHERE id_suministro = p_suministro) THEN
        RAISE EXCEPTION 'Selecciona un combustible del catálogo.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO contrato_suministro (cod_contrato, id_suministro, precio_pactado)
    VALUES (p_contrato, p_suministro, p_precio)
    ON CONFLICT (cod_contrato, id_suministro) DO NOTHING;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Este combustible ya tiene un precio pactado en el contrato.' USING ERRCODE = '22023';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION vales.contratos_vigentes_administracion(integer),
    vales.registrar_precio_contrato(integer, text, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.contratos_vigentes_administracion(integer),
    vales.registrar_precio_contrato(integer, text, text, text, numeric) TO vales_app;

COMMIT;
