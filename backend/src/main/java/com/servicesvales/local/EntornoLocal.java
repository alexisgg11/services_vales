package com.servicesvales.local;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

/** Configuración del servidor web y de la conexión a PostgreSQL. */
public final class EntornoLocal {

  static final String HOST = "127.0.0.1";
  private static final Path ARCHIVO_ENV = Path.of(".env");

  private EntornoLocal() {}

  public static Path directorio(Properties configuracion) {
    return Path.of(configuracion.getProperty("VALES_LOCAL_DIR", ".local"))
      .toAbsolutePath()
      .normalize();
  }

  public static Properties cargarConfiguracion() throws IOException {
    var env = new Properties();
    if (Files.isRegularFile(ARCHIVO_ENV)) {
      try (var reader = Files.newBufferedReader(ARCHIVO_ENV)) {
        env.load(reader);
      }
    } else if (!"externa".equals(System.getenv("VALES_DB_MODE"))) {
      throw new IOException(
        "Falta .env. Copia .env.example a .env o configura las variables de PostgreSQL en modo externa."
      );
    }
    System.getenv().forEach((clave, valor) -> {
      if (clave.startsWith("VALES_")) env.setProperty(clave, valor);
    });
    return env;
  }

  public static Map<String, Object> propiedadesBaseConfigurada(
    Properties env
  ) throws IOException {
    String modo = env.getProperty("VALES_DB_MODE", "").strip();
    if ("local".equals(modo)) return Map.of();
    if (!"externa".equals(modo)) throw new IOException(
      "Define VALES_DB_MODE como local o externa."
    );
    String url = env.getProperty("VALES_DB_URL", "").strip();
    String usuario = env.getProperty("VALES_DB_USER", "").strip();
    String clave = env.getProperty("VALES_DB_PASSWORD", "");
    if (
      !url.startsWith("jdbc:postgresql://") ||
      usuario.isEmpty() ||
      clave.isBlank()
    ) throw new IOException(
      "Completa VALES_DB_URL, VALES_DB_USER y VALES_DB_PASSWORD."
    );
    return Map.of(
      "spring.datasource.url",
      url,
      "spring.datasource.username",
      usuario,
      "spring.datasource.password",
      clave
    );
  }

  public static Map<String, Object> propiedadesWeb(
    Path directorio,
    Properties configuracion
  ) throws Exception {
    String puertoConfigurado = configuracion.getProperty(
      "VALES_PORT",
      System.getenv("PORT")
    );
    int puerto =
      puertoConfigurado == null
        ? puertoWeb()
        : Integer.parseInt(puertoConfigurado);
    String origen = configuracion.getProperty(
      "VALES_PUBLIC_BASE_URL",
      "http://" + HOST + ":" + puerto
    );
    var propiedades = new HashMap<String, Object>(
      Map.of(
        "server.port",
        puerto,
        "server.address",
        configuracion.getProperty("VALES_BIND_ADDRESS", HOST),
        "server.servlet.session.cookie.secure",
        configuracion.getProperty("VALES_SECURE_COOKIES", "false"),
        "vales.public-base-url",
        origen
      )
    );
    propiedades.putAll(
      HttpsRedLocal.preparar(directorio, configuracion, puerto)
    );
    propiedades.put(
      "vales.dni.proveedor",
      configuracion.getProperty("VALES_DNI_PROVIDER", "demo")
    );
    propiedades.put(
      "vales.dni.token",
      configuracion.getProperty("VALES_DNI_TOKEN", "")
    );
    propiedades.put(
      "vales.rutas.url",
      configuracion.getProperty(
        "VALES_ROUTING_URL",
        "https://router.project-osrm.org"
      )
    );
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
    try (
      var socket = new ServerSocket(puerto, 1, InetAddress.getByName(HOST))
    ) {
      return socket.getLocalPort();
    }
  }
}
