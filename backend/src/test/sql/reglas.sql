-- Ejecutar después de cargar los datos de prueba. Las pruebas revierten sus cambios.
BEGIN;
SET LOCAL search_path = vales, pg_catalog;
SET LOCAL TIME ZONE 'America/Lima';
SET LOCAL plpgsql.check_asserts = on;

CREATE FUNCTION pg_temp.esperar_error(sentencia text, codigo text, fragmento text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE sentencia;
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE <> codigo OR strpos(SQLERRM, fragmento) = 0 THEN
            RAISE;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'Se esperaba error % (%) en: %', codigo, fragmento, sentencia;
END;
$$;

DO $$
DECLARE
    hoy date := (SELECT fecha_emision FROM vales WHERE observacion = 'Demo: pendiente de autorizar');
    noviembre date := make_date(extract(year FROM hoy)::integer - 1, 11, 29);
    op_piura integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.operativo.piura');
    op_sullana integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.operativo.sullana');
    jefe_piura integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.jefe.piura');
    jefe_piura2 integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.jefe.piura2');
    jefe_sullana integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.jefe.sullana');
    grifo_a integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.grifo.algarrobos');
    grifo_b integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.grifo.santaelena');
    grifo_vencido integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.grifo.vencido');
    pagos integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.contabilidad');
    admin integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.admin');
    tercero_demo integer := (SELECT codigo_tercero FROM tercero WHERE documento = '90000003');
    emitido vales := (SELECT v FROM vales v WHERE observacion = 'Demo: pendiente de autorizar');
    autorizado vales := (SELECT v FROM vales v WHERE observacion = 'Demo: listo para atender');
    usado vales := (SELECT v FROM vales v WHERE observacion = 'Demo: atención de 15 galones');
    redondeado vales := (SELECT v FROM vales v WHERE observacion = 'Demo: precio corregido y redondeo');
    otro_grifo vales := (SELECT v FROM vales v WHERE observacion = 'Demo: usado de otro grifo');
    agotado vales := (SELECT v FROM vales v WHERE observacion = 'Demo: agota el saldo del contrato');
    factura_ok bigint := (SELECT codigo_factura FROM factura WHERE serie = 'F001' AND numero = '000100');
    factura_mal bigint := (SELECT codigo_factura FROM factura WHERE serie = 'F001' AND numero = '000101');
    ticket_siguiente bigint := (SELECT ultimo + 1 FROM correlativo_ticket WHERE cod_proveedor = '20000000002');
    gastos_previos jsonb := consultar_gastos(pagos, hoy);
    historico bigint := (SELECT id_vale FROM vales WHERE observacion = 'Demo: consumo noviembre, factura diciembre');
    nuevo vales;
    tercero_sin_contrato vales;
    factura_sc bigint;
    saldo numeric;
    documento jsonb;
BEGIN
    -- 1. Registrar. Clave zonal, asignaciones, reinicio anual, tarifa S/C y saldo.
    ASSERT emitido.codigo_vale = autorizado.codigo_vale AND emitido.cod_zonal <> autorizado.cod_zonal;
    ASSERT emitido.codigo_vale = to_char(hoy, 'YYYYMM') || '0001';
    ASSERT (SELECT count(*) FROM listar_vales(pagos, NULL, emitido.codigo_vale) WHERE cod_zonal IN ('01','04')) = 2;
    ASSERT emitido.nrocontrato = 'DEMO-A' AND emitido.precio_referencial = 22.45;
    ASSERT emitido.cod_localidad = '05' AND emitido.cod_centrocosto = '90211214';
    ASSERT emitido.id_trabajador = (SELECT id_trabajador FROM trabajador WHERE dni = '90000001');
    ASSERT (SELECT placa FROM unidad_maquinaria WHERE codigo = emitido.codigo_unidad_movil) = 'DEM-101';
    ASSERT (SELECT codigo_vale FROM vales WHERE id_vale = historico) = to_char(noviembre, 'YYYYMM') || '0001';
    ASSERT (SELECT id_zona FROM localidad WHERE id_localidad = '08') = '02';
    ASSERT (SELECT id_zona FROM localidad WHERE id_localidad = '13') = '03';
    ASSERT (SELECT id_zona FROM localidad WHERE id_localidad = '28') = '04';

    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1, p_centro_costo => %L)',
        op_piura, '90000001', '20000000001', 'REGULAR', '90214201'),
        '22023', 'unidad organizativa del trabajador');
    nuevo := registrar_vale(op_piura, '90000001', '20000000001', 'REGULAR', 1,
        p_centro_costo => '90211212');
    ASSERT nuevo.cod_centrocosto = '90211212' AND nuevo.cod_uni_organizativa = '0800';
    ASSERT (SELECT cod_centro_costo FROM trabajador WHERE id_trabajador = nuevo.id_trabajador) = '90211214';
    documento := consultar_pdf_vale(op_piura, nuevo.cod_zonal, nuevo.codigo_vale);
    ASSERT documento->>'cod_centrocosto' = '90211212';
    ASSERT documento->>'centro_costo' LIKE 'POZO PACHITEA%';

    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1)', op_sullana, '90000001', '20000000001', 'REGULAR'),
        '42501', 'zonal del vale');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1, p_localidad => %L)',
        op_piura, '90000001', '20000000001', 'REGULAR', '02'),
        '22023', 'difiere de la asignación');

    INSERT INTO usuario_rol (id_usuario, codigo_rol, cod_zonal) VALUES (jefe_piura2, 'OPERATIVO', '01');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1)', jefe_piura2, '90000001', '20000000001', 'REGULAR'),
        '42501', 'trabajador que emite');
    PERFORM pg_temp.esperar_error(format(
        'UPDATE vales SET registrado_por = %s WHERE id_vale = %s', jefe_piura2, emitido.id_vale),
        '23503', 'vales_registrado_por_id_trabajador_fkey');

    UPDATE trabajador SET cod_zonal = NULL, cod_localidad = NULL,
        cod_uni_organizativa = NULL, cod_centro_costo = NULL
    WHERE dni = '90000005';
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1)', jefe_piura2, '90000005', '20000000001', 'REGULAR'),
        '22023', 'localidad válida');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1, p_localidad => %L)',
        jefe_piura2, '90000005', '20000000001', 'REGULAR', '28'),
        '42501', 'zonal del vale');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1, p_localidad => %L, p_centro_costo => %L)',
        jefe_piura2, '90000005', '20000000001', 'REGULAR', '05', '90211212'),
        '22023', 'unidad organizativa del trabajador');
    nuevo := registrar_vale(jefe_piura2, '90000005', '20000000001', 'REGULAR', 1, p_localidad => '05');
    ASSERT nuevo.cod_zonal = '01' AND nuevo.cod_localidad = '05';
    ASSERT nuevo.cod_centrocosto IS NULL AND nuevo.codigo_unidad_movil IS NULL;
    documento := consultar_pdf_vale(jefe_piura2, nuevo.cod_zonal, nuevo.codigo_vale);
    ASSERT documento->>'dni_trabajador' = '90000005';
    ASSERT jsonb_typeof(documento->'centro_costo') = 'null';
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1)', op_sullana, '90000002', '20000000002', 'GLP'),
        'P0001', 'no tiene un contrato');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1, NULL, %s, %L)',
        op_sullana, '90000002', '20000000002', 'PREMIUM', tercero_demo, 'Apoyo'),
        'P0001', 'cargar la tarifa');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_tarifa(%s, %L, %L, %L, 24.60)', op_sullana, '20000000002', 'PREMIUM', hoy),
        '42501', 'Administrador');
    PERFORM registrar_tarifa(admin, '20000000002', 'PREMIUM', hoy, 24.60);
    tercero_sin_contrato := registrar_vale(op_sullana, '90000002', '20000000002', 'PREMIUM', 1,
        NULL, tercero_demo, 'Apoyo');
    ASSERT tercero_sin_contrato.nrocontrato IS NULL AND tercero_sin_contrato.precio_referencial = 24.60;

    ASSERT (SELECT monto_disponible FROM contrato_vale WHERE cod_contrato = 'DEMO-C') = 0;
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s, %L, %L, %L, 1)', op_piura, '90000001', '20000000003', 'REGULAR'),
        'P0001', 'saldo suficiente');

    -- 2. Autorizar. Permisos, lote íntegro y autorización única.
    PERFORM pg_temp.esperar_error(format(
        'SELECT autorizar_vales(%s, ARRAY[%s,%s]::bigint[])', jefe_piura, emitido.id_vale, autorizado.id_vale),
        '42501', 'jefe de la zonal');
    ASSERT (SELECT estado_vale FROM vales WHERE id_vale = emitido.id_vale) = 0;
    INSERT INTO usuario_rol (id_usuario, codigo_rol, cod_zonal) VALUES (op_piura, 'JEFE', '01');
    PERFORM pg_temp.esperar_error(format(
        'SELECT autorizar_vales(%s, ARRAY[%s]::bigint[])', op_piura, emitido.id_vale),
        '42501', 'otro usuario');
    PERFORM autorizar_vales(jefe_piura, ARRAY[emitido.id_vale]);
    PERFORM pg_temp.esperar_error(format(
        'SELECT autorizar_vales(%s, ARRAY[%s]::bigint[])', jefe_piura2, emitido.id_vale),
        'P0001', 'vales emitidos');
    PERFORM autorizar_vales(jefe_sullana, ARRAY[tercero_sin_contrato.id_vale]);

    -- 3. Atender. Tarifa, respaldo, exceso, advertencia y tickets.
    ASSERT (SELECT fuente FROM sugerir_precio_atencion(grifo_b, autorizado.id_vale, hoy)) = 'CONTRATO';
    ASSERT (SELECT precio FROM sugerir_precio_atencion(grifo_b, tercero_sin_contrato.id_vale, hoy)) = 24.60;
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,10)', grifo_a, autorizado.id_vale, hoy),
        '42501', 'grifo y la zonal del usuario');

    nuevo := registrar_vale(op_sullana, '90000002', '20000000001', 'REGULAR', 1);
    PERFORM autorizar_vales(jefe_sullana, ARRAY[nuevo.id_vale]);
    ASSERT NOT EXISTS (SELECT 1 FROM listar_vales(grifo_a) WHERE id_vale = nuevo.id_vale);
    PERFORM pg_temp.esperar_error(format('SELECT consultar_vale_qr(%s,%L)', grifo_a, nuevo.id_qr),
        '42501', 'no está disponible');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_atencion(%s,%s,%L,1,NULL,NULL,%L,true)', grifo_a, nuevo.id_vale, hoy, '90000002'),
        '42501', 'grifo y la zonal del usuario');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,22)', grifo_b, autorizado.id_vale, hoy),
        '22023', 'supera los galones');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,15,22.40)', grifo_b, autorizado.id_vale, hoy),
        'P0001', 'Confirma la modificación');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,15,22.40,21.79)', grifo_b, autorizado.id_vale, hoy),
        'P0001', 'Confirma la modificación');
    saldo := (SELECT monto_disponible FROM contrato_vale WHERE cod_contrato = 'DEMO-B');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,15)', grifo_b, autorizado.id_vale, hoy),
        '22023', 'documento original');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,15,NULL,NULL,%L,true)',
        grifo_b, autorizado.id_vale, hoy, '90000001'), '22023', 'documento original');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,15,NULL,NULL,%L,false)',
        grifo_b, autorizado.id_vale, hoy, '90000002'), '22023', 'documento original');
    nuevo := registrar_atencion(grifo_b, autorizado.id_vale, hoy, 15, 22.40, 21.80, '90000002', true);
    ASSERT (SELECT detalle->>'identidad_verificada' FROM historial_vale
        WHERE id_vale = nuevo.id_vale AND accion = 'ATENCION') = 'true';
    ASSERT nuevo.estado_vale = 3 AND nuevo.estado_comprobante
        AND nuevo.ticket = 'T' || lpad(ticket_siguiente::text, 14, '0');
    ASSERT otro_grifo.ticket = usado.ticket AND otro_grifo.cod_proveedor <> usado.cod_proveedor;
    ASSERT nuevo.cantidad_consumida = 15 AND nuevo.importe = 336 AND nuevo.precio_sugerido = 21.80;
    ASSERT (SELECT monto_disponible FROM contrato_vale WHERE cod_contrato = 'DEMO-B')
        = saldo + autorizado.importe_estimado - nuevo.importe;
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,5)', grifo_b, autorizado.id_vale, hoy),
        'P0001', 'vales autorizados');
    ASSERT redondeado.importe = 28.08;

    -- 4. Asociar. Exactitud, grifo, duplicados y cierre.
    ASSERT (SELECT count(*) FROM listar_facturas_disponibles(pagos, '20000000001') WHERE serie = 'F001') = 2;
    PERFORM pg_temp.esperar_error(format(
        'SELECT asociar_factura(%s,%s,ARRAY[%s,%s]::bigint[])', pagos, factura_mal, usado.id_vale, redondeado.id_vale),
        'P0001', 'no coinciden');
    PERFORM pg_temp.esperar_error(format(
        'SELECT asociar_factura(%s,%s,ARRAY[%s,%s]::bigint[])', pagos, factura_ok, usado.id_vale, otro_grifo.id_vale),
        'P0001', 'mismo grifo');
    PERFORM pg_temp.esperar_error(format(
        'SELECT asociar_factura(%s,%s,ARRAY[%s,%s]::bigint[])', pagos, factura_ok, usado.id_vale, usado.id_vale),
        '22023', 'repetidos');
    PERFORM asociar_factura(pagos, factura_ok, ARRAY[usado.id_vale, redondeado.id_vale]);
    ASSERT (SELECT count(*) FROM listar_facturas_disponibles(pagos, '20000000001') WHERE serie = 'F001') = 1;
    PERFORM pg_temp.esperar_error(format(
        'SELECT asociar_factura(%s,%s,ARRAY[%s]::bigint[])', pagos, factura_ok, usado.id_vale),
        'P0001', 'ya está cerrada');

    -- 5. Anular. Solo el emisor, antes del uso, y libera la reserva.
    PERFORM pg_temp.esperar_error(format('SELECT anular_vale(%s,%s,%L)', op_sullana, agotado.id_vale, 'Error'),
        '42501', 'emisor');
    PERFORM pg_temp.esperar_error(format('SELECT anular_vale(%s,%s,%L)', op_piura, usado.id_vale, 'Error'),
        'P0001', 'sin usar');
    PERFORM pg_temp.esperar_error(format('SELECT anular_vale(%s,%s,%L)', op_piura, agotado.id_vale, ' '),
        '22023', 'motivo');
    nuevo := anular_vale(op_piura, agotado.id_vale, 'Operación de prueba cancelada');
    ASSERT nuevo.estado_vale = 4 AND NOT nuevo.estado_comprobante;
    ASSERT (SELECT monto_disponible FROM contrato_vale WHERE cod_contrato = 'DEMO-C') = 220;
    PERFORM registrar_vale(op_piura, '90000001', '20000000003', 'REGULAR', 10);

    -- 6. PDF. Responsables persistidos, visibilidad y documento por zonal.
    documento := consultar_pdf_vale(pagos, usado.cod_zonal, usado.codigo_vale);
    ASSERT documento->>'estado' = 'USADO' AND (documento->>'qr_habilitable')::boolean;
    ASSERT (consultar_vale_qr(pagos, usado.id_qr)->>'id_vale')::bigint = usado.id_vale;
    ASSERT consultar_vale_qr(pagos, autorizado.id_qr)->>'dni_trabajador' = '90000002';
    ASSERT NOT (consultar_vale_qr(grifo_b, autorizado.id_qr) ? 'dni_trabajador');
    ASSERT (SELECT count(DISTINCT (consultar_vale_qr(pagos, id_qr)->>'estado_vale')) FROM vales) = 4;
    ASSERT consultar_vale_qr(pagos, agotado.id_qr)->>'estado' = 'ANULADO';
    ASSERT consultar_vale_qr(pagos, '00000000-0000-0000-0000-000000000000') IS NULL;
    PERFORM pg_temp.esperar_error(format('SELECT consultar_vale_qr(%s,%L)', jefe_sullana, usado.id_qr),
        '42501', 'no está disponible');
    ASSERT documento->>'dni_trabajador' = '90000001';
    ASSERT jsonb_array_length(documento->'responsables') = 4;
    ASSERT documento #>> '{responsables,1,nombre}' = 'Carlos Medina';
    ASSERT documento #>> '{responsables,2,nombre}' = 'Lucía Torres';
    ASSERT (consultar_pdf_vale(op_piura, emitido.cod_zonal, emitido.codigo_vale)->>'id_vale')::bigint = emitido.id_vale;
    PERFORM pg_temp.esperar_error(format('SELECT consultar_pdf_vale(%s,%L,%L)', jefe_sullana, usado.cod_zonal, usado.codigo_vale),
        '42501', 'no está disponible');

    -- 7. Gastos. Consumos con factura, según fecha efectiva, detalle y permiso.
    ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(consultar_gastos(pagos, noviembre)->'vales') d
                   WHERE (d->>'id_vale')::bigint = historico AND (d->>'importe')::numeric = 76.50);
    ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(consultar_gastos(pagos, noviembre + 4)->'vales') d
                       WHERE (d->>'id_vale')::bigint = historico);
    documento := consultar_gastos(pagos, hoy);
    ASSERT (documento->>'importe_total')::numeric = (gastos_previos->>'importe_total')::numeric + 367.08;
    ASSERT jsonb_array_length(documento->'vales') = jsonb_array_length(gastos_previos->'vales') + 2;
    PERFORM pg_temp.esperar_error(format('SELECT consultar_gastos(%s,%L)', admin, hoy),
        '42501', 'Contabilidad');

    -- Un tercero retira el combustible con su DNI. El responsable y el saldo se conservan.
    saldo := (SELECT monto_disponible FROM contrato_vale WHERE cod_contrato = 'DEMO-B');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,1,NULL,NULL,%L,true)',
        grifo_b, tercero_sin_contrato.id_vale, hoy, '90000002'), '22023', 'documento original del tercero');
    PERFORM pg_temp.esperar_error(format('SELECT registrar_atencion(%s,%s,%L,1,NULL,NULL,%L,false)',
        grifo_b, tercero_sin_contrato.id_vale, hoy, '90000003'), '22023', 'documento original del tercero');
    nuevo := registrar_atencion(grifo_b, tercero_sin_contrato.id_vale, hoy, 1, NULL, NULL, '90000003', true);
    ASSERT nuevo.estado_vale = 3 AND nuevo.nrocontrato IS NULL AND nuevo.fuente_precio = 'TARIFA';
    ASSERT nuevo.id_trabajador = tercero_sin_contrato.id_trabajador AND nuevo.registrado_por = op_sullana;
    ASSERT nuevo.importe = 24.60 AND nuevo.ticket IS NOT NULL;
    ASSERT (SELECT detalle->>'identidad_de' FROM historial_vale
        WHERE id_vale = nuevo.id_vale AND accion = 'ATENCION') = 'tercero';
    ASSERT (SELECT monto_disponible FROM contrato_vale WHERE cod_contrato = 'DEMO-B') = saldo;
    INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total)
    VALUES (nuevo.cod_proveedor, 'QA-SC', '000001', hoy, nuevo.importe)
    RETURNING codigo_factura INTO factura_sc;
    PERFORM asociar_factura(pagos, factura_sc, ARRAY[nuevo.id_vale]);
    ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(consultar_gastos(pagos, hoy)->'vales') d
                   WHERE (d->>'id_vale')::bigint = nuevo.id_vale AND (d->>'importe')::numeric = 24.60
                     AND d->'nrocontrato' = 'null'::jsonb);
    ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(consultar_gastos(pagos, hoy)->'vales') d
                   WHERE (d->>'id_vale')::bigint = usado.id_vale AND d->>'nrocontrato' = 'DEMO-A');

    -- S/C por vencimiento. El trabajador retira el combustible y no se usa saldo de contrato.
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s,%L,%L,%L,1,NULL,NULL,NULL,%L,NULL,NULL,NULL,true)',
        op_piura, '90000001', '20000000001', 'REGULAR', hoy), '22023', 'tiene un contrato vigente');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s,%L,%L,%L,1,NULL,NULL,NULL,%L,NULL,NULL,NULL,true)',
        op_sullana, '90000002', '20000000007', 'GLP', hoy), 'P0001', 'tarifa aplicable');
    PERFORM pg_temp.esperar_error(format(
        'SELECT registrar_vale(%s,%L,%L,%L,1,NULL,NULL,NULL,%L,NULL,NULL,NULL,true)',
        op_sullana, '90000002', '20000000007', 'DIESEL_B5', hoy - 1), '22023', 'requiere un contrato vencido');
    nuevo := registrar_vale(op_sullana, '90000002', '20000000007', 'DIESEL_B5', 5,
                            NULL, NULL, NULL, hoy, NULL, NULL, NULL, true);
    ASSERT nuevo.nrocontrato IS NULL AND nuevo.codigo_tercero IS NULL AND nuevo.importe_estimado = 100;
    PERFORM autorizar_vales(jefe_sullana, ARRAY[nuevo.id_vale]);
    nuevo := registrar_atencion(grifo_vencido, nuevo.id_vale, hoy, 4, NULL, NULL, '90000002', true);
    ASSERT nuevo.estado_vale = 3 AND nuevo.importe = 80;
    ASSERT (SELECT monto_disponible FROM contrato_vale WHERE cod_contrato = 'DEMO-SC') = 90000;
    SELECT codigo_factura INTO factura_sc FROM factura WHERE cod_proveedor = '20000000007' AND serie = 'SC01';
    PERFORM asociar_factura(pagos, factura_sc, ARRAY[nuevo.id_vale]);
    ASSERT EXISTS (SELECT 1 FROM jsonb_array_elements(consultar_gastos(pagos, hoy)->'vales') d
                   WHERE (d->>'id_vale')::bigint = nuevo.id_vale AND (d->>'importe')::numeric = 80
                     AND d->'nrocontrato' = 'null'::jsonb);

    ASSERT NOT EXISTS (
        SELECT 1 FROM contrato_vale c
        WHERE c.monto_comprometido <> coalesce((
            SELECT sum(CASE WHEN estado_vale = 3 THEN importe ELSE importe_estimado END)
            FROM vales WHERE nrocontrato = c.cod_contrato AND estado_vale IN (0, 1, 3)
        ), 0)
    ), 'Los saldos deben cuadrar con los vales';
    -- Una cuenta necesita una ficha laboral y cada ficha admite una cuenta.
    PERFORM pg_temp.esperar_error(
        'INSERT INTO usuario (login) VALUES (''sin-trabajador'')',
        '23502', 'id_trabajador');
    PERFORM pg_temp.esperar_error(
        'INSERT INTO usuario (login, id_trabajador) VALUES (''trabajador-inexistente'', -1)',
        '23503', 'usuario_id_trabajador_fkey');
    PERFORM pg_temp.esperar_error(format(
        'INSERT INTO usuario (login, id_trabajador) VALUES (''cuenta-duplicada'', %s)',
        emitido.id_trabajador),
        '23505', 'usuario_id_trabajador_key');

    -- Una corrección de DNI conserva la ficha laboral, la cuenta y los vales previos.
    UPDATE persona SET dni = '90000101' WHERE dni = '90000001';
    ASSERT (SELECT dni FROM trabajador WHERE id_trabajador = emitido.id_trabajador) = '90000101';
    ASSERT (SELECT id_trabajador FROM usuario WHERE id_usuario = op_piura) = emitido.id_trabajador;
    documento := consultar_pdf_vale(op_piura, emitido.cod_zonal, emitido.codigo_vale);
    ASSERT (documento->>'id_trabajador')::integer = emitido.id_trabajador;
    ASSERT documento->>'dni_trabajador' = '90000101';
    ASSERT (SELECT count(*) FROM (
        SELECT cod_zonal FROM vales WHERE observacion LIKE 'Historial %'
        GROUP BY cod_zonal HAVING count(DISTINCT date_trunc('month', fecha_emision)) = 7
            AND count(DISTINCT estado_vale) = 4
    ) casos) = 4;
    RAISE NOTICE 'Verificados los siete servicios y sus reglas principales.';
END;
$$;

ROLLBACK;

