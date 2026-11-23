BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE INDEX factura_ticket_proveedor_idx ON vales.factura_ticket (cod_proveedor, ticket);

CREATE FUNCTION vales.ticket_facturado(p_vale vales.vales)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT (p_vale).codigo_factura IS NOT NULL
        OR EXISTS (
            SELECT 1 FROM emision_factura_vale WHERE id_vale = (p_vale).id_vale
        )
        OR EXISTS (
            SELECT 1 FROM factura_ticket
            WHERE cod_proveedor = (p_vale).cod_proveedor AND ticket = (p_vale).ticket
        );
$$;
REVOKE ALL ON FUNCTION vales.ticket_facturado(vales.vales) FROM PUBLIC;

CREATE OR REPLACE FUNCTION vales.emitir_factura_grifo(
    p_actor integer, p_ids bigint[], p_solicitud uuid, p_fecha date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    grifo text;
    zona text;
    lista bigint[];
    anterior emision_factura;
    consecutivo bigint;
    identificador bigint;
    monto numeric;
    serie_grifo constant text := 'F001';
BEGIN
    SELECT r.cod_proveedor, r.cod_zonal INTO grifo, zona
    FROM usuario_rol r
    WHERE r.id_usuario = p_actor AND r.codigo_rol = 'GRIFO'
      AND tiene_rol(p_actor, 'GRIFO', r.cod_zonal, r.cod_proveedor);
    IF grifo IS NULL THEN
        RAISE EXCEPTION 'Solo el grifo puede emitir sus facturas.' USING ERRCODE = '42501';
    END IF;
    IF p_solicitud IS NULL OR coalesce(cardinality(p_ids), 0) NOT BETWEEN 1 AND 500 THEN
        RAISE EXCEPTION 'Selecciona entre 1 y 500 tickets.' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(id ORDER BY id) INTO lista FROM unnest(p_ids) AS ids(id);
    IF cardinality(lista) <> (SELECT count(DISTINCT id) FROM unnest(lista) AS ids(id)) THEN
        RAISE EXCEPTION 'La selección contiene tickets repetidos.' USING ERRCODE = '22023';
    END IF;

    -- El bloqueo por proveedor permite reintentar la misma emisión sin duplicarla.
    PERFORM 1 FROM proveedor WHERE cod_proveedor = grifo FOR UPDATE;
    SELECT * INTO anterior FROM emision_factura WHERE solicitud = p_solicitud;
    IF FOUND THEN
        IF anterior.emitido_por <> p_actor OR anterior.vales <> lista OR anterior.fecha IS DISTINCT FROM p_fecha THEN
            RAISE EXCEPTION 'La solicitud ya se utilizó con otros datos.' USING ERRCODE = '22023';
        END IF;
        RETURN (
            SELECT to_jsonb(f) || jsonb_build_object('numero_completo', f.serie || '-' || f.numero)
            FROM factura f WHERE f.codigo_factura = anterior.codigo_factura
        );
    END IF;
    IF p_fecha IS NULL OR NOT isfinite(p_fecha) OR p_fecha > (now() AT TIME ZONE 'America/Lima')::date THEN
        RAISE EXCEPTION 'La fecha de factura no puede ser futura.' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM bloquear_vales(lista);
    IF EXISTS (
        SELECT 1 FROM vales v
        WHERE v.id_vale = ANY(lista)
          AND (v.cod_proveedor <> grifo OR v.cod_zonal <> zona OR v.estado_vale <> 3
               OR v.fecha_consumo > p_fecha OR ticket_facturado(v))
    ) THEN
        RAISE EXCEPTION 'Los tickets deben ser atenciones del grifo y su zonal, sin facturar y anteriores a la factura.'
            USING ERRCODE = '22023';
    END IF;

    SELECT sum(importe) INTO monto FROM vales WHERE id_vale = ANY(lista);
    INSERT INTO correlativo_factura AS c VALUES (grifo, serie_grifo, 1)
    ON CONFLICT (cod_proveedor, serie) DO UPDATE SET ultimo = c.ultimo + 1
    WHERE c.ultimo < 999999999999999 RETURNING ultimo INTO consecutivo;
    IF consecutivo IS NULL THEN
        RAISE EXCEPTION 'Se agotó la numeración de facturas.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total)
    VALUES (grifo, serie_grifo, lpad(consecutivo::text, greatest(8, length(consecutivo::text)), '0'), p_fecha, monto)
    RETURNING codigo_factura INTO identificador;
    INSERT INTO emision_factura (codigo_factura, solicitud, emitido_por, vales, fecha)
    VALUES (identificador, p_solicitud, p_actor, lista, p_fecha);
    INSERT INTO emision_factura_vale SELECT id, identificador FROM unnest(lista) AS ids(id);
    INSERT INTO factura_ticket
    SELECT identificador, grifo, ticket FROM vales WHERE id_vale = ANY(lista);
    RETURN (
        SELECT to_jsonb(f) || jsonb_build_object('numero_completo', f.serie || '-' || f.numero)
        FROM factura f WHERE f.codigo_factura = identificador
    );
END;
$$;

CREATE OR REPLACE FUNCTION vales.facturacion_grifo(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    grifo text;
    zona text;
BEGIN
    SELECT r.cod_proveedor, r.cod_zonal INTO grifo, zona
    FROM usuario_rol r
    WHERE r.id_usuario = p_actor AND r.codigo_rol = 'GRIFO'
      AND tiene_rol(p_actor, 'GRIFO', r.cod_zonal, r.cod_proveedor);
    IF grifo IS NULL THEN
        RAISE EXCEPTION 'Solo el grifo puede consultar sus facturas.' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'serie', 'F001',
        'simulada', true,
        'pendientes', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', v.id_vale::text, 'codigo', v.codigo_vale, 'ticket', v.ticket,
                'fecha', v.fecha_consumo, 'importe', v.importe, 'cantidad', v.cantidad_consumida,
                'suministro', s.descripcion
            ) ORDER BY v.fecha_consumo, v.id_vale)
            FROM vales v JOIN suministro s USING (id_suministro)
            WHERE v.cod_proveedor = grifo AND v.cod_zonal = zona AND v.estado_vale = 3
              AND NOT ticket_facturado(v)
        ), '[]'),
        'facturas', coalesce((
            SELECT jsonb_agg(to_jsonb(f) || jsonb_build_object('tickets', (
                SELECT jsonb_agg(t.ticket ORDER BY t.ticket)
                FROM factura_ticket t WHERE t.codigo_factura = f.codigo_factura
            )) ORDER BY f.fecha_emision DESC, f.codigo_factura DESC)
            FROM factura f WHERE f.cod_proveedor = grifo
        ), '[]')
    );
