-- Solo para una base de desarrollo con base-datos-vales.sql ya instalado.
BEGIN;
SET LOCAL search_path = vales, pg_catalog;
SET LOCAL TIME ZONE 'America/Lima';

INSERT INTO proveedor VALUES
    ('20000000001', 'Grifo Los Algarrobos (demo)'),
    ('20000000002', 'Estación Santa Elena (demo)'),
    ('20000000003', 'Grifo Valle Verde (demo)');

-- Las asociaciones de costo, personas y unidades siguientes son ficticias.
INSERT INTO asignacion_costo VALUES
    ('0800', '90211214'), ('0800', '90211212'), ('0840', '90214201');
INSERT INTO unidad_maquinaria (descripcion, tipo_vehiculo, placa) VALUES
    ('Unidad de mantenimiento Piura', 'Camioneta', 'DEM-101'),
    ('Unidad de operaciones Sullana', 'Camioneta', 'DEM-202');

WITH perfiles(dni, nombre, ap_paterno, login, cargo, zonal, localidad, placa) AS (
    VALUES
        ('90000001', 'Rosa', 'Gutiérrez', 'demo.operativo.piura', 'Chofer', '01', '05', 'DEM-101'),
        ('90000002', 'Luis', 'Mendoza', 'demo.operativo.sullana', 'Operativo', '04', '28', 'DEM-202'),
        ('90000004', 'Carlos', 'Medina', 'demo.jefe.piura', 'Jefe zonal', '01', '05', NULL),
        ('90000005', 'Elena', 'Castro', 'demo.jefe.piura2', 'Jefa zonal', '01', '05', NULL),
        ('90000006', 'María', 'Ríos', 'demo.jefe.sullana', 'Jefa zonal', '04', '28', NULL),
        ('90000007', 'Lucía', 'Torres', 'demo.grifo.algarrobos', 'Atención en grifo', NULL, NULL, NULL),
        ('90000008', 'Miguel', 'Herrera', 'demo.grifo.santaelena', 'Atención en grifo', NULL, NULL, NULL),
        ('90000009', 'Ana', 'Vargas', 'demo.contabilidad', 'Contadora', '01', '05', NULL),
        ('90000010', 'Diego', 'León', 'demo.admin', 'Administrador', '01', '05', NULL)
), personas AS (
    INSERT INTO persona (dni, nombre, ap_paterno)
    SELECT dni, nombre, ap_paterno FROM perfiles
    RETURNING dni
), trabajadores AS (
    INSERT INTO trabajador (dni, cargo, cod_zonal, cod_localidad,
        cod_uni_organizativa, cod_centro_costo, codigo_unidad_movil)
    SELECT p.dni, p.cargo, p.zonal, p.localidad, a.unidad, a.centro, m.codigo
    FROM perfiles p JOIN personas USING (dni)
    LEFT JOIN (VALUES ('01', '0800', '90211214'), ('04', '0840', '90214201'))
        AS a(zonal, unidad, centro) ON a.zonal = p.zonal
    LEFT JOIN unidad_maquinaria m ON m.placa = p.placa
    RETURNING dni, id_trabajador
)
INSERT INTO usuario (login, id_trabajador)
SELECT p.login, t.id_trabajador FROM perfiles p JOIN trabajadores t USING (dni);

INSERT INTO usuario_rol (id_usuario, codigo_rol, cod_zonal, cod_proveedor)
SELECT u.id_usuario, a.rol, a.zonal, a.grifo
FROM (VALUES
    ('demo.operativo.piura', 'OPERATIVO', '01', NULL),
    ('demo.operativo.sullana', 'OPERATIVO', '04', NULL),
    ('demo.jefe.piura', 'JEFE', '01', NULL),
    ('demo.jefe.piura2', 'JEFE', '01', NULL),
    ('demo.jefe.sullana', 'JEFE', '04', NULL),
    ('demo.grifo.algarrobos', 'GRIFO', '01', '20000000001'),
    ('demo.grifo.santaelena', 'GRIFO', '04', '20000000002'),
    ('demo.contabilidad', 'CONTABILIDAD', NULL, NULL),
    ('demo.admin', 'ADMIN', NULL, NULL)
) AS a(login, rol, zonal, grifo) JOIN usuario u USING (login);

INSERT INTO tercero (documento, nombre)
VALUES ('90000003', 'Julia Flores (tercera de prueba)');

INSERT INTO contrato_vale (cod_contrato, ruc, monto_total, fecha_inicio, fecha_fin, observacion) VALUES
    ('DEMO-OLD', '20000000001', 12000, '2019-01-01', '2019-12-31', 'Contrato vencido de prueba'),
    ('DEMO-A', '20000000001', 15000, '2020-01-01', '2099-12-31', 'Contrato de prueba Algarrobos'),
    ('DEMO-B', '20000000002',  8000, '2020-01-01', '2099-12-31', 'Contrato de prueba Santa Elena'),
    ('DEMO-C', '20000000003',   220, '2020-01-01', '2099-12-31', 'Prueba de saldo agotado');

