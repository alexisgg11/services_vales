BEGIN;

CREATE OR REPLACE FUNCTION vales.consultar_gastos(p_actor integer, p_mes date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    inicio date;
    fin date;
    resultado jsonb;
BEGIN
    IF NOT tiene_rol(p_actor, 'CONTABILIDAD') THEN
        RAISE EXCEPTION 'Solo Contabilidad puede consultar gastos.' USING ERRCODE = '42501';
    END IF;
    IF p_mes IS NULL OR NOT isfinite(p_mes) THEN
        RAISE EXCEPTION 'Indica una fecha del mes que quieres consultar.' USING ERRCODE = '22023';
    END IF;
    inicio := date_trunc('month', p_mes::timestamp)::date;
    fin := (inicio + interval '1 month')::date;

    WITH consumos AS (
        SELECT v.id_vale, v.cod_zonal, v.codigo_vale, v.fecha_consumo, v.ticket, v.cantidad_consumida,
               v.importe, s.id_suministro, s.descripcion, v.codigo_factura, f.serie, f.numero, v.nrocontrato
        FROM vales v JOIN suministro s USING (id_suministro)
        JOIN factura f ON f.codigo_factura = v.codigo_factura
        WHERE v.estado_vale = 3 AND v.fecha_consumo >= inicio AND v.fecha_consumo < fin
    ), por_suministro AS (
        SELECT id_suministro, descripcion, sum(cantidad_consumida) AS cantidad, sum(importe) AS importe
        FROM consumos GROUP BY id_suministro, descripcion
    )
    SELECT jsonb_build_object(
        'mes', inicio,
        'cantidad_total', coalesce(sum(cantidad), 0),
        'importe_total', coalesce(sum(importe), 0),
        'por_suministro', coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id_suministro), '[]'::jsonb),
        'vales', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.fecha_consumo, c.id_vale), '[]'::jsonb)
                  FROM consumos c)
    ) INTO resultado FROM por_suministro p;
    RETURN resultado;
END;
$$;

COMMIT;
