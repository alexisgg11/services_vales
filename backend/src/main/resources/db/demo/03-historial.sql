-- Historial ficticio para la instalación local. Cada vale recorre las operaciones del sistema.
BEGIN;
SET LOCAL search_path = vales, pg_catalog;
SET LOCAL TIME ZONE 'America/Lima';

INSERT INTO proveedor VALUES
    ('20000000004', 'Estación Puerto Paita (demo)'),
    ('20000000005', 'Grifo Costa Talara (demo)');

INSERT INTO asignacion_costo VALUES ('0800', '90321109'), ('0840', '90214301');
INSERT INTO unidad_maquinaria (descripcion, tipo_vehiculo, placa) VALUES
    ('Camioneta operativa Paita', 'Camioneta', 'DEM-303'),
    ('Camión de servicio Talara', 'Camión', 'DEM-404');

WITH cuentas(dni, nombre, apellido, login, cargo, rol, zonal, localidad, grifo, unidad, centro, placa) AS (
    VALUES
        ('90000011','Julia','Rojas','demo.operativo.paita','Chofer','OPERATIVO','03','13',NULL,'0800','90321109','DEM-303'),
        ('90000012','Hugo','Silva','demo.jefe.paita','Jefe zonal','JEFE','03','13',NULL,'0800','90321109',NULL),
        ('90000013','Paola','Vega','demo.grifo.paita','Atención en grifo','GRIFO','03','13','20000000004',NULL,NULL,NULL),
        ('90000014','Mario','Luna','demo.operativo.talara','Chofer','OPERATIVO','05','37',NULL,'0840','90214301','DEM-404'),
        ('90000015','Clara','Ruiz','demo.jefe.talara','Jefa zonal','JEFE','05','37',NULL,'0840','90214301',NULL),
        ('90000016','Sergio','Cruz','demo.grifo.talara','Atención en grifo','GRIFO','05','37','20000000005',NULL,NULL,NULL)
), personas AS (
    INSERT INTO persona (dni, nombre, ap_paterno)
    SELECT dni, nombre, apellido FROM cuentas
    RETURNING dni
), trabajadores AS (
    INSERT INTO trabajador (dni, cargo, cod_zonal, cod_localidad, cod_uni_organizativa,
                            cod_centro_costo, codigo_unidad_movil)
    SELECT c.dni, c.cargo, c.zonal, c.localidad, c.unidad, c.centro, m.codigo
    FROM cuentas c JOIN personas USING (dni)
    LEFT JOIN unidad_maquinaria m ON m.placa = c.placa
    RETURNING dni, id_trabajador
), usuarios AS (
    INSERT INTO usuario (login, id_trabajador, clave_hash)
    SELECT c.login, t.id_trabajador, (SELECT clave_hash FROM usuario WHERE login = 'demo.admin')
    FROM cuentas c JOIN trabajadores t USING (dni)
    RETURNING id_usuario, login
)
INSERT INTO usuario_rol (id_usuario, codigo_rol, cod_zonal, cod_proveedor)
SELECT u.id_usuario, c.rol, c.zonal, c.grifo FROM usuarios u JOIN cuentas c USING (login);

INSERT INTO persona (dni, nombre, ap_paterno) VALUES
    ('90000017','Mariana','Pérez'), ('90000018','Jorge','Campos');
INSERT INTO trabajador (dni, cargo, cod_zonal, cod_localidad, cod_uni_organizativa, cod_centro_costo)
VALUES ('90000017','Operativa','01','05','0800','90211214'),
       ('90000018','Operativo','03','13','0800','90321109');

UPDATE contrato_vale SET monto_total = 45000 WHERE cod_contrato IN ('DEMO-A','DEMO-B');
INSERT INTO contrato_vale (cod_contrato, ruc, monto_total, fecha_inicio, fecha_fin, observacion) VALUES
    ('DEMO-D', '20000000004', 37000, '2020-01-01', '2099-12-31', 'Abastecimiento de Paita'),
    ('DEMO-E', '20000000005', 42000, '2020-01-01', '2099-12-31', 'Abastecimiento de Talara');
