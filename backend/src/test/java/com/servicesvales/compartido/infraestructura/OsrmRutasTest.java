package com.servicesvales.compartido.infraestructura;

import static org.junit.jupiter.api.Assertions.*;

import com.servicesvales.compartido.dominio.MotorRutas.Punto;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class OsrmRutasTest {

  @Test
  void trazaElRecorridoConElMismoCriterioDeParadasEnEmisionYJefatura() throws IOException {
    var consulta = new AtomicReference<String>();
    var osrm = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    osrm.createContext("/route/v1/driving/", intercambio -> {
      consulta.set(intercambio.getRequestURI().getRawQuery());
      byte[] respuesta = """
      {
        "code": "Ok",
        "routes": [{
          "distance": 2000,
          "duration": 180,
          "geometry": {"coordinates": [[-80.6, -5.2], [-80.61, -5.21]]}
        }],
        "waypoints": [{"distance": 1}, {"distance": 2}]
      }
      """.getBytes(StandardCharsets.UTF_8);
      try {
        intercambio.sendResponseHeaders(200, respuesta.length);
        intercambio.getResponseBody().write(respuesta);
      } finally {
        intercambio.close();
      }
    });
    osrm.start();
    try {
      var motor = new OsrmRutas(
        new ObjectMapper(),
        "http://127.0.0.1:" + osrm.getAddress().getPort()
      );
      var puntos = List.of(new Punto(-5.2, -80.6), new Punto(-5.21, -80.61));

      var trazado = motor.trazado(puntos);

      assertTrue(
        List.of(consulta.get().split("&")).contains("continue_straight=false")
      );
      assertEquals(
        List.of(List.of(-5.2, -80.6), List.of(-5.21, -80.61)),
        trazado
      );
      assertEquals(trazado, motor.recorridoOrdenado(puntos).trazado());
    } finally {
      osrm.stop(0);
    }
  }
}
