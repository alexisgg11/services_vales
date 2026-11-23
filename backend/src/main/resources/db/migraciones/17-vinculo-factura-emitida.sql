BEGIN;
CREATE OR REPLACE FUNCTION vales.asociar_factura_desde_vales(p_actor integer,p_factura bigint,p_ids bigint[])
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,vales,pg_temp AS $$
DECLARE documento factura; tickets_factura varchar[]; tickets_vales varchar[];
BEGIN
    IF NOT tiene_rol(p_actor,'CONTABILIDAD') THEN
        RAISE EXCEPTION 'Solo Contabilidad puede asociar facturas.' USING ERRCODE='42501'; END IF;
    SELECT * INTO documento FROM factura WHERE codigo_factura=p_factura AND asociado_por IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La factura no existe o su asociación ya está cerrada.' USING ERRCODE='P0001'; END IF;
    SELECT array_agg(t.ticket ORDER BY t.ticket) INTO tickets_factura FROM factura_ticket t WHERE t.codigo_factura=p_factura;
    IF tickets_factura IS NULL THEN RAISE EXCEPTION 'La factura todavía no tiene tickets registrados por el grifo.' USING ERRCODE='P0001'; END IF;
    SELECT array_agg(v.ticket ORDER BY v.ticket) INTO tickets_vales FROM bloquear_vales(p_ids) v;
    IF tickets_factura IS DISTINCT FROM tickets_vales THEN
        RAISE EXCEPTION 'Los tickets de los vales seleccionados no coinciden con los de la factura.' USING ERRCODE='P0001'; END IF;
    IF EXISTS(SELECT 1 FROM emision_factura_vale e WHERE e.id_vale=ANY(p_ids) AND e.codigo_factura<>p_factura) THEN
        RAISE EXCEPTION 'Un ticket seleccionado ya pertenece a otra factura emitida por el grifo.' USING ERRCODE='P0001'; END IF;
    RETURN (asociar_factura(p_actor,p_factura,p_ids)).codigo_factura;
END;
$$;
COMMIT;