END;
$$;

CREATE OR REPLACE FUNCTION vales.anular_vale(p_actor integer, p_id_vale bigint, p_motivo text)
RETURNS vales.vales LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    vale vales;
    motivo text := regexp_replace(p_motivo, '^[[:space:]]+|[[:space:]]+$', '', 'g');
BEGIN
    SELECT * INTO vale FROM vales WHERE id_vale = p_id_vale FOR UPDATE;
    IF NOT FOUND OR p_actor IS DISTINCT FROM vale.registrado_por
       OR NOT tiene_rol(p_actor, 'OPERATIVO', vale.cod_zonal) THEN
        RAISE EXCEPTION 'Solo el emisor habilitado puede anular su vale.' USING ERRCODE = '42501';
    END IF;
    IF vale.estado_vale NOT IN (0, 1) THEN
        RAISE EXCEPTION 'Solo se anulan vales emitidos o autorizados sin usar.' USING ERRCODE = 'P0001';
    END IF;
    IF coalesce(char_length(motivo), 0) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'Indica el motivo de anulación con hasta 1000 caracteres.' USING ERRCODE = '22023';
    END IF;

    IF vale.nrocontrato IS NOT NULL THEN
        UPDATE contrato_vale SET monto_comprometido = monto_comprometido - vale.importe_estimado
        WHERE cod_contrato = vale.nrocontrato;
    END IF;
    UPDATE vales SET estado_vale = 4, anulado_por = p_actor,
        fecha_anulacion = clock_timestamp(), observacion_anulacion = motivo
    WHERE id_vale = p_id_vale RETURNING * INTO vale;
    INSERT INTO historial_vale (id_vale, id_usuario, accion, fecha, detalle)
    VALUES (vale.id_vale, p_actor, 'ANULACION', vale.fecha_anulacion, jsonb_build_object('motivo', motivo));
    RETURN vale;
END;
$$;

-- La atención vigente usa registrar_atencion. Se conserva cualquier lectura histórica.
DROP FUNCTION vales.leer_surtidor_simulado(integer, bigint, date, numeric, text);
DROP FUNCTION vales.registrar_despacho(integer, bigint, date, numeric, numeric, numeric, text, boolean, uuid);

COMMIT;
