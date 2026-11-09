-- PostgreSQL. Ejecutar en una base de desarrollo sin el esquema vales.
BEGIN;
CREATE SCHEMA vales;
SET LOCAL search_path = vales, pg_catalog;

CREATE TABLE zonal (
    id_zona varchar(2) PRIMARY KEY,
    nom_zona varchar(100) NOT NULL
);

CREATE TABLE localidad (
    id_localidad varchar(2) PRIMARY KEY,
    id_zona varchar(2) NOT NULL REFERENCES zonal,
    nom_localidad varchar(100) NOT NULL,
    UNIQUE (id_zona, id_localidad)
);

CREATE TABLE unidad_organizativa (
    cod_uni_organizativa varchar(10) PRIMARY KEY,
    descripcion varchar(150) NOT NULL,
    activa boolean NOT NULL DEFAULT true
);

CREATE TABLE centro_costo (
    cod_centro_costo varchar(15) PRIMARY KEY,
    descripcion varchar(200) NOT NULL
);

CREATE TABLE asignacion_costo (
    cod_uni_organizativa varchar(10) REFERENCES unidad_organizativa,
    cod_centro_costo varchar(15) REFERENCES centro_costo,
    PRIMARY KEY (cod_uni_organizativa, cod_centro_costo)
);

CREATE TABLE persona (
    dni varchar(8) PRIMARY KEY CHECK (dni ~ '^[0-9]{8}$'),
    nombre varchar(100) NOT NULL,
    ap_paterno varchar(100),
    ap_materno varchar(100)
);

CREATE TABLE unidad_maquinaria (
    codigo integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    descripcion varchar(150) NOT NULL,
    tipo_vehiculo varchar(100) NOT NULL,
    placa varchar(15) NOT NULL UNIQUE
);

CREATE TABLE trabajador (
    id_trabajador integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dni varchar(8) NOT NULL UNIQUE REFERENCES persona (dni) ON UPDATE CASCADE,
    cargo varchar(80) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    cod_zonal varchar(2),
    cod_localidad varchar(2),
    cod_uni_organizativa varchar(10) REFERENCES unidad_organizativa,
    cod_centro_costo varchar(15) REFERENCES centro_costo,
    codigo_unidad_movil integer REFERENCES unidad_maquinaria,
    FOREIGN KEY (cod_zonal, cod_localidad) REFERENCES localidad (id_zona, id_localidad) MATCH FULL,
    FOREIGN KEY (cod_uni_organizativa, cod_centro_costo) REFERENCES asignacion_costo
);

CREATE TABLE tercero (
    codigo_tercero integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    documento varchar(20) NOT NULL UNIQUE,
    nombre varchar(150) NOT NULL
);

CREATE TABLE proveedor (
    cod_proveedor varchar(11) PRIMARY KEY CHECK (cod_proveedor ~ '^[0-9]{11}$'),
    razon_social varchar(250) NOT NULL
);

CREATE TABLE suministro (
    id_suministro varchar(15) PRIMARY KEY,
    descripcion varchar(80) NOT NULL UNIQUE,
    unidad_medida varchar(12) NOT NULL DEFAULT 'gal'
);

CREATE TABLE usuario (
    id_usuario integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    login varchar(80) NOT NULL UNIQUE,
    id_trabajador integer NOT NULL UNIQUE REFERENCES trabajador (id_trabajador),
    clave_hash text,
    activo boolean NOT NULL DEFAULT true,
    UNIQUE (id_usuario, id_trabajador)
);

CREATE TABLE rol (
    codigo varchar(20) PRIMARY KEY,
    descripcion varchar(80) NOT NULL
);

CREATE TABLE usuario_rol (
    id_usuario integer REFERENCES usuario,
    codigo_rol varchar(20) REFERENCES rol,
    cod_zonal varchar(2) REFERENCES zonal,
    cod_proveedor varchar(11) REFERENCES proveedor,
    PRIMARY KEY (id_usuario, codigo_rol),
    CONSTRAINT usuario_rol_ambito_zonal
        CHECK ((cod_zonal IS NOT NULL) = (codigo_rol IN ('OPERATIVO', 'JEFE', 'GRIFO'))),
    CHECK ((cod_proveedor IS NOT NULL) = (codigo_rol = 'GRIFO'))
);

CREATE TABLE contrato_vale (
    cod_contrato varchar(10) PRIMARY KEY,
    ruc varchar(11) NOT NULL REFERENCES proveedor,
    monto_total numeric(14,2) NOT NULL CHECK (monto_total > 0),
    monto_comprometido numeric NOT NULL DEFAULT 0 CHECK (monto_comprometido >= 0),
    monto_disponible numeric GENERATED ALWAYS AS (monto_total - monto_comprometido) STORED,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    observacion text,
    activo boolean NOT NULL DEFAULT true,
    CHECK (fecha_fin >= fecha_inicio),
    UNIQUE (cod_contrato, ruc)
);

