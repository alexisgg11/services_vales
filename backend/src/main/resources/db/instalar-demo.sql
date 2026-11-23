-- Ejecutar con psql en una base nueva de pruebas, desde la cuenta propietaria.
\set ON_ERROR_STOP on
\encoding UTF8

\set clave_demo ''
\getenv clave_demo VALES_DEMO_PASSWORD
SELECT char_length(:'clave_demo') >= 8
    AND octet_length(:'clave_demo') <= 72 AS clave_demo_valida
\gset
\if :clave_demo_valida
\else
DO $$
BEGIN
    RAISE EXCEPTION 'Configura VALES_DEMO_PASSWORD antes de instalar los datos de prueba. Debe tener al menos 8 caracteres y como máximo 72 bytes.';
END;
$$;
\endif

DO $$
BEGIN
    IF to_regnamespace('vales') IS NOT NULL THEN
        RAISE EXCEPTION 'Usa una base nueva. Esta base ya contiene el esquema vales.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vales_app') THEN
        CREATE ROLE vales_app NOLOGIN;
    END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
SELECT n.nspname AS esquema_pgcrypto
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pgcrypto'
\gset
SELECT set_config(
    'vales.demo_clave_hash',
    '{bcrypt}' || :"esquema_pgcrypto".crypt(:'clave_demo', :"esquema_pgcrypto".gen_salt('bf', 10)),
    false
) AS credencial_demo_preparada
\gset
\unset clave_demo
\unset credencial_demo_preparada

\ir migraciones/01-esquema.sql
\ir migraciones/02-consultas.sql
\ir migraciones/03-permisos.sql
\ir migraciones/04-administracion.sql
\ir migraciones/05-documento-qr.sql
\ir migraciones/06-verificacion-publica.sql
\ir migraciones/07-precios-contrato.sql
\ir migraciones/08-dni-tercero-atencion.sql
\ir migraciones/09-gastos-modalidad.sql
\ir migraciones/10-sc-contrato-vencido.sql
\ir migraciones/11-dni-documento-qr.sql
\ir demo/01-datos.sql
\ir demo/02-acceso.sql
\ir demo/03-historial.sql
\ir demo/04-cobertura.sql
\ir demo/05-sc-vencido.sql

\ir migraciones/12-unidad-movil-por-vale.sql
\ir migraciones/13-unidades-por-zonal.sql
\ir migraciones/14-conciliacion-tickets-ubicaciones.sql
\ir migraciones/15-asociacion-desde-vales.sql
\ir migraciones/16-modulos-facturacion-identidad.sql
\ir migraciones/17-vinculo-factura-emitida.sql
\ir migraciones/18-rutas-trabajo.sql
\ir migraciones/19-punto-partida-ruta.sql
\ir migraciones/20-despacho-guiado.sql
\ir migraciones/21-consistencia-operativa.sql
\ir migraciones/22-ubicaciones-centros-costo.sql
\ir migraciones/23-rutas-quince-paradas.sql

SELECT count(*) AS vales_de_prueba, count(DISTINCT cod_zonal) AS zonales FROM vales.vales;
