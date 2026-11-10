package com.servicesvales.local;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;

/** Prepara únicamente la base local y registra cada migración en su propia transacción. */
final class MigradorPostgres {
    static final String APP_USER = "vales_app";
    static final String DATABASE = "services_vales";

    private static final List<String> MIGRACIONES = List.of(
            "migraciones/01-esquema.sql", "migraciones/02-consultas.sql", "migraciones/03-permisos.sql",
            "migraciones/04-administracion.sql", "migraciones/05-documento-qr.sql", "migraciones/06-verificacion-publica.sql",
            "migraciones/07-precios-contrato.sql", "migraciones/08-dni-tercero-atencion.sql",
            "migraciones/09-gastos-modalidad.sql", "migraciones/10-sc-contrato-vencido.sql",
            "migraciones/11-dni-documento-qr.sql");
    private static final List<String> DEMO_ANTERIOR = List.of(
            "demo/01-datos.sql", "demo/02-acceso.sql", "demo/03-historial.sql", "demo/04-cobertura.sql",
            "demo/05-sc-vencido.sql");
    private static final String COPIA_PRUEBA = "datos/copia-prueba.sql";
    private static final List<String> MIGRACIONES_POSTERIORES_A_DATOS = List.of(
            "migraciones/12-unidad-movil-por-vale.sql", "migraciones/13-unidades-por-zonal.sql",
            "migraciones/14-conciliacion-tickets-ubicaciones.sql");

    private MigradorPostgres() {}

    static void preparar(String urlServidor, String urlAplicacion, String propietario,
                         String clavePropietario, String appPassword) throws Exception {
        try (Connection connection = DriverManager.getConnection(urlServidor, propietario, clavePropietario);
             var statement = connection.createStatement()) {
            try (var result = statement.executeQuery("SELECT 1 FROM pg_roles WHERE rolname = 'vales_app'")) {
                if (!result.next()) {
                    result.close();
                    statement.execute("CREATE ROLE vales_app LOGIN PASSWORD '" + appPassword + "'");
                }
            }
            try (var result = statement.executeQuery("SELECT 1 FROM pg_database WHERE datname = 'services_vales'")) {
                if (!result.next()) {
                    result.close();
                    statement.execute("CREATE DATABASE services_vales");
                }
            }
        }
        try (Connection connection = DriverManager.getConnection(urlAplicacion, propietario, clavePropietario)) {
            try (var statement = connection.createStatement()) {
                statement.execute("""
                        CREATE TABLE IF NOT EXISTS public.vales_migracion (
                            archivo text PRIMARY KEY, aplicado_en timestamptz NOT NULL DEFAULT now()
                        )
                        """);
            }
            for (String migration : MIGRACIONES) migrar(connection, migration);
            if (aplicada(connection, DEMO_ANTERIOR.get(0))) {
                for (String migration : DEMO_ANTERIOR) migrar(connection, migration);
            } else {
                migrar(connection, COPIA_PRUEBA);
            }
            for (String migration : MIGRACIONES_POSTERIORES_A_DATOS) migrar(connection, migration);
        }
    }

    private static boolean aplicada(Connection connection, String name) throws SQLException {
        try (var check = connection.prepareStatement("SELECT 1 FROM public.vales_migracion WHERE archivo = ?")) {
            check.setString(1, name);
            try (var result = check.executeQuery()) {
                return result.next();
            }
        }
    }

    private static void migrar(Connection connection, String name) throws IOException, SQLException {
        if (aplicada(connection, name)) return;
        String sql;
        try (InputStream stream = BaseLocal.class.getResourceAsStream("/db/" + name)) {
            if (stream == null) throw new IOException("No se encontró la migración " + name);
            sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8)
                    .replaceFirst("(?m)^BEGIN;\\s*$", "")
                    .replaceFirst("(?m)^COMMIT;\\s*$", "");
        }
        connection.setAutoCommit(false);
        try (var script = connection.createStatement();
             var insert = connection.prepareStatement("INSERT INTO public.vales_migracion (archivo) VALUES (?)")) {
            script.execute(sql);
            insert.setString(1, name);
            insert.executeUpdate();
            connection.commit();
        } catch (SQLException error) {
            connection.rollback();
            throw new SQLException("No se pudo aplicar " + name, error.getSQLState(), error);
        } finally {
            connection.setAutoCommit(true);
        }
    }
}