INSERT INTO contrato_suministro VALUES
    ('DEMO-D','REGULAR',21.65), ('DEMO-D','DIESEL_B5',24.80), ('DEMO-D','PREMIUM',24.20),
    ('DEMO-E','REGULAR',22.10), ('DEMO-E','DIESEL_B5',25.25), ('DEMO-E','PREMIUM',24.70);

DO $$
DECLARE
    hoy date := CURRENT_DATE;
    admin integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.admin');
    contador integer := (SELECT id_usuario FROM usuario WHERE login = 'demo.contabilidad');
    sucursal record;
    mes integer;
    caso integer;
    inicio date;
    fecha date;
    consumo date;
    fecha_factura date;
    serie text;
    combustible text;
    gl numeric;
    emitido vales;
    atendido vales;
    por_facturar bigint[];
    total_factura numeric;
    pendiente numeric;
    nro_factura bigint;
    momento_emision timestamptz;
    momento_autorizacion timestamptz;
    momento_atencion timestamptz;
    momento_anulacion timestamptz;
    momento_factura timestamptz;
BEGIN
    PERFORM registrar_tarifa(admin,'20000000004','REGULAR','2020-01-01',21.75);
    PERFORM registrar_tarifa(admin,'20000000005','REGULAR','2020-01-01',22.25);
    PERFORM registrar_tarifa(admin,'20000000004','GLP','2020-01-01',8.30);
    FOR sucursal IN
        SELECT x.*, t.dni, op.id_usuario AS emisor, jefe.id_usuario AS autorizador, grifo.id_usuario AS atendedor
        FROM (VALUES
            (1,'piura','algarrobos','20000000001'),
            (2,'sullana','santaelena','20000000002'),
            (3,'paita','paita','20000000004'),
            (4,'talara','talara','20000000005')
        ) x(n, zona, punto, proveedor)
        JOIN usuario op ON op.login = 'demo.operativo.' || x.zona
        JOIN usuario jefe ON jefe.login = 'demo.jefe.' || x.zona
        JOIN usuario grifo ON grifo.login = 'demo.grifo.' || x.punto
        JOIN trabajador t ON t.id_trabajador = op.id_trabajador
    LOOP
        serie := 'H00' || sucursal.n;
        FOR mes IN REVERSE 6..0 LOOP
            inicio := (date_trunc('month', hoy) - make_interval(months => mes))::date;
            por_facturar := ARRAY[]::bigint[];
            total_factura := 0;
            pendiente := 0;
            FOR caso IN 1..5 LOOP
                fecha := CASE WHEN mes = 0 THEN hoy ELSE inicio + (2 + caso * 2 + sucursal.n) END;
                consumo := least(hoy, fecha + 1);
                combustible := CASE WHEN (mes + caso) % 2 = 0 THEN 'REGULAR' ELSE 'DIESEL_B5' END;
                gl := 4 + sucursal.n + caso + (mes % 4);
                emitido := registrar_vale(sucursal.emisor, sucursal.dni, sucursal.proveedor,
                    combustible, gl, format('Historial %s %s: %s', to_char(inicio, 'YYYY-MM'), sucursal.zona,
                        (ARRAY['Inspección de campo','Traslado operativo','Apoyo a cuadrilla',
                               'Comisión reprogramada','Mantenimiento de instalaciones'])[caso]),
                    p_fecha => fecha);
                momento_emision := least(clock_timestamp(), (fecha + time '07:30') AT TIME ZONE 'America/Lima');
                momento_autorizacion := least(clock_timestamp(), (fecha + time '08:00') AT TIME ZONE 'America/Lima');
                momento_atencion := least(clock_timestamp(), (consumo + time '11:20') AT TIME ZONE 'America/Lima');
                momento_anulacion := least(clock_timestamp(), (fecha + time '10:00') AT TIME ZONE 'America/Lima');
                UPDATE vales SET registrado_en = momento_emision WHERE id_vale = emitido.id_vale;
                UPDATE historial_vale SET fecha = momento_emision
                    WHERE id_vale = emitido.id_vale AND accion = 'EMISION';

                IF mes > 0 OR caso <> 1 THEN
                    PERFORM autorizar_vales(sucursal.autorizador, ARRAY[emitido.id_vale]);
                    UPDATE vales SET fecha_autorizacion = momento_autorizacion WHERE id_vale = emitido.id_vale;
                    UPDATE historial_vale SET fecha = momento_autorizacion
                        WHERE id_vale = emitido.id_vale AND accion = 'AUTORIZACION';
                END IF;
                IF caso = 4 THEN
                    PERFORM anular_vale(sucursal.emisor, emitido.id_vale, 'Se reprogramó la comisión.');
                    UPDATE vales SET fecha_anulacion = momento_anulacion WHERE id_vale = emitido.id_vale;
                    UPDATE historial_vale SET fecha = momento_anulacion
                        WHERE id_vale = emitido.id_vale AND accion = 'ANULACION';
                ELSIF (mes > 0 AND caso IN (1,2,3)) OR (mes = 0 AND caso IN (3,5)) THEN
                    atendido := registrar_atencion(sucursal.atendedor, emitido.id_vale, consumo, gl - 0.75,
                        p_dni_presentado => sucursal.dni, p_identidad_verificada => true);
                    UPDATE vales SET registrado_atencion_en = momento_atencion WHERE id_vale = atendido.id_vale;
                    UPDATE historial_vale SET fecha = momento_atencion
                        WHERE id_vale = atendido.id_vale AND accion = 'ATENCION';
                    IF caso = 3 THEN
                        pendiente := atendido.importe;
                    ELSE
                        por_facturar := array_append(por_facturar, atendido.id_vale);
                        total_factura := total_factura + atendido.importe;
                    END IF;
                END IF;
            END LOOP;
            fecha_factura := CASE WHEN mes = 0 THEN hoy ELSE (inicio + interval '1 month')::date END;
            momento_factura := least(clock_timestamp(), (fecha_factura + time '14:00') AT TIME ZONE 'America/Lima');
            INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total)
            VALUES (sucursal.proveedor, serie, to_char(inicio,'YYYYMM') || '01', fecha_factura, total_factura)
            RETURNING codigo_factura INTO nro_factura;
            PERFORM asociar_factura(contador, nro_factura, por_facturar);
            UPDATE factura SET fecha_asociacion = momento_factura WHERE codigo_factura = nro_factura;
            UPDATE historial_vale SET fecha = momento_factura
                WHERE id_vale = ANY(por_facturar) AND accion = 'FACTURA';
            INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total)
            VALUES (sucursal.proveedor, serie, to_char(inicio,'YYYYMM') || '02', fecha_factura, pendiente);
            IF mes = 0 THEN
                INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total)
                VALUES (sucursal.proveedor, serie, to_char(inicio,'YYYYMM') || '03', hoy, pendiente + 0.01);
            END IF;
        END LOOP;
    END LOOP;

    emitido := registrar_vale((SELECT id_usuario FROM usuario WHERE login='demo.operativo.piura'),
        '90000001','20000000002','REGULAR',5,'Prueba QR: misma zonal y otro grifo');
    PERFORM autorizar_vales((SELECT id_usuario FROM usuario WHERE login='demo.jefe.piura'), ARRAY[emitido.id_vale]);
    emitido := registrar_vale((SELECT id_usuario FROM usuario WHERE login='demo.operativo.paita'),
        '90000011','20000000001','REGULAR',5,'Prueba QR: mismo grifo y otra zonal');
    PERFORM autorizar_vales((SELECT id_usuario FROM usuario WHERE login='demo.jefe.paita'), ARRAY[emitido.id_vale]);
END;
$$;
COMMIT;
