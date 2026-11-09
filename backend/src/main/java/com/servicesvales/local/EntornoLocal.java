package com.servicesvales.local;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

/** Configuración local del servidor web y de una base PostgreSQL ya preparada. */
public final class EntornoLocal {
    static final String HOST = "127.0.0.1";
    private static final Path ARCHIVO_ENV = Path.of(".env");

    private EntornoLocal() {}

    public static Path directorio() {
        return Path.of(System.getenv().getOrDefault("VALES_LOCAL_DIR", ".local")).toAbsolutePath().normalize();
    }

    public static Properties cargarConfiguracion() throws IOException {
        if (!Files.isRegularFile(ARCHIVO_ENV))
            throw new IOException("Falta .env. Ejecuta Vales desde VS Code o copia .env.example a .env.");
        var env = new Properties();
        try (var reader = Files.newBufferedReader(ARCHIVO_ENV)) {
            env.load(reader);
        }
        return env;
    }

    public static Map<String, Object> propiedadesBaseConfigurada(Properties env) throws IOException {
        String modo = env.getProperty("VALES_DB_MODE", "").strip();
        if ("local".equals(modo)) return Map.of();
        if (!"externa".equals(modo))
            throw new IOException("Define VALES_DB_MODE como local o externa en .env.");
        String url = env.getProperty("VALES_DB_URL", "").strip();
        String usuario = env.getProperty("VALES_DB_USER", "").strip();
        String clave = env.getProperty("VALES_DB_PASSWORD", "");
        if (!url.startsWith("jdbc:postgresql://") || usuario.isEmpty() || clave.isBlank())
            throw new IOException("Completa VALES_DB_URL, VALES_DB_USER y VALES_DB_PASSWORD en .env.");
        return Map.of(
                "spring.datasource.url", url,
                "spring.datasource.username", usuario,
                "spring.datasource.password", clave);
    }

    public static Map<String, Object> propiedadesWeb(Path directorio, Properties configuracion) throws Exception {
        String puertoConfigurado = System.getenv("VALES_PORT");
        int puerto = puertoConfigurado == null ? puertoWeb() : Integer.parseInt(puertoConfigurado);
        String origen = System.getenv().getOrDefault("VALES_PUBLIC_BASE_URL", "http://" + HOST + ":" + puerto);
        var propiedades = new HashMap<String, Object>(Map.of(
                "server.port", puerto,
                "server.address", System.getenv().getOrDefault("VALES_BIND_ADDRESS", HOST),
                "vales.public-base-url", origen));
        propiedades.putAll(HttpsRedLocal.preparar(directorio, configuracion, puerto));
        return propiedades;
    }

    private static int puertoWeb() throws IOException {
        try {
            return puertoLibre(8080);
        } catch (IOException ocupado) {
            return puertoLibre(0);
        }
    }

    static int puertoLibre(int puerto) throws IOException {
        try (var socket = new ServerSocket(puerto, 1, InetAddress.getByName(HOST))) {
            return socket.getLocalPort();
        }
    }
}