CREATE TABLE contrato_suministro (
    cod_contrato varchar(10) REFERENCES contrato_vale,
    id_suministro varchar(15) REFERENCES suministro,
    precio_pactado numeric(14,2) NOT NULL CHECK (precio_pactado > 0),
    PRIMARY KEY (cod_contrato, id_suministro)
);

CREATE TABLE tarifa (
    cod_proveedor varchar(11) REFERENCES proveedor,
    id_suministro varchar(15) REFERENCES suministro,
    vigente_desde date NOT NULL,
    precio numeric(14,2) NOT NULL CHECK (precio > 0),
    registrado_por integer NOT NULL REFERENCES usuario,
    registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (cod_proveedor, id_suministro, vigente_desde)
);

CREATE TABLE factura (
    codigo_factura bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cod_proveedor varchar(11) NOT NULL REFERENCES proveedor,
    serie varchar(8) NOT NULL,
    numero varchar(15) NOT NULL,
    fecha_emision date NOT NULL,
    total numeric(14,2) NOT NULL CHECK (total > 0),
    asociado_por integer REFERENCES usuario,
    fecha_asociacion timestamptz,
    CHECK ((asociado_por IS NULL) = (fecha_asociacion IS NULL)),
    UNIQUE (cod_proveedor, serie, numero),
    UNIQUE (codigo_factura, cod_proveedor)
);

CREATE TABLE estado_vale (
    codigo smallint PRIMARY KEY,
    descripcion varchar(20) NOT NULL UNIQUE
);

CREATE TABLE correlativo_vale (
    cod_zonal varchar(2) REFERENCES zonal,
    anio integer CHECK (anio BETWEEN 1 AND 9999),
    ultimo integer NOT NULL CHECK (ultimo BETWEEN 1 AND 9999),
    PRIMARY KEY (cod_zonal, anio)
);

CREATE TABLE correlativo_ticket (
    cod_proveedor varchar(11) PRIMARY KEY REFERENCES proveedor,
    ultimo bigint NOT NULL CHECK (ultimo BETWEEN 1 AND 99999999999999)
);

CREATE TABLE vales (
    id_vale bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_qr uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    codigo_vale varchar(10) NOT NULL CHECK (codigo_vale ~ '^[0-9]{10}$'),
    cod_zonal varchar(2) NOT NULL,
    cod_localidad varchar(2) NOT NULL,
    cod_proveedor varchar(11) NOT NULL REFERENCES proveedor,
    nrocontrato varchar(10),
    id_trabajador integer NOT NULL REFERENCES trabajador (id_trabajador),
    codigo_tercero integer REFERENCES tercero,
    destino_tercero text,
    fecha_emision date NOT NULL,
    id_suministro varchar(15) NOT NULL REFERENCES suministro,
    cantidad_emitida numeric(14,2) NOT NULL CHECK (cantidad_emitida > 0),
    precio_referencial numeric(14,2) NOT NULL CHECK (precio_referencial > 0),
    importe_estimado numeric(14,2) GENERATED ALWAYS AS
        (round(cantidad_emitida * precio_referencial, 2)) STORED CHECK (importe_estimado > 0),
    cod_uni_organizativa varchar(10) REFERENCES unidad_organizativa,
    cod_centrocosto varchar(15) REFERENCES centro_costo,
    codigo_unidad_movil integer REFERENCES unidad_maquinaria,
    estado_vale smallint NOT NULL DEFAULT 0 REFERENCES estado_vale,
    observacion text,
    registrado_por integer NOT NULL,
    registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    autorizado_por integer REFERENCES usuario,
    fecha_autorizacion timestamptz,
    atendido_por integer REFERENCES usuario,
    registrado_atencion_en timestamptz,
    fecha_consumo date,
    cantidad_consumida numeric(14,2) CHECK (cantidad_consumida > 0 AND cantidad_consumida <= cantidad_emitida),
    precio_sugerido numeric(14,2) CHECK (precio_sugerido > 0),
    fuente_precio varchar(10) CHECK (fuente_precio IN ('TARIFA', 'CONTRATO')),
    precio_real numeric(14,2) CHECK (precio_real > 0),
    importe numeric(14,2) GENERATED ALWAYS AS
        (round(cantidad_consumida * precio_real, 2)) STORED CHECK (importe > 0),
    ticket varchar(15) CHECK (ticket ~ '^T[0-9]{14}$'),
    estado_comprobante boolean GENERATED ALWAYS AS (ticket IS NOT NULL) STORED,
    codigo_factura bigint,
    anulado_por integer REFERENCES usuario,
    fecha_anulacion timestamptz,
    observacion_anulacion text,
    UNIQUE (cod_zonal, codigo_vale),
    UNIQUE (cod_proveedor, ticket),
    FOREIGN KEY (registrado_por, id_trabajador) REFERENCES usuario (id_usuario, id_trabajador),
    FOREIGN KEY (cod_zonal, cod_localidad) REFERENCES localidad (id_zona, id_localidad),
    FOREIGN KEY (cod_uni_organizativa, cod_centrocosto) REFERENCES asignacion_costo,
    FOREIGN KEY (nrocontrato, cod_proveedor) REFERENCES contrato_vale (cod_contrato, ruc),
    FOREIGN KEY (nrocontrato, id_suministro) REFERENCES contrato_suministro,
    FOREIGN KEY (codigo_factura, cod_proveedor) REFERENCES factura (codigo_factura, cod_proveedor),
    CHECK ((nrocontrato IS NULL) = (codigo_tercero IS NOT NULL)),
    CHECK (codigo_tercero IS NULL OR nullif(btrim(destino_tercero), '') IS NOT NULL),
    CHECK ((autorizado_por IS NULL) = (fecha_autorizacion IS NULL)),
    CHECK (autorizado_por <> registrado_por),
    CHECK (estado_vale <> 0 OR autorizado_por IS NULL),
    CHECK (estado_vale NOT IN (1, 3) OR autorizado_por IS NOT NULL),
    CHECK (num_nonnulls(atendido_por, registrado_atencion_en, fecha_consumo,
            cantidad_consumida, precio_sugerido, fuente_precio, precio_real, ticket)
            = CASE WHEN estado_vale = 3 THEN 8 ELSE 0 END),
    CHECK (fecha_consumo >= fecha_emision),
    CHECK (codigo_factura IS NULL OR estado_vale = 3),
    CHECK (num_nonnulls(anulado_por, fecha_anulacion, nullif(btrim(observacion_anulacion), ''))
            = CASE WHEN estado_vale = 4 THEN 3 ELSE 0 END),
    CHECK (anulado_por = registrado_por)
);

