BEGIN;

CREATE FUNCTION vales.verificar_vale_qr(p_id_qr uuid)
RETURNS TABLE (codigo text, grifo text, fecha_emision date, estado smallint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT v.codigo_vale::text, p.razon_social::text, v.fecha_emision, v.estado_vale
    FROM vales v
    JOIN proveedor p ON p.cod_proveedor = v.cod_proveedor
    WHERE v.id_qr = p_id_qr;
$$;

REVOKE ALL ON FUNCTION vales.verificar_vale_qr(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.verificar_vale_qr(uuid) TO vales_app;

COMMIT;
