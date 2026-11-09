BEGIN;

CREATE OR REPLACE FUNCTION vales.consultar_vale_qr(p_actor integer, p_id_qr uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT (consultar_pdf_vale(p_actor, v.cod_zonal, v.codigo_vale) -
                CASE WHEN tiene_rol(p_actor, 'GRIFO', v.cod_zonal, v.cod_proveedor)
                     THEN 'dni_trabajador' ELSE '' END)
        || jsonb_build_object(
            'dni_filtrado_por_rol', true,
            'puede_atender', v.estado_vale = 1 AND tiene_rol(p_actor, 'GRIFO', v.cod_zonal, v.cod_proveedor),
            'factura_numero', f.serie || '-' || f.numero)
    FROM vales v
    LEFT JOIN factura f ON f.codigo_factura = v.codigo_factura
    WHERE v.id_qr = p_id_qr;
$$;

COMMIT;
