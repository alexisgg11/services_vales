package com.servicesvales;

import com.servicesvales.local.BaseLocal;
import com.servicesvales.local.EntornoLocal;
import java.nio.file.Path;
import java.util.Map;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.MapPropertySource;

@SpringBootApplication
public class ServicesValesApplication {
    public static void main(String[] args) throws Exception {
        SpringApplication app = new SpringApplication(ServicesValesApplication.class);
        app.addListeners((ApplicationListener<ApplicationReadyEvent>) event -> {
            if (event.getApplicationContext() instanceof ServletWebServerApplicationContext web) {
                String direccion = web.getEnvironment().getProperty("vales.local.start-url",
                        "http://127.0.0.1:" + web.getWebServer().getPort());
                System.out.println("Vales listo en " + direccion);
            }
        });
        var configuracion = EntornoLocal.cargarConfiguracion();
        var baseConfigurada = EntornoLocal.propiedadesBaseConfigurada(configuracion);
        if (System.getProperty("jdk.net.unixdomain.tmpdir") == null)
            System.setProperty("jdk.net.unixdomain.tmpdir", Path.of(".").toAbsolutePath().normalize().toString());
        Path directorio = EntornoLocal.directorio();
        var propiedades = EntornoLocal.propiedadesWeb(directorio, configuracion);
        if (!baseConfigurada.isEmpty()) {
            propiedades.putAll(baseConfigurada);
            iniciar(app, propiedades, args);
            return;
        }
        BaseLocal local = BaseLocal.iniciar(directorio);
        Runtime.getRuntime().addShutdownHook(new Thread(local::close, "postgres-local"));
        try {
            propiedades.putAll(local.propiedades());
            iniciar(app, propiedades, args);
        } catch (Exception error) {
            local.close();
            throw error;
        }
    }

    private static void iniciar(SpringApplication app, Map<String, Object> propiedades, String[] args) {
        app.addInitializers(context -> context.getEnvironment().getPropertySources()
                .addFirst(new MapPropertySource("vales-local", propiedades)));
        app.run(args);
    }
}
