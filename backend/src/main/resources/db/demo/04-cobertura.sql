-- Amplía los ejemplos de la instalación local y conserva el historial existente.
BEGIN;
SET LOCAL search_path = vales, pg_catalog;
SET LOCAL TIME ZONE 'America/Lima';

INSERT INTO proveedor VALUES ('20000000006', 'Estación Miraflores (demo)');
INSERT INTO contrato_vale (cod_contrato, ruc, monto_total, fecha_inicio, fecha_fin, observacion)
VALUES ('DEMO-F', '20000000006', 18000, '2020-01-01', '2099-12-31', 'Abastecimiento de prueba en Piura');
INSERT INTO contrato_suministro VALUES
    ('DEMO-F', 'REGULAR', 23.20), ('DEMO-F', 'PREMIUM', 25.40), ('DEMO-F', 'DIESEL_B5', 25.80);

INSERT INTO unidad_maquinaria (descripcion, tipo_vehiculo, placa) VALUES
    ('Camioneta de campo Piura', 'Camioneta', 'DEM-105'),
    ('Vehículo de inspección Piura', 'Camioneta', 'DEM-106');

WITH cuentas(dni, nombre, apellido, login, cargo, rol, zonal, localidad, grifo, unidad, centro, placa) AS (
    VALUES
        ('90000201','Mateo','Salazar','demo.operativo.piura2','Chofer','OPERATIVO','01','05',NULL,'0800','90211214','DEM-105'),
        ('90000202','Paula','Navarro','demo.operativo.piura3','Chofer','OPERATIVO','01','05',NULL,'0800','90211212','DEM-106'),
        ('90000203','Daniel','Cruz','demo.operativo.sullana2','Chofer','OPERATIVO','04','28',NULL,'0840','90214201','DEM-202'),
        ('90000204','Carla','Medina','demo.operativo.paita2','Chofer','OPERATIVO','03','13',NULL,'0800','90321109','DEM-303'),
        ('90000205','Martín','Reyes','demo.operativo.talara2','Chofer','OPERATIVO','05','37',NULL,'0840','90214301','DEM-404'),
        ('90000206','Patricia','Núñez','demo.jefe.sullana2','Jefa zonal','JEFE','04','28',NULL,'0840','90214201',NULL),
        ('90000207','Ricardo','Soto','demo.jefe.paita2','Jefe zonal','JEFE','03','13',NULL,'0800','90321109',NULL),
        ('90000208','Verónica','Paz','demo.jefe.talara2','Jefa zonal','JEFE','05','37',NULL,'0840','90214301',NULL),
        ('90000209','Iván','Rivas','demo.grifo.miraflores','Atención en grifo','GRIFO','01',NULL,'20000000006',NULL,NULL,NULL)
), personas AS (
    INSERT INTO persona (dni, nombre, ap_paterno)
    SELECT dni, nombre, apellido FROM cuentas
    RETURNING dni
), trabajadores AS (
    INSERT INTO trabajador (dni, cargo, cod_zonal, cod_localidad, cod_uni_organizativa, cod_centro_costo, codigo_unidad_movil)
    SELECT c.dni, c.cargo, CASE WHEN c.localidad IS NOT NULL THEN c.zonal END, c.localidad, c.unidad, c.centro, m.codigo
    FROM cuentas c JOIN personas USING (dni)
    LEFT JOIN unidad_maquinaria m ON m.placa = c.placa
    RETURNING dni, id_trabajador
), usuarios AS (
    INSERT INTO usuario (login, id_trabajador, clave_hash)
    SELECT c.login, t.id_trabajador, '{bcrypt}$2a$10$gXpzPqhp/pe.F41HIXEI/eifcbu8wanEmnjGdgXzdPUhTTPCwOrXe'
    FROM cuentas c JOIN trabajadores t USING (dni)
    RETURNING id_usuario, login
)
INSERT INTO usuario_rol (id_usuario, codigo_rol, cod_zonal, cod_proveedor)
SELECT u.id_usuario, c.rol, c.zonal, c.grifo FROM usuarios u JOIN cuentas c USING (login);

DO $$
DECLARE
    hoy date := CURRENT_DATE;
    ejemplo record;
    emitido vales;
    atendido vales;
