package com.servicesvales.compartido.infraestructura;

import com.servicesvales.compartido.dominio.MotorRutas;
import com.servicesvales.compartido.dominio.OperacionException;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.*;

@Component
public class OsrmRutas implements MotorRutas {

  private final HttpClient http = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(3))
    .build();
  private final ObjectMapper json;
  private final String base;
  private final Map<String, Entrada> cache = new LinkedHashMap<>();
  private long ultimaLlamada;

  private record Entrada(long hasta, JsonNode valor) {}

  public OsrmRutas(
    ObjectMapper json,
    @Value("${vales.rutas.url:https://router.project-osrm.org}") String base
  ) {
    this.json = json;
    this.base = base.replaceAll("/+$", "");
    URI u = URI.create(this.base);
    if (
      !List.of("https", "http").contains(u.getScheme()) ||
      u.getHost() == null ||
      u.getUserInfo() != null ||
      u.getQuery() != null
    ) throw new IllegalArgumentException("URL de rutas no válida");
  }

  private String coordenadas(List<Punto> puntos) {
    return puntos
      .stream()
      .map(p -> p.longitud() + "," + p.latitud())
      .collect(Collectors.joining(";"));
  }

  private synchronized JsonNode consultar(String path) {
    long ahora = System.currentTimeMillis();
    var anterior = cache.get(path);
    if (anterior != null && anterior.hasta() > ahora) return anterior.valor();
    try {
      long espera = 1000 - (ahora - ultimaLlamada);
      if (espera > 0) Thread.sleep(espera);
      ultimaLlamada = System.currentTimeMillis();
      var request = HttpRequest.newBuilder(URI.create(base + path))
        .timeout(Duration.ofSeconds(7))
        .header("User-Agent", "ServicesVales/1.0")
        .GET()
        .build();
      var response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (
        response.statusCode() != 200 || response.body().length() > 4000000
      ) throw new IllegalStateException();
      var value = json.readTree(response.body());
      if (
        !"Ok".equals(value.path("code").asText())
      ) throw new IllegalStateException();
      if (cache.size() >= 100) cache.remove(cache.keySet().iterator().next());
      cache.put(path, new Entrada(System.currentTimeMillis() + 300000, value));
      return value;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw noDisponible();
    } catch (Exception e) {
      throw noDisponible();
    }
  }

  private OperacionException noDisponible() {
    return OperacionException.invalida(
      "No se pudo calcular el recorrido vial. Reintenta o selecciona el grifo manualmente."
    );
  }

  @Override
  public Matriz matriz(List<Punto> puntos) {
    var r = consultar(
      "/table/v1/driving/" +
        coordenadas(puntos) +
        "?annotations=distance,duration&radiuses=" +
        String.join(";", Collections.nCopies(puntos.size(), "1500"))
    );
    return new Matriz(
      filas(r.path("distances"), puntos.size()),
      filas(r.path("durations"), puntos.size())
    );
  }

  private Double[][] filas(JsonNode valor, int n) {
    if (valor.size() != n) throw noDisponible();
    Double[][] data = new Double[n][n];
    for (int i = 0; i < n; i++) {
      if (valor.get(i).size() != n) throw noDisponible();
      for (int j = 0; j < n; j++) {
        var v = valor.get(i).get(j);
        if (
          v.isNumber() && Double.isFinite(v.asDouble()) && v.asDouble() >= 0
        ) data[i][j] = v.asDouble();
      }
    }
    return data;
  }

  @Override
  public List<List<Double>> trazado(List<Punto> puntos) {
    return geometria(consultarRuta(puntos).path("routes").path(0));
  }

  @Override
  public Recorrido recorridoOrdenado(List<Punto> puntos) {
    var respuesta = consultarRuta(puntos);
    var ruta = respuesta.path("routes").path(0);
    var accesos = respuesta.path("waypoints");
    if (accesos.size() != puntos.size()) throw noDisponible();
    return new Recorrido(
      geometria(ruta),
      medida(ruta.path("distance")),
      medida(ruta.path("duration")),
      accesos
        .valueStream()
        .map(p -> medida(p.path("distance")))
        .toList()
    );
  }

  private JsonNode consultarRuta(List<Punto> puntos) {
    // Table evalúa cada tramo por separado. Route permite reiniciar la
    // marcha en cada parada para representar ese mismo criterio.
    return consultar(
      "/route/v1/driving/" +
        coordenadas(puntos) +
        "?overview=full&geometries=geojson&steps=false&radiuses=" +
        String.join(";", Collections.nCopies(puntos.size(), "1500")) +
        "&continue_straight=false&generate_hints=false"
    );
  }

  private List<List<Double>> geometria(JsonNode ruta) {
    var resultado = new ArrayList<List<Double>>();
    for (var p : ruta.path("geometry").path("coordinates")) {
      if (!p.path(0).isNumber() || !p.path(1).isNumber()) throw noDisponible();
      try {
        var punto = new Punto(p.get(1).asDouble(), p.get(0).asDouble());
        resultado.add(List.of(punto.latitud(), punto.longitud()));
      } catch (IllegalArgumentException error) {
        throw noDisponible();
      }
    }
    if (resultado.size() < 2) throw noDisponible();
    return resultado;
  }

  private double medida(JsonNode valor) {
    if (valor.isNumber()) {
      double numero = valor.asDouble();
      if (Double.isFinite(numero) && numero >= 0) return numero;
    }
    throw noDisponible();
  }
}
