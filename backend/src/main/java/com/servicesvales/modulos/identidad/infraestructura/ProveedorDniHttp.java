package com.servicesvales.modulos.identidad.infraestructura;

import com.servicesvales.compartido.dominio.OperacionException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class ProveedorDniHttp {

  public record Resultado(String nombre, String origen) {}

  private final ObjectMapper json;
  private final String url, token;
  private final HttpClient http = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(4))
    .build();

  public ProveedorDniHttp(
    ObjectMapper json,
    @Value("${vales.dni.url:}") String url,
    @Value("${vales.dni.token:}") String token
  ) {
    this.json = json;
    this.url = url.strip().replaceFirst("/+$", "");
    this.token = token.strip();
  }

  public Resultado consultar(String proveedor, String dni) {
    return switch (proveedor) {
      case "apisperu" -> consultarApisPeru(dni);
      case "decolecta" -> consultarDecolecta(dni);
      default -> throw OperacionException.invalida(
        "Selecciona apisperu, decolecta o demo en VALES_DNI_PROVIDER."
      );
    };
  }

  private Resultado consultarApisPeru(String dni) {
    var datos = obtener(
      peticion(
        "/dni/" +
          dni +
          "?token=" +
          URLEncoder.encode(token, StandardCharsets.UTF_8),
        false
      )
    );
    if (!datos.path("success").asBoolean(true)) {
      throw OperacionException.invalida(
        "APIs Perú no pudo confirmar el DNI. Revisa el número y el acceso al proveedor."
      );
    }
    String nombres = datos.path("nombres").asText("").strip();
    String paterno = datos.path("apellidoPaterno").asText("").strip();
    String materno = datos.path("apellidoMaterno").asText("").strip();
    if (nombres.isEmpty() || (paterno.isEmpty() && materno.isEmpty())) {
      throw OperacionException.invalida(
        "APIs Perú devolvió un nombre o apellidos incompletos."
      );
    }
    String nombre = Stream.of(nombres, paterno, materno)
      .filter(parte -> !parte.isEmpty())
      .collect(Collectors.joining(" "));
    return confirmar(dni, datos.path("dni").asText(""), nombre, "APIs Perú");
  }

  private Resultado consultarDecolecta(String dni) {
    var datos = obtener(peticion("/dni?numero=" + dni, true));
    return confirmar(
      dni,
      datos.path("document_number").asText(""),
      datos.path("full_name").asText("").strip(),
      "Decolecta"
    );
  }

  private HttpRequest.Builder peticion(String consulta, boolean usarBearer) {
    if (url.isEmpty() || token.isEmpty()) {
      throw OperacionException.invalida(
        "Configura VALES_DNI_URL y VALES_DNI_TOKEN para consultar un DNI nuevo."
      );
    }
    try {
      var base = URI.create(url);
      if (
        base.getHost() != null &&
        ("https".equals(base.getScheme()) || "http".equals(base.getScheme())) &&
        base.getRawUserInfo() == null &&
        base.getRawQuery() == null &&
        base.getRawFragment() == null
      ) {
        var peticion = HttpRequest.newBuilder(URI.create(url + consulta))
          .timeout(Duration.ofSeconds(6))
          .header("Accept", "application/json");
        return usarBearer
          ? peticion.header("Authorization", "Bearer " + token)
          : peticion;
      }
    } catch (IllegalArgumentException e) {
      // No incluir la configuración ni el token en el error.
    }
    throw OperacionException.invalida(
      "Revisa la dirección VALES_DNI_URL y el formato de VALES_DNI_TOKEN."
    );
  }

  private JsonNode obtener(HttpRequest.Builder peticion) {
    try {
      var respuesta = http.send(
        peticion.GET().build(),
        HttpResponse.BodyHandlers.ofString()
      );
      return switch (respuesta.statusCode()) {
        case 200 -> {
          var datos = json.readTree(respuesta.body());
          if (datos == null || !datos.isObject()) {
            throw OperacionException.invalida(
              "El proveedor devolvió una respuesta de DNI inválida."
            );
          }
          yield datos;
        }
        case 401, 403 -> throw OperacionException.invalida(
          "El proveedor de DNI rechazó el token. Revisa VALES_DNI_TOKEN."
        );
        case 404 -> throw OperacionException.invalida(
          "El proveedor no encontró ese DNI."
        );
        case 429 -> throw OperacionException.invalida(
          "El proveedor alcanzó su límite de consultas de DNI."
        );
        default -> throw OperacionException.invalida(
          "El proveedor de DNI no está disponible. Vuelve a intentarlo."
        );
      };
    } catch (OperacionException e) {
      throw e;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw OperacionException.invalida("La consulta de DNI fue interrumpida.");
    } catch (Exception e) {
      throw OperacionException.invalida(
        "No se pudo consultar el proveedor de DNI. Vuelve a intentarlo."
      );
    }
  }

  private Resultado confirmar(
    String dni,
    String documento,
    String nombre,
    String proveedor
  ) {
    if (
      !dni.equals(documento) || nombre.length() < 3 || nombre.length() > 150
    ) {
      throw OperacionException.invalida(
        "El proveedor devolvió datos de identidad incompletos o de otro DNI."
      );
    }
    return new Resultado(nombre, "Proveedor externo " + proveedor);
  }
}
