BEGIN;

CREATE OR REPLACE FUNCTION vales.registrar_atencion(p_actor integer, p_id_vale bigint, p_fecha date,
                                   p_consumido numeric, p_precio_real numeric DEFAULT NULL,
                                   p_confirmar_cambio_de numeric DEFAULT NULL,
                                   p_dni_presentado text DEFAULT NULL,
                                   p_identidad_verificada boolean DEFAULT false)
RETURNS vales.vales LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    vale vales;
    sugerido numeric;
    fuente text;
    aplicado numeric;
    dni_vale text;
    identidad_de text;
    consecutivo bigint;
BEGIN
    SELECT * INTO vale FROM vales WHERE id_vale = p_id_vale FOR UPDATE;
    SELECT s.precio, s.fuente INTO sugerido, fuente FROM sugerir_precio_atencion(p_actor, p_id_vale, p_fecha) s;
    PERFORM validar_magnitud(p_consumido, 'La cantidad consumida');
    IF p_consumido > vale.cantidad_emitida THEN
        RAISE EXCEPTION 'El consumo supera los galones autorizados.' USING ERRCODE = '22023';
    END IF;

    aplicado := coalesce(p_precio_real, sugerido);
    PERFORM validar_magnitud(aplicado, 'El precio real');
    IF aplicado <> sugerido AND p_confirmar_cambio_de IS DISTINCT FROM sugerido THEN
        RAISE EXCEPTION 'Confirma la modificación del precio sugerido.' USING ERRCODE = 'P0001',
            DETAIL = format('Sugerido: %s. Real: %s.', sugerido, aplicado);
    END IF;

    PERFORM validar_magnitud(round(p_consumido * aplicado, 2), 'El importe real');

    IF vale.codigo_tercero IS NOT NULL THEN
        identidad_de := 'tercero';
        SELECT t.documento INTO dni_vale FROM tercero t WHERE t.codigo_tercero = vale.codigo_tercero FOR SHARE;
        IF dni_vale IS NULL OR dni_vale !~ '^[0-9]{8}$' THEN
            RAISE EXCEPTION 'El tercero del vale necesita un DNI registrado de ocho dígitos.' USING ERRCODE = '22023';
        END IF;
    ELSE
        identidad_de := 'trabajador';
        SELECT t.dni INTO dni_vale FROM trabajador t WHERE t.id_trabajador = vale.id_trabajador FOR SHARE;
    END IF;
    IF p_identidad_verificada IS NOT TRUE OR btrim(p_dni_presentado) IS DISTINCT FROM dni_vale THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
            MESSAGE = format('Verifica el documento original del %s indicado en el vale.', identidad_de);
    END IF;

    IF vale.nrocontrato IS NOT NULL THEN
        UPDATE contrato_vale
        SET monto_comprometido = monto_comprometido - vale.importe_estimado + round(p_consumido * aplicado, 2)
        WHERE cod_contrato = vale.nrocontrato;
    END IF;

    INSERT INTO correlativo_ticket AS c (cod_proveedor, ultimo)
    VALUES (vale.cod_proveedor, 1)
    ON CONFLICT (cod_proveedor) DO UPDATE SET ultimo = c.ultimo + 1 WHERE c.ultimo < 99999999999999
    RETURNING ultimo INTO consecutivo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El grifo agotó los números de ticket disponibles.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE vales SET estado_vale = 3, fecha_consumo = p_fecha, cantidad_consumida = p_consumido,
        precio_sugerido = sugerido, fuente_precio = fuente, precio_real = aplicado,
        ticket = 'T' || lpad(consecutivo::text, 14, '0'), atendido_por = p_actor,
        registrado_atencion_en = clock_timestamp()
    WHERE id_vale = p_id_vale RETURNING * INTO vale;
    INSERT INTO historial_vale (id_vale, id_usuario, accion, fecha, detalle)
    VALUES (vale.id_vale, p_actor, 'ATENCION', vale.registrado_atencion_en,
        jsonb_build_object('precio_sugerido', sugerido, 'precio_real', aplicado, 'fuente_precio', fuente,
            'ticket', vale.ticket, 'identidad_verificada', true, 'identidad_de', identidad_de));
    RETURN vale;
END;
$$;

COMMIT;