INSERT INTO contrato_suministro VALUES
    ('DEMO-OLD', 'REGULAR', 20.00),
    ('DEMO-A', 'REGULAR', 22.45), ('DEMO-A', 'DIESEL_B5', 25.50), ('DEMO-A', 'PREMIUM', 24.40),
    ('DEMO-B', 'REGULAR', 21.80), ('DEMO-B', 'DIESEL_B5', 25.10),
    ('DEMO-C', 'REGULAR', 22.00);

DO $$
DECLARE
    hoy date := CURRENT_DATE;
    noviembre date := make_date(extract(year FROM hoy)::integer - 1, 11, 29);
    op_piura integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.operativo.piura');
    op_sullana integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.operativo.sullana');
    jefe_piura integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.jefe.piura');
    jefe_sullana integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.jefe.sullana');
    grifo_a integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.grifo.algarrobos');
    grifo_b integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.grifo.santaelena');
    pagos integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.contabilidad');
    admin integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.admin');
    tercero_demo integer := (SELECT codigo_tercero FROM tercero WHERE documento = '90000003');
    vale_a bigint;
    vale_b bigint;
    vale_historico bigint;
    factura_historica bigint;
BEGIN
    PERFORM registrar_tarifa(admin, '20000000001', 'REGULAR', '2020-01-01', 22.55);
    PERFORM registrar_tarifa(admin, '20000000001', 'REGULAR', hoy, 22.60);
    PERFORM registrar_tarifa(admin, '20000000002', 'GLP', '2020-01-01', 8.70);

    -- Ambos vales empiezan en 0001 en su propia zonal.
    PERFORM registrar_vale(op_piura, '90000001', '20000000001', 'REGULAR', 12, 'Demo: pendiente de autorizar');
    vale_b := (registrar_vale(op_sullana, '90000002', '20000000002', 'REGULAR', 20,
        'Demo: listo para atender')).id_vale;
    PERFORM autorizar_vales(jefe_sullana, ARRAY[vale_b]);

    vale_a := (registrar_vale(op_piura, '90000001', '20000000001', 'REGULAR', 20,
        'Demo: atención de 15 galones')).id_vale;
    PERFORM autorizar_vales(jefe_piura, ARRAY[vale_a]);
    PERFORM registrar_atencion(grifo_a, vale_a, hoy, 15, p_dni_presentado => '90000001', p_identidad_verificada => true);

    vale_a := (registrar_vale(op_piura, '90000001', '20000000001', 'REGULAR', 2,
        'Demo: precio corregido y redondeo')).id_vale;
    PERFORM autorizar_vales(jefe_piura, ARRAY[vale_a]);
    PERFORM registrar_atencion(grifo_a, vale_a, hoy, 1.25, 22.46, 22.60, '90000001', true);

    vale_b := (registrar_vale(op_sullana, '90000002', '20000000002', 'DIESEL_B5', 8,
        'Demo: usado de otro grifo')).id_vale;
    PERFORM autorizar_vales(jefe_sullana, ARRAY[vale_b]);
    PERFORM registrar_atencion(grifo_b, vale_b, hoy, 6, p_dni_presentado => '90000002', p_identidad_verificada => true);

    vale_a := (registrar_vale(op_piura, '90000001', '20000000001', 'PREMIUM', 5,
        'Demo: anulado antes del uso')).id_vale;
    PERFORM autorizar_vales(jefe_piura, ARRAY[vale_a]);
    PERFORM anular_vale(op_piura, vale_a, 'Salida operativa cancelada');

    PERFORM registrar_vale(op_sullana, '90000002', '20000000002', 'GLP', 5,
        'Demo: tercero sin contrato', tercero_demo, 'Apoyo de campo');
    PERFORM registrar_vale(op_piura, '90000001', '20000000003', 'REGULAR', 10,
        'Demo: agota el saldo del contrato');

    vale_historico := (registrar_vale(op_piura, '90000001', '20000000001', 'DIESEL_B5', 3,
        'Demo: consumo noviembre, factura diciembre', p_fecha => noviembre)).id_vale;
    PERFORM autorizar_vales(jefe_piura, ARRAY[vale_historico]);
    PERFORM registrar_atencion(grifo_a, vale_historico, noviembre, 3, p_dni_presentado => '90000001', p_identidad_verificada => true);

    INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total) VALUES
        ('20000000001', 'F001', '000100', hoy, 367.08),
        ('20000000001', 'F001', '000101', hoy, 367.07),
        ('20000000002', 'F002', '000100', hoy, 150.60);
    INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total)
    VALUES ('20000000001', 'F001', '000090', noviembre + 4, 76.50)
    RETURNING codigo_factura INTO factura_historica;
    PERFORM asociar_factura(pagos, factura_historica, ARRAY[vale_historico]);
END;
$$;

COMMIT;

