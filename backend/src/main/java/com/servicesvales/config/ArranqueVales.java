package com.servicesvales.config;

import com.servicesvales.local.BaseLocal;
import com.servicesvales.local.EntornoLocal;
import java.nio.file.Path;
import org.springframework.boot.SpringApplication;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.env.MapPropertySource;

public final class ArranqueVales {

  private ArranqueVales() {}

  public static void iniciar(
    Class<?> aplicacion,
    String[] args
  ) throws Exception {
    var configuracion = EntornoLocal.cargarConfiguracion();
    var baseExterna = EntornoLocal.propiedadesBaseConfigurada(configuracion);
    var directorio = EntornoLocal.directorio(configuracion);
    if (System.getProperty("jdk.net.unixdomain.tmpdir") == null) {
      System.setProperty(
        "jdk.net.unixdomain.tmpdir",
        Path.of(".").toAbsolutePath().normalize().toString()
      );
    }

    var propiedades = EntornoLocal.propiedadesWeb(directorio, configuracion);
    var app = new SpringApplication(aplicacion);
    app.addInitializers(contexto ->
      contexto
        .getEnvironment()
        .getPropertySources()
        .addFirst(new MapPropertySource("vales-entorno", propiedades))
    );

    if (!baseExterna.isEmpty()) {
      propiedades.putAll(baseExterna);
      app.run(args);
      return;
    }

    BaseLocal base = BaseLocal.iniciar(
      directorio,
      configuracion.getProperty("VALES_PG_BIN")
    );
    try {
      propiedades.putAll(base.propiedades());
      app.addInitializers((GenericApplicationContext contexto) -> {
        var beans = contexto.getDefaultListableBeanFactory();
        beans.registerSingleton("postgresLocal", base);
        beans.registerDisposableBean("postgresLocal", base::close);
      });
      app.run(args);
    } catch (Exception | Error error) {
      base.close();
      throw error;
    }
  }
}
