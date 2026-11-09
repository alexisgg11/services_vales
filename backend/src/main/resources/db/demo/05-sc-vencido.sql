BEGIN;
SET LOCAL search_path = vales, pg_catalog;
SET LOCAL TIME ZONE 'America/Lima';

INSERT INTO proveedor (cod_proveedor, razon_social)
VALUES ('20000000007', 'Grifo Contrato Vencido (demo)');

INSERT INTO contrato_vale (cod_contrato, ruc, monto_total, fecha_inicio, fecha_fin, activo, observacion)
VALUES ('DEMO-SC', '20000000007', 90000, (CURRENT_DATE - interval '1 year')::date,
        CURRENT_DATE - 1, false, 'Contrato vencido para probar un vale S/C de trabajador');

INSERT INTO contrato_suministro (cod_contrato, id_suministro, precio_pactado)
VALUES ('DEMO-SC', 'DIESEL_B5', 19.00);

INSERT INTO persona (dni, nombre, ap_paterno) VALUES ('90000210', 'Renato', 'Paz');
WITH ficha AS (
    INSERT INTO trabajador (dni, cargo) VALUES ('90000210', 'Atención en grifo')
    RETURNING id_trabajador
), cuenta AS (
    INSERT INTO usuario (login, id_trabajador, clave_hash)
    SELECT 'demo.grifo.vencido', id_trabajador, '{bcrypt}$2a$10$gXpzPqhp/pe.F41HIXEI/eifcbu8wanEmnjGdgXzdPUhTTPCwOrXe'
    FROM ficha
    RETURNING id_usuario
)
INSERT INTO usuario_rol (id_usuario, codigo_rol, cod_zonal, cod_proveedor)
SELECT id_usuario, 'GRIFO', '04', '20000000007' FROM cuenta;

SELECT registrar_tarifa((SELECT id_usuario FROM usuario WHERE login = 'demo.admin'),
                        '20000000007', 'DIESEL_B5', CURRENT_DATE, 20.00);

INSERT INTO factura (cod_proveedor, serie, numero, fecha_emision, total)
VALUES ('20000000007', 'SC01', '000001', CURRENT_DATE, 80.00);

COMMIT;
