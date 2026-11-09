BEGIN;

ALTER TABLE vales.vales
    DROP CONSTRAINT vales_check1,
    ADD CONSTRAINT vales_tercero_requiere_sc CHECK (codigo_tercero IS NULL OR nrocontrato IS NULL);

CREATE FUNCTION vales.registrar_vale(
    p_actor integer, p_dni text, p_grifo text, p_suministro text, p_cantidad numeric,
    p_observacion text, p_tercero integer, p_destino text, p_fecha date,
    p_localidad text, p_unidad_movil integer, p_centro_costo text, p_sin_contrato boolean
)
RETURNS vales.vales LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
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

    IF p_sin_contrato IS NULL OR (NOT p_sin_contrato AND p_tercero IS NOT NULL) THEN
        RAISE EXCEPTION 'Indica una modalidad válida para el vale.' USING ERRCODE = '22023';
    END IF;

    IF NOT p_sin_contrato THEN
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
        IF p_tercero IS NULL THEN
            PERFORM 1 FROM contrato_vale WHERE ruc = p_grifo ORDER BY cod_contrato FOR SHARE;
            IF EXISTS (SELECT 1 FROM contrato_vale WHERE ruc = p_grifo AND activo
                       AND p_fecha BETWEEN fecha_inicio AND fecha_fin) THEN
                RAISE EXCEPTION 'El grifo tiene un contrato vigente. Elige la modalidad Con contrato.'
                    USING ERRCODE = '22023';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM contrato_vale WHERE ruc = p_grifo AND fecha_fin < p_fecha) THEN
                RAISE EXCEPTION 'Esta modalidad requiere un contrato vencido del grifo en la fecha de emisión.'
                    USING ERRCODE = '22023';
            END IF;
        END IF;
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

-- Mantiene la firma previa para integraciones y datos de ejemplo.
CREATE OR REPLACE FUNCTION vales.registrar_vale(
    p_actor integer, p_dni text, p_grifo text, p_suministro text, p_cantidad numeric,
    p_observacion text DEFAULT NULL, p_tercero integer DEFAULT NULL, p_destino text DEFAULT NULL,
    p_fecha date DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
    p_localidad text DEFAULT NULL, p_unidad_movil integer DEFAULT NULL,
    p_centro_costo text DEFAULT NULL
)
RETURNS vales.vales LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT * FROM vales.registrar_vale(p_actor, p_dni, p_grifo, p_suministro, p_cantidad,
        p_observacion, p_tercero, p_destino, p_fecha, p_localidad, p_unidad_movil, p_centro_costo,
        p_tercero IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION vales.registrar_vale(integer, text, text, text, numeric, text, integer, text,
    date, text, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.registrar_vale(integer, text, text, text, numeric, text, integer, text,
    date, text, integer, text, boolean) TO vales_app;

CREATE OR REPLACE FUNCTION vales.contexto_aplicacion(p_actor integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT jsonb_build_object(
        'actor', u.id_usuario,
        'nombre', concat_ws(' ', p.nombre, p.ap_paterno, p.ap_materno),
        'roles', coalesce((
            SELECT jsonb_agg(to_jsonb(ur) - 'id_usuario' ORDER BY ur.codigo_rol)
            FROM usuario_rol ur WHERE ur.id_usuario = u.id_usuario
        ), '[]'::jsonb),
        'trabajador', jsonb_build_object(
            'dni', p.dni, 'zonal', t.cod_zonal, 'localidad', t.cod_localidad,
            'unidad', t.cod_uni_organizativa, 'centro', t.cod_centro_costo,
            'maquinaria', t.codigo_unidad_movil
        ),
        'zonales', (SELECT jsonb_agg(to_jsonb(z) ORDER BY z.nom_zona) FROM zonal z),
        'localidades', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.nom_localidad) FROM localidad l),
        'proveedores', (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.razon_social) FROM proveedor g),
        'suministros', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.descripcion) FROM suministro s),
        'maquinaria', (
            SELECT jsonb_agg(to_jsonb(m) ORDER BY m.placa)
            FROM unidad_maquinaria m WHERE m.codigo = t.codigo_unidad_movil OR EXISTS (
                SELECT 1 FROM usuario_rol ur WHERE ur.id_usuario = p_actor AND ur.codigo_rol = 'OPERATIVO'
            )
        ),
        'unidad', (SELECT descripcion FROM unidad_organizativa WHERE cod_uni_organizativa = t.cod_uni_organizativa),
        'centros', (
            SELECT jsonb_agg(to_jsonb(c) ORDER BY c.descripcion)
            FROM asignacion_costo a JOIN centro_costo c USING (cod_centro_costo)
            WHERE a.cod_uni_organizativa = t.cod_uni_organizativa
        ),
        'contratos', CASE WHEN EXISTS (SELECT 1 FROM usuario_rol ur
            WHERE ur.id_usuario = p_actor AND ur.codigo_rol = 'OPERATIVO') THEN (
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.cod_contrato, 'proveedor', c.ruc, 'inicio', c.fecha_inicio,
                'fin', c.fecha_fin, 'activo', c.activo, 'saldo', c.monto_disponible, 'precios', (
                    SELECT jsonb_object_agg(s.id_suministro, s.precio_pactado)
                    FROM contrato_suministro s WHERE s.cod_contrato = c.cod_contrato
                )
            ) ORDER BY c.fecha_inicio, c.cod_contrato)
            FROM contrato_vale c
        ) END,
        'tarifas', CASE WHEN EXISTS (SELECT 1 FROM usuario_rol ur
            WHERE ur.id_usuario = p_actor AND ur.codigo_rol = 'OPERATIVO') THEN (
            SELECT jsonb_agg(jsonb_build_object(
                'proveedor', a.cod_proveedor, 'suministro', a.id_suministro,
                'inicio', a.vigente_desde, 'precio', a.precio
            ) ORDER BY a.vigente_desde)
            FROM tarifa a
        ) END,
        'facturas', CASE WHEN tiene_rol(p_actor, 'CONTABILIDAD') THEN (
            SELECT jsonb_agg(to_jsonb(f) || jsonb_build_object('codigo_factura', f.codigo_factura::text)
                             ORDER BY f.fecha_emision DESC, f.codigo_factura)
            FROM proveedor g CROSS JOIN LATERAL listar_facturas_disponibles(p_actor, g.cod_proveedor) f
        ) END
    )
    FROM usuario u JOIN trabajador t USING (id_trabajador) JOIN persona p ON p.dni = t.dni
    WHERE u.id_usuario = p_actor AND u.activo;
$$;

COMMIT;