CREATE TABLE historial_vale (
    id_evento bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_vale bigint NOT NULL REFERENCES vales,
    id_usuario integer NOT NULL REFERENCES usuario,
    accion varchar(25) NOT NULL CHECK (accion IN ('EMISION', 'AUTORIZACION', 'ATENCION', 'FACTURA', 'ANULACION')),
    fecha timestamptz NOT NULL,
    detalle jsonb NOT NULL DEFAULT '{}',
    UNIQUE (id_vale, accion)
);

CREATE INDEX vales_contrato_idx ON vales (nrocontrato) WHERE nrocontrato IS NOT NULL;
CREATE INDEX vales_factura_idx ON vales (codigo_factura) WHERE codigo_factura IS NOT NULL;
CREATE INDEX vales_gastos_idx ON vales (fecha_consumo, id_suministro)
    WHERE estado_vale = 3 AND codigo_factura IS NOT NULL;

INSERT INTO estado_vale VALUES (0, 'EMITIDO'), (1, 'AUTORIZADO'), (3, 'USADO'), (4, 'ANULADO');
INSERT INTO rol VALUES
    ('OPERATIVO', 'Chofer u operativo'), ('JEFE', 'Jefe zonal'),
    ('GRIFO', 'Personal de atención del grifo'), ('CONTABILIDAD', 'Contabilidad y pagos'),
    ('ADMIN', 'Administrador');


-- Las operaciones reciben el ID autenticado por la aplicación.
CREATE FUNCTION tiene_rol(p_actor integer, p_rol text, p_zonal text DEFAULT NULL,
                         p_grifo text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM usuario u JOIN usuario_rol ur USING (id_usuario)
        WHERE u.id_usuario = p_actor AND u.activo AND ur.codigo_rol = p_rol
          AND ur.cod_zonal IS NOT DISTINCT FROM p_zonal
          AND ur.cod_proveedor IS NOT DISTINCT FROM p_grifo
    );
$$;