BEGIN
    FOR ejemplo IN
        SELECT x.*, t.dni, op.id_usuario AS emisor, j.id_usuario AS autorizador, g.id_usuario AS atendedor
        FROM (VALUES
            ('V001','Algarrobos','demo.operativo.piura2','demo.jefe.piura2','demo.grifo.algarrobos','20000000001','DIESEL_B5'),
            ('V002','Miraflores','demo.operativo.piura3','demo.jefe.piura','demo.grifo.miraflores','20000000006','REGULAR'),
            ('V003','Miraflores con Rosa','demo.operativo.piura','demo.jefe.piura2','demo.grifo.miraflores','20000000006','PREMIUM'),
            ('V004','Santa Elena','demo.operativo.sullana2','demo.jefe.sullana2','demo.grifo.santaelena','20000000002','DIESEL_B5'),
            ('V005','Puerto Paita','demo.operativo.paita2','demo.jefe.paita2','demo.grifo.paita','20000000004','REGULAR'),
            ('V006','Costa Talara','demo.operativo.talara2','demo.jefe.talara2','demo.grifo.talara','20000000005','DIESEL_B5')
        ) x(serie, etiqueta, operativo, jefe, grifo, proveedor, suministro)
        JOIN usuario op ON op.login = x.operativo AND op.activo
        JOIN usuario j ON j.login = x.jefe AND j.activo
        JOIN usuario g ON g.login = x.grifo AND g.activo
        JOIN trabajador t ON t.id_trabajador = op.id_trabajador AND t.activo
        JOIN usuario_rol rol_op ON rol_op.id_usuario = op.id_usuario
            AND rol_op.codigo_rol = 'OPERATIVO' AND rol_op.cod_zonal = t.cod_zonal
        JOIN usuario_rol rol_j ON rol_j.id_usuario = j.id_usuario
            AND rol_j.codigo_rol = 'JEFE' AND rol_j.cod_zonal = t.cod_zonal
        JOIN usuario_rol rol_g ON rol_g.id_usuario = g.id_usuario
            AND rol_g.codigo_rol = 'GRIFO' AND rol_g.cod_zonal = t.cod_zonal AND rol_g.cod_proveedor = x.proveedor
    LOOP
        -- Si un usuario agotó o dio de baja un contrato de prueba, se respeta ese cambio.
        IF NOT EXISTS (
            SELECT 1 FROM contrato_vale c JOIN contrato_suministro s USING (cod_contrato)
            WHERE c.ruc = ejemplo.proveedor AND c.activo AND hoy BETWEEN c.fecha_inicio AND c.fecha_fin
                AND s.id_suministro = ejemplo.suministro AND c.monto_disponible >= round(25.50 * s.precio_pactado, 2)
        ) THEN
            CONTINUE;
        END IF;

        PERFORM registrar_vale(ejemplo.emisor, ejemplo.dni, ejemplo.proveedor, ejemplo.suministro, 6,
            'Ejemplo ' || ejemplo.etiqueta || ': por autorizar');
        emitido := registrar_vale(ejemplo.emisor, ejemplo.dni, ejemplo.proveedor, ejemplo.suministro, 8,
            'Ejemplo ' || ejemplo.etiqueta || ': listo para atender');
        PERFORM autorizar_vales(ejemplo.autorizador, ARRAY[emitido.id_vale]);
        emitido := registrar_vale(ejemplo.emisor, ejemplo.dni, ejemplo.proveedor, ejemplo.suministro, 7.50,
            'Ejemplo ' || ejemplo.etiqueta || ': usado sin factura');
        PERFORM autorizar_vales(ejemplo.autorizador, ARRAY[emitido.id_vale]);
        atendido := registrar_atencion(ejemplo.atendedor, emitido.id_vale, hoy, 5.25,
            p_dni_presentado => ejemplo.dni, p_identidad_verificada => true);
        emitido := registrar_vale(ejemplo.emisor, ejemplo.dni, ejemplo.proveedor, ejemplo.suministro, 4,
            'Ejemplo ' || ejemplo.etiqueta || ': anulado');
        PERFORM autorizar_vales(ejemplo.autorizador, ARRAY[emitido.id_vale]);
        PERFORM anular_vale(ejemplo.emisor, emitido.id_vale, 'Se canceló el traslado de prueba.');

        INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total) VALUES
            (ejemplo.proveedor, ejemplo.serie, '000001', hoy, atendido.importe),
            (ejemplo.proveedor, ejemplo.serie, '000002', hoy, atendido.importe + 0.01);
    END LOOP;
END;
$$;
COMMIT;
