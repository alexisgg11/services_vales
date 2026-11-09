-- Ejecutar con psql en una base nueva de pruebas, desde la cuenta propietaria.
\set ON_ERROR_STOP on
\encoding UTF8

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
\if :{?datos_relativos}
\ir demo/01-datos.sql
\ir demo/02-acceso.sql
\ir demo/03-historial.sql
\ir demo/04-cobertura.sql
\ir demo/05-sc-vencido.sql
\else
\ir datos/copia-prueba.sql
\endif

SELECT count(*) AS vales_de_prueba, count(DISTINCT cod_zonal) AS zonales FROM vales.vales;