CREATE FUNCTION validar_magnitud(p_valor numeric, p_campo text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
BEGIN
    IF p_valor IS NULL OR NOT (p_valor > 0 AND p_valor < 1000000000000)
       OR p_valor <> round(p_valor, 2) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = p_campo || ' debe ser positivo y tener hasta dos decimales.';
    END IF;
END;
$$;

CREATE FUNCTION tarifa_en(p_grifo text, p_suministro text, p_fecha date)
RETURNS numeric LANGUAGE sql STABLE SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT precio FROM tarifa
    WHERE cod_proveedor = p_grifo AND id_suministro = p_suministro AND vigente_desde <= p_fecha
    ORDER BY vigente_desde DESC LIMIT 1;
$$;

CREATE FUNCTION registrar_tarifa(p_actor integer, p_grifo text, p_suministro text,
                                 p_desde date, p_precio numeric)
RETURNS tarifa LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    resultado tarifa;
BEGIN
    IF NOT tiene_rol(p_actor, 'ADMIN') THEN
        RAISE EXCEPTION 'Solo Administrador puede cargar tarifas.' USING ERRCODE = '42501';
    END IF;
    PERFORM validar_magnitud(p_precio, 'El precio');
    INSERT INTO tarifa (cod_proveedor, id_suministro, vigente_desde, precio, registrado_por)
    VALUES (p_grifo, p_suministro, p_desde, p_precio, p_actor)
    RETURNING * INTO resultado;
    RETURN resultado;
END;
$$;

CREATE FUNCTION registrar_vale(
    p_actor integer, p_dni text, p_grifo text, p_suministro text, p_cantidad numeric,
    p_observacion text DEFAULT NULL, p_tercero integer DEFAULT NULL, p_destino text DEFAULT NULL,
    p_fecha date DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
    p_localidad text DEFAULT NULL, p_unidad_movil integer DEFAULT NULL,
    p_centro_costo text DEFAULT NULL
)
RETURNS vales LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    trabajador_vale trabajador;
    localidad_vale localidad;
    contrato text;
    precio numeric;
    consecutivo integer;
    anio_emision integer;
    nuevo vales;
BEGIN
    SELECT * INTO trabajador_vale FROM trabajador WHERE dni = p_dni AND activo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe un trabajador activo con ese DNI.' USING ERRCODE = '22023';
    END IF;
    IF (p_localidad IS NOT NULL AND p_localidad <> trabajador_vale.cod_localidad)
       OR (p_unidad_movil IS NOT NULL AND p_unidad_movil <> trabajador_vale.codigo_unidad_movil) THEN
        RAISE EXCEPTION 'La localidad o unidad indicada difiere de la asignación del trabajador.'
            USING ERRCODE = '22023';
    END IF;
    SELECT * INTO localidad_vale FROM localidad
    WHERE id_localidad = coalesce(trabajador_vale.cod_localidad, p_localidad);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Indica una localidad válida para emitir el vale.' USING ERRCODE = '22023';
    END IF;
    IF NOT tiene_rol(p_actor, 'OPERATIVO', localidad_vale.id_zona) THEN
        RAISE EXCEPTION 'La emisión requiere un operativo de la zonal del vale.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM usuario WHERE id_usuario = p_actor AND id_trabajador = trabajador_vale.id_trabajador
    ) THEN
        RAISE EXCEPTION 'El DNI debe corresponder al trabajador que emite el vale.' USING ERRCODE = '42501';
    END IF;
    IF p_centro_costo IS NOT NULL AND p_centro_costo IS DISTINCT FROM trabajador_vale.cod_centro_costo
       AND NOT EXISTS (
           SELECT 1 FROM asignacion_costo
           WHERE cod_uni_organizativa = trabajador_vale.cod_uni_organizativa
             AND cod_centro_costo = p_centro_costo
       ) THEN
        RAISE EXCEPTION 'El centro de costo debe estar habilitado para la unidad organizativa del trabajador.'
            USING ERRCODE = '22023';
    END IF;
    PERFORM validar_magnitud(p_cantidad, 'La cantidad emitida');
    IF p_fecha IS NULL OR NOT isfinite(p_fecha)
       OR p_fecha > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date THEN
        RAISE EXCEPTION 'Indica una fecha de emisión válida hasta el día de hoy.' USING ERRCODE = '22023';
    END IF;

    IF p_tercero IS NULL THEN
        BEGIN
            SELECT c.cod_contrato, d.precio_pactado INTO STRICT contrato, precio
            FROM contrato_vale c
            LEFT JOIN contrato_suministro d ON d.cod_contrato = c.cod_contrato AND d.id_suministro = p_suministro
            WHERE c.ruc = p_grifo AND c.activo AND p_fecha BETWEEN c.fecha_inicio AND c.fecha_fin;
        EXCEPTION
            WHEN no_data_found THEN
                RAISE EXCEPTION 'El grifo no tiene un contrato aplicable para ese combustible.' USING ERRCODE = 'P0001';
            WHEN too_many_rows THEN
                RAISE EXCEPTION 'Hay más de un contrato aplicable. Revisa las vigencias.' USING ERRCODE = 'P0001';
        END;

        IF precio IS NULL THEN
            RAISE EXCEPTION 'El grifo no tiene un contrato aplicable para ese combustible.' USING ERRCODE = 'P0001';
        END IF;
        PERFORM validar_magnitud(round(p_cantidad * precio, 2), 'El importe estimado');
        UPDATE contrato_vale SET monto_comprometido = monto_comprometido + round(p_cantidad * precio, 2)
        WHERE cod_contrato = contrato AND monto_disponible >= round(p_cantidad * precio, 2);
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El contrato no tiene saldo suficiente para emitir el vale.' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        precio := tarifa_en(p_grifo, p_suministro, p_fecha);
        IF precio IS NULL THEN
            RAISE EXCEPTION 'Administrador debe cargar la tarifa aplicable antes de emitir este vale S/C.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    anio_emision := extract(year FROM p_fecha)::integer;
    INSERT INTO correlativo_vale AS c (cod_zonal, anio, ultimo)
    VALUES (localidad_vale.id_zona, anio_emision, 1)
    ON CONFLICT (cod_zonal, anio) DO UPDATE SET ultimo = c.ultimo + 1 WHERE c.ultimo < 9999
    RETURNING ultimo INTO consecutivo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La zonal agotó los 9999 códigos del año.' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO vales (codigo_vale, cod_zonal, cod_localidad, cod_proveedor, nrocontrato,
        id_trabajador, codigo_tercero, destino_tercero, fecha_emision, id_suministro,
        cantidad_emitida, precio_referencial, cod_uni_organizativa, cod_centrocosto,
        codigo_unidad_movil, observacion, registrado_por)
    VALUES (to_char(p_fecha, 'YYYYMM') || lpad(consecutivo::text, 4, '0'),
        localidad_vale.id_zona, localidad_vale.id_localidad, p_grifo, contrato,
        trabajador_vale.id_trabajador, p_tercero, CASE WHEN p_tercero IS NOT NULL THEN p_destino END,
        p_fecha, p_suministro, p_cantidad, precio, trabajador_vale.cod_uni_organizativa,
        coalesce(p_centro_costo, trabajador_vale.cod_centro_costo),
        coalesce(trabajador_vale.codigo_unidad_movil, p_unidad_movil),
        p_observacion, p_actor)
    RETURNING * INTO nuevo;

    INSERT INTO historial_vale (id_vale, id_usuario, accion, fecha)
    VALUES (nuevo.id_vale, p_actor, 'EMISION', nuevo.registrado_en);
    RETURN nuevo;
