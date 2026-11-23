package com.servicesvales.config;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
final class AvisoArranque {

  @EventListener
  void informar(ApplicationReadyEvent evento) {
    if (
      evento.getApplicationContext() instanceof
        ServletWebServerApplicationContext web
    ) {
      String direccion = web
        .getEnvironment()
        .getProperty(
          "vales.local.start-url",
          "http://127.0.0.1:" + web.getWebServer().getPort()
        );
      System.out.println("Vales listo en " + direccion);
    }
  }
}
