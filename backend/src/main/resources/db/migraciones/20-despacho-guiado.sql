BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE TABLE vales.lectura_surtidor_simulado (
    id_vale bigint PRIMARY KEY REFERENCES vales.vales,
    operacion uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    generado_por integer NOT NULL REFERENCES vales.usuario,
    fecha date NOT NULL,
    cantidad numeric(14,2) NOT NULL CHECK (cantidad > 0),
    precio numeric(14,2) NOT NULL CHECK (precio > 0),
    generado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE vales.vales
    ADD COLUMN operacion_surtidor uuid UNIQUE REFERENCES vales.lectura_surtidor_simulado(operacion),
    ADD CONSTRAINT vales_surtidor_atendido CHECK (operacion_surtidor IS NULL OR estado_vale = 3);

CREATE FUNCTION vales.validar_dni_atencion(p_actor integer, p_id_vale bigint, p_dni text)
RETURNS TABLE(nombre text, tipo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    vale vales.vales;
    documento_presentado text := btrim(p_dni);
BEGIN
    SELECT v.* INTO vale FROM vales.vales v WHERE v.id_vale = p_id_vale;
    IF NOT FOUND OR NOT tiene_rol(p_actor, 'GRIFO', vale.cod_zonal, vale.cod_proveedor) THEN
        RAISE EXCEPTION 'El vale debe corresponder al grifo y la zonal del usuario.' USING ERRCODE = '42501';
    END IF;
    IF vale.estado_vale <> 1 THEN
        RAISE EXCEPTION 'Solo se atienden vales autorizados.' USING ERRCODE = 'P0001';
    END IF;
    IF documento_presentado IS NULL OR documento_presentado !~ '^[0-9]{8}$' THEN
        RAISE EXCEPTION 'Indica el DNI de ocho dígitos del documento presentado.' USING ERRCODE = '22023';
    END IF;

    IF vale.codigo_tercero IS NOT NULL THEN
        tipo := 'TERCERO';
        SELECT t.nombre INTO nombre FROM tercero t
        WHERE t.codigo_tercero = vale.codigo_tercero AND t.documento = documento_presentado;
    ELSE
        tipo := 'TRABAJADOR';
        SELECT concat_ws(' ', p.nombre, p.ap_paterno, p.ap_materno)
        INTO nombre
        FROM trabajador t JOIN persona p USING (dni)
        WHERE t.id_trabajador = vale.id_trabajador AND p.dni = documento_presentado;
    END IF;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El DNI presentado no coincide con la persona indicada en este vale.' USING ERRCODE = '22023';
    END IF;
    RETURN NEXT;
END;
$$;

CREATE FUNCTION vales.leer_surtidor_simulado(
    p_actor integer, p_id_vale bigint, p_fecha date, p_cantidad numeric, p_dni text
)
RETURNS TABLE(operacion uuid, cantidad numeric, precio numeric)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    limite numeric;
    precio_actual numeric;
BEGIN
    PERFORM validar_dni_atencion(p_actor, p_id_vale, p_dni);
    SELECT v.cantidad_emitida INTO STRICT limite FROM vales.vales v
    WHERE v.id_vale = p_id_vale FOR UPDATE;
    SELECT s.precio INTO STRICT precio_actual FROM sugerir_precio_atencion(p_actor, p_id_vale, p_fecha) s;
    PERFORM validar_magnitud(p_cantidad, 'Los galones simulados');
    IF p_cantidad > limite THEN
        RAISE EXCEPTION 'La lectura supera los galones autorizados.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO lectura_surtidor_simulado AS l (id_vale, generado_por, fecha, cantidad, precio)
    VALUES (p_id_vale, p_actor, p_fecha, p_cantidad, precio_actual)
    ON CONFLICT ON CONSTRAINT lectura_surtidor_simulado_pkey DO UPDATE
    SET operacion = gen_random_uuid(), generado_por = excluded.generado_por,
        fecha = excluded.fecha, cantidad = excluded.cantidad, precio = excluded.precio,
        generado_en = clock_timestamp()
    RETURNING l.operacion, l.cantidad, l.precio INTO operacion, cantidad, precio;
    RETURN NEXT;
END;
$$;

CREATE FUNCTION vales.registrar_despacho(
    p_actor integer, p_id_vale bigint, p_fecha date, p_cantidad numeric,
    p_precio numeric, p_confirmado numeric, p_dni text, p_identidad boolean, p_operacion uuid
)
RETURNS vales.vales
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    lectura lectura_surtidor_simulado;
    atendido vales.vales;
BEGIN
    IF p_operacion IS NULL THEN
        RETURN registrar_atencion(p_actor, p_id_vale, p_fecha, p_cantidad, p_precio, p_confirmado, p_dni, p_identidad);
    END IF;

    PERFORM sugerir_precio_atencion(p_actor, p_id_vale, p_fecha);
    PERFORM 1 FROM vales.vales v WHERE v.id_vale = p_id_vale FOR UPDATE;
    SELECT l.* INTO lectura FROM lectura_surtidor_simulado l
    WHERE l.id_vale = p_id_vale AND l.operacion = p_operacion AND l.generado_por = p_actor;
    IF NOT FOUND OR lectura.fecha IS DISTINCT FROM p_fecha
        OR lectura.cantidad IS DISTINCT FROM p_cantidad OR lectura.precio IS DISTINCT FROM p_precio THEN
        RAISE EXCEPTION 'La lectura del surtidor cambió. Importa la lectura del vale antes de confirmar.' USING ERRCODE = '22023';
    END IF;

    atendido := registrar_atencion(p_actor, p_id_vale, p_fecha, p_cantidad, p_precio, p_confirmado, p_dni, p_identidad);
    UPDATE vales.vales v SET operacion_surtidor = p_operacion
    WHERE v.id_vale = p_id_vale RETURNING v.* INTO atendido;
    UPDATE historial_vale
    SET detalle = detalle || jsonb_build_object('operacion_surtidor', p_operacion, 'fuente_consumo', 'SURTIDOR_SIMULADO')
    WHERE id_vale = p_id_vale AND accion = 'ATENCION';
    RETURN atendido;
END;
$$;

REVOKE ALL ON TABLE vales.lectura_surtidor_simulado FROM PUBLIC, vales_app;
REVOKE ALL ON FUNCTION vales.validar_dni_atencion(integer,bigint,text),
    vales.leer_surtidor_simulado(integer,bigint,date,numeric,text),
    vales.registrar_despacho(integer,bigint,date,numeric,numeric,numeric,text,boolean,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.validar_dni_atencion(integer,bigint,text),
    vales.leer_surtidor_simulado(integer,bigint,date,numeric,text),
    vales.registrar_despacho(integer,bigint,date,numeric,numeric,numeric,text,boolean,uuid) TO vales_app;

COMMIT;