END;
$$;

-- El lote es indivisible y se bloquea en orden de ID.
CREATE FUNCTION bloquear_vales(p_ids bigint[])
RETURNS SETOF vales LANGUAGE plpgsql SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    cantidad integer;
BEGIN
    IF coalesce(cardinality(p_ids), 0) = 0 THEN
        RAISE EXCEPTION 'Selecciona al menos un vale.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v.* FROM vales v WHERE v.id_vale = ANY(p_ids) ORDER BY v.id_vale FOR UPDATE;
    GET DIAGNOSTICS cantidad = ROW_COUNT;
    IF cantidad <> cardinality(p_ids) THEN
        RAISE EXCEPTION 'La selección contiene vales repetidos o inexistentes.' USING ERRCODE = '22023';
    END IF;
END;
$$;

CREATE FUNCTION autorizar_vales(p_actor integer, p_ids bigint[])
RETURNS SETOF vales LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    vale vales;
BEGIN
    FOR vale IN SELECT * FROM bloquear_vales(p_ids) LOOP
        IF NOT tiene_rol(p_actor, 'JEFE', vale.cod_zonal) OR p_actor = vale.registrado_por THEN
            RAISE EXCEPTION 'Debe autorizar otro usuario con rol de jefe de la zonal.' USING ERRCODE = '42501';
        END IF;
        IF vale.estado_vale <> 0 THEN
            RAISE EXCEPTION 'Solo se autorizan vales emitidos.' USING ERRCODE = 'P0001';
        END IF;
        UPDATE vales SET estado_vale = 1, autorizado_por = p_actor, fecha_autorizacion = clock_timestamp()
        WHERE id_vale = vale.id_vale RETURNING * INTO vale;
        INSERT INTO historial_vale (id_vale, id_usuario, accion, fecha)
        VALUES (vale.id_vale, p_actor, 'AUTORIZACION', vale.fecha_autorizacion);
        RETURN NEXT vale;
    END LOOP;
END;
$$;

CREATE FUNCTION sugerir_precio_atencion(p_actor integer, p_id_vale bigint, p_fecha date)
RETURNS TABLE (precio numeric, fuente text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    vale vales;
BEGIN
    SELECT * INTO vale FROM vales WHERE id_vale = p_id_vale;
    IF NOT FOUND OR NOT tiene_rol(p_actor, 'GRIFO', vale.cod_zonal, vale.cod_proveedor) THEN
        RAISE EXCEPTION 'El vale debe corresponder al grifo y la zonal del usuario.' USING ERRCODE = '42501';
    END IF;
    IF vale.estado_vale <> 1 THEN
        RAISE EXCEPTION 'Solo se atienden vales autorizados.' USING ERRCODE = 'P0001';
    END IF;
    IF p_fecha IS NULL OR p_fecha NOT BETWEEN vale.fecha_emision
       AND (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date THEN
        RAISE EXCEPTION 'La fecha de consumo debe estar entre la emisión y hoy.' USING ERRCODE = '22023';
    END IF;

    precio := tarifa_en(vale.cod_proveedor, vale.id_suministro, p_fecha);
    fuente := 'TARIFA';
    IF precio IS NULL THEN
        IF vale.nrocontrato IS NULL THEN
            RAISE EXCEPTION 'Administrador debe cargar la tarifa aplicable antes de atender este vale S/C.'
                USING ERRCODE = 'P0001';
        END IF;
        precio := vale.precio_referencial;
        fuente := 'CONTRATO';
    END IF;
    RETURN NEXT;
END;
$$;

CREATE FUNCTION registrar_atencion(p_actor integer, p_id_vale bigint, p_fecha date,
                                   p_consumido numeric, p_precio_real numeric DEFAULT NULL,
                                   p_confirmar_cambio_de numeric DEFAULT NULL,
                                   p_dni_presentado text DEFAULT NULL,
                                   p_identidad_verificada boolean DEFAULT false)
RETURNS vales LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    vale vales;
    sugerido numeric;
    fuente text;
    aplicado numeric;
    dni_vale text;
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

    SELECT t.dni INTO dni_vale FROM trabajador t WHERE t.id_trabajador = vale.id_trabajador FOR SHARE;
    IF p_identidad_verificada IS NOT TRUE OR btrim(p_dni_presentado) IS DISTINCT FROM dni_vale THEN
        RAISE EXCEPTION 'Verifica el documento original del trabajador indicado en el vale.'
            USING ERRCODE = '22023';
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
            'ticket', vale.ticket, 'identidad_verificada', true));
    RETURN vale;
END;
$$;


CREATE FUNCTION listar_facturas_disponibles(p_actor integer, p_grifo text)
RETURNS SETOF factura LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
BEGIN
    IF NOT tiene_rol(p_actor, 'CONTABILIDAD') THEN
        RAISE EXCEPTION 'Solo Contabilidad puede consultar las facturas disponibles.' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT f.* FROM factura f
    WHERE f.cod_proveedor = p_grifo AND f.asociado_por IS NULL
    ORDER BY f.fecha_emision DESC, f.serie, f.numero;
END;
$$;

CREATE FUNCTION asociar_factura(p_actor integer, p_factura bigint, p_ids bigint[])
RETURNS factura LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    documento factura;
    vale vales;
    total_vales numeric := 0;
BEGIN
    IF NOT tiene_rol(p_actor, 'CONTABILIDAD') THEN
        RAISE EXCEPTION 'Solo Contabilidad puede asociar facturas.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO documento FROM factura WHERE codigo_factura = p_factura FOR UPDATE;
    IF NOT FOUND OR documento.asociado_por IS NOT NULL THEN
        RAISE EXCEPTION 'La factura no existe o su asociación ya está cerrada.' USING ERRCODE = 'P0001';
    END IF;

    FOR vale IN SELECT * FROM bloquear_vales(p_ids) LOOP
        IF vale.cod_proveedor <> documento.cod_proveedor OR vale.estado_vale <> 3
           OR vale.codigo_factura IS NOT NULL THEN
            RAISE EXCEPTION 'Selecciona vales usados, sin factura y del mismo grifo que la factura.'
                USING ERRCODE = 'P0001';
        END IF;
        total_vales := total_vales + vale.importe;
    END LOOP;
    IF total_vales <> documento.total THEN
        RAISE EXCEPTION 'Los importes de los vales y la factura no coinciden.' USING ERRCODE = 'P0001',
            DETAIL = format('Vales: %s. Factura: %s.', total_vales, documento.total);
    END IF;

    UPDATE factura SET asociado_por = p_actor, fecha_asociacion = clock_timestamp()
    WHERE codigo_factura = p_factura RETURNING * INTO documento;
    UPDATE vales SET codigo_factura = p_factura WHERE id_vale = ANY(p_ids);
    INSERT INTO historial_vale (id_vale, id_usuario, accion, fecha, detalle)
    SELECT id, p_actor, 'FACTURA', documento.fecha_asociacion, jsonb_build_object('codigo_factura', p_factura)
    FROM unnest(p_ids) AS ids(id);
    RETURN documento;
END;
$$;

CREATE FUNCTION anular_vale(p_actor integer, p_id_vale bigint, p_motivo text)
RETURNS vales LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    vale vales;
BEGIN
    SELECT * INTO vale FROM vales WHERE id_vale = p_id_vale FOR UPDATE;
    IF NOT FOUND OR p_actor IS DISTINCT FROM vale.registrado_por
       OR NOT tiene_rol(p_actor, 'OPERATIVO', vale.cod_zonal) THEN
        RAISE EXCEPTION 'Solo el emisor habilitado puede anular su vale.' USING ERRCODE = '42501';
    END IF;
    IF vale.estado_vale NOT IN (0, 1) THEN
        RAISE EXCEPTION 'Solo se anulan vales emitidos o autorizados sin usar.' USING ERRCODE = 'P0001';
    END IF;
    IF nullif(btrim(p_motivo), '') IS NULL THEN
        RAISE EXCEPTION 'Indica el motivo de anulación.' USING ERRCODE = '22023';
    END IF;

    IF vale.nrocontrato IS NOT NULL THEN
        UPDATE contrato_vale SET monto_comprometido = monto_comprometido - vale.importe_estimado
        WHERE cod_contrato = vale.nrocontrato;
    END IF;
    UPDATE vales SET estado_vale = 4, anulado_por = p_actor,
        fecha_anulacion = clock_timestamp(), observacion_anulacion = btrim(p_motivo)
    WHERE id_vale = p_id_vale RETURNING * INTO vale;
    INSERT INTO historial_vale (id_vale, id_usuario, accion, fecha, detalle)
    VALUES (vale.id_vale, p_actor, 'ANULACION', vale.fecha_anulacion, jsonb_build_object('motivo', vale.observacion_anulacion));
    RETURN vale;
END;
$$;

CREATE FUNCTION puede_ver_vale(p_actor integer, p_vale vales)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT (p_vale.registrado_por = p_actor AND tiene_rol(p_actor, 'OPERATIVO', p_vale.cod_zonal))
        OR tiene_rol(p_actor, 'JEFE', p_vale.cod_zonal)
        OR tiene_rol(p_actor, 'GRIFO', p_vale.cod_zonal, p_vale.cod_proveedor)
        OR tiene_rol(p_actor, 'CONTABILIDAD') OR tiene_rol(p_actor, 'ADMIN');
$$;

CREATE FUNCTION listar_vales(p_actor integer, p_zonal text DEFAULT NULL,
                             p_codigo text DEFAULT NULL, p_estado integer DEFAULT NULL)
RETURNS SETOF vales LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT v.* FROM vales v
    WHERE (p_zonal IS NULL OR v.cod_zonal = p_zonal)
      AND (p_codigo IS NULL OR v.codigo_vale = p_codigo)
      AND (p_estado IS NULL OR v.estado_vale = p_estado)
      AND puede_ver_vale(p_actor, v)
    ORDER BY v.fecha_emision DESC, v.id_vale DESC;
$$;

-- Datos del comparativo PDF. El ID y el par zonal/código identifican el documento.
CREATE FUNCTION consultar_pdf_vale(p_actor integer, p_zonal text, p_codigo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    documento jsonb;
BEGIN
    SELECT to_jsonb(v) || jsonb_build_object(
        'estado', e.descripcion,
        'zonal', z.nom_zona, 'localidad', l.nom_localidad, 'grifo', p.razon_social,
        'suministro', s.descripcion, 'unidad_medida', s.unidad_medida,
        'trabajador', concat_ws(' ', pt.nombre, pt.ap_paterno, pt.ap_materno),
        'dni_trabajador', pt.dni,
        'tercero', t.nombre, 'documento_tercero', t.documento,
        'unidad_organizativa', o.descripcion, 'centro_costo', c.descripcion, 'placa', m.placa,
        'qr_habilitable', true,
        'responsables', (
            SELECT jsonb_agg(jsonb_build_object(
                'accion', h.accion, 'nombre', concat_ws(' ', ph.nombre, ph.ap_paterno, ph.ap_materno),
                'cargo', CASE h.accion
                    WHEN 'EMISION' THEN 'Operativo' WHEN 'AUTORIZACION' THEN 'Jefe zonal'
                    WHEN 'ATENCION' THEN 'Atención del grifo' WHEN 'FACTURA' THEN 'Contabilidad'
                    WHEN 'ANULACION' THEN 'Operativo' END,
                'fecha', h.fecha
            ) ORDER BY h.id_evento)
            FROM historial_vale h JOIN usuario u USING (id_usuario)
            JOIN trabajador th ON th.id_trabajador = u.id_trabajador
            JOIN persona ph ON ph.dni = th.dni
            WHERE h.id_vale = v.id_vale
        )
    ) INTO documento
    FROM vales v
    JOIN estado_vale e ON e.codigo = v.estado_vale
    JOIN zonal z ON z.id_zona = v.cod_zonal
    JOIN localidad l ON l.id_localidad = v.cod_localidad
    JOIN proveedor p ON p.cod_proveedor = v.cod_proveedor
    JOIN suministro s ON s.id_suministro = v.id_suministro
    JOIN trabajador tr ON tr.id_trabajador = v.id_trabajador
    JOIN persona pt ON pt.dni = tr.dni
    LEFT JOIN unidad_organizativa o ON o.cod_uni_organizativa = v.cod_uni_organizativa
    LEFT JOIN centro_costo c ON c.cod_centro_costo = v.cod_centrocosto
    LEFT JOIN unidad_maquinaria m ON m.codigo = v.codigo_unidad_movil
    LEFT JOIN tercero t ON t.codigo_tercero = v.codigo_tercero
    WHERE v.cod_zonal = p_zonal AND v.codigo_vale = p_codigo AND puede_ver_vale(p_actor, v);

    IF documento IS NULL THEN
        RAISE EXCEPTION 'El documento no está disponible para este usuario.' USING ERRCODE = '42501';
    END IF;
    RETURN documento;
END;
$$;

-- El enlace identifica el vale. consultar_pdf_vale aplica los permisos por ámbito.
CREATE FUNCTION consultar_vale_qr(p_actor integer, p_id_qr uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT consultar_pdf_vale(p_actor, v.cod_zonal, v.codigo_vale)
        || jsonb_build_object('puede_atender',
            v.estado_vale = 1 AND tiene_rol(p_actor, 'GRIFO', v.cod_zonal, v.cod_proveedor))
    FROM vales v WHERE v.id_qr = p_id_qr;
$$;

CREATE FUNCTION consultar_gastos(p_actor integer, p_mes date)
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
               v.importe, s.id_suministro, s.descripcion, v.codigo_factura, f.serie, f.numero
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


-- Catálogos de referencia de los scripts del docente, con códigos conservados.

INSERT INTO zonal VALUES
('01',	'PIURA'),
('02',	'CHULUCANAS'),
('03',	'PAITA'),
('04',	'SULLANA'),
('05',	'TALARA'),
('08',	'SECHURA');

INSERT INTO localidad (id_localidad, nom_localidad, id_zona) VALUES
('01', 'ZONAL PIURA', '01'),
('02', 'PIURA', '01'),
('03', 'CATACAOS', '01'),
('04', 'LAS LOMAS', '01'), 
('05', 'CASTILLA', '01'),
('07', 'ZONAL CHULUCANAS', '02'),
('08', 'CHULUCANAS', '02'),
('09', 'MORROPON', '02'),
('12', 'ZONAL PAITA', '03'),
('13', 'PAITA', '03'),
('14', 'AMOTAPE', '03'),
('15', 'EL ARENAL', '03'),
('16', 'COLAN', '03'),
('17', 'LA HUACA', '03'),
('18', 'TAMARINDO', '03'),
('19', 'VICHAYAL', '03'),
('20', 'VIVIATE', '03'),
('21', 'PUEBLO NUEVO COLAN', '03'),
('22', 'EL TAMBO', '03'),
('23', 'MIRAMAR', '03'),
('24', 'YACILA', '03'),
('27', 'ZONAL SULLANA', '04'),
('28', 'SULLANA', '04'),
('30', 'LANCONES', '04'),
('31', 'MARCAVELICA', '04'),
('32', 'QUERECOTILLO', '04'),
('33', 'SALITRAL', '04'),
('36', 'ZONAL TALARA', '05'),
('37', 'TALARA-PARIÑAS', '05'),
('38', 'NEGRITOS', '05'),
('39', 'MANCORA', '05'),
('40', 'LOS ORGANOS', '05'),
('41', 'EL ALTO', '05'),
('46', 'SEDE CENTRAL', '01'),
('47', 'ZONAL SECHURA', '08'),
('48', 'SECHURA', '08'),
('49', 'VICE', '08');

INSERT INTO proveedor VALUES
('20100032458','GRIFOSA S.A.C.'),
('20100075858','GRFO SAN INGNACIO SAC.'),
('20102931387','GRIFO VIGMA SRL.'),
('20102995946','GRIFO AVILA S.C.R.LTDA.'),
('20172425632','GRIFOS MORI SOCIEDAD ANONIMA CERRADA.');

INSERT INTO centro_costo VALUES
('90211101','PLANTA DE TRATAMIENTO CURUMUY UBICADO: PIURA'),
('90211212','POZO PACHITEA UBICADO: Piura'),
('90211213','POZO SAN PEDRO UBICADO: Piura'),
('90211214','POZO LOS ALGARROBOS UBICADO: Piura'),
('90211215','POZO VICUS UBICADO: Piura'),
('90212204','RESERVORIO URB. LOS JAZMINES PNP UBICADO:PIURA'),
('90212205','RESERVORIO A.H. SANTA ROSA UBICADO:PIURA'),
('90212211','RESERVORIO LOS ALGARROBOS'),
('90214101','GASTOS GERENCIA DE INGENIERIA'),
('90214201','GASTOS DE CONTROL OPERACIONAL '),
('90214301','GASTOS DE PROCESO DE SUPERVISION DE POZOS'),
('90321109','CAMARA DE BOMBEO CONDOMINIO CATACAOS');

INSERT INTO unidad_organizativa VALUES
('0710','GERENCIA DE INGENIERIA',true),
('0790','SUBGERENCIA OBRAS',true),
('0791','SUBGERENCIA ESTUDIOS Y PROYECTOS',true),
('0792','SUBGERENCIA SUPERVISION DE OBRAS',true),
('0800','GERENCIA DE OPERACIONES',true),
('0810','JEFATURA ZONAL PIURA',true),
('0820','COORDINACION COMERCIAL PIURA',true),
('0826','EQUIPO FUNCIONAL PROCESO ATENCION AL CLIENTE PIURA',true),
('0830','DEPARTAMENTO ADMINISTRATIVO-PAITA',true),
('0840','COORDINACION OPERACION Y MANTENIMIENTO',true);

INSERT INTO suministro (id_suministro, descripcion) VALUES
    ('REGULAR', 'Gasolina regular'), ('PREMIUM', 'Gasolina premium'),
    ('DIESEL_B5', 'Diésel B5'), ('GLP', 'GLP');

-- El propietario instala el esquema. El backend recibe solo las funciones que necesite.
REVOKE ALL ON SCHEMA vales FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vales FROM PUBLIC;
COMMIT;
