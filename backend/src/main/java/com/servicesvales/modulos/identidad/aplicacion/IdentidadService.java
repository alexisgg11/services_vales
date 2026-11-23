package com.servicesvales.modulos.identidad.aplicacion;

import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.identidad.infraestructura.IdentidadRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class IdentidadService {

  public record Identidad(String documento, String nombre, String origen) {}

  private final IdentidadRepository repository;
  private final UsuarioService usuarios;
  private final ObjectMapper json;
  private final String proveedor, token;
  private final HttpClient http = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(4))
    .build();
  private final Map<Integer, Long> ultimaConsulta = new ConcurrentHashMap<>();

  private record ConsultaReciente(Identidad persona, long vence) {}

  private final Map<String, ConsultaReciente> consultasRecientes =
    new ConcurrentHashMap<>();

  public IdentidadService(
    IdentidadRepository repository,
    UsuarioService usuarios,
    ObjectMapper json,
    @Value("${vales.dni.proveedor:demo}") String proveedor,
    @Value("${vales.dni.token:}") String token
  ) {
    this.repository = repository;
    this.usuarios = usuarios;
    this.json = json;
    this.proveedor = proveedor;
    this.token = token;
  }

  public Identidad consultar(String login, String dni) {
    return consultar(usuarios.identificarActor(login), dni);
  }

  public Identidad consultar(int actor, String dni) {
    if (
      dni == null || !dni.matches("[0-9]{8}")
    ) throw OperacionException.invalida("Indica un DNI de ocho dígitos.");
    var local = repository.consultar(actor, dni); // Also checks role before any external request.
    if (local != null) return new Identidad(
      dni,
      local.path("nombre").asText(),
      "Catálogo local"
    );
    if ("demo".equals(proveedor)) {
      String nombre = Map.of(
        "99000001",
        "Ana Torres Rojas",
        "99000002",
        "Luis Rivera Prado"
      ).get(dni);
      if (nombre == null) throw OperacionException.invalida(
        "DNI sin registro local. En demostración están disponibles 99000001 y 99000002."
      );
      return new Identidad(dni, nombre, "Demostración ficticia");
    }
    if (
      !"decolecta".equals(proveedor) || token.isBlank()
    ) throw OperacionException.invalida(
      "La consulta externa necesita VALES_DNI_PROVIDER=decolecta y VALES_DNI_TOKEN en .env."
    );
    long ahora = System.currentTimeMillis();
    String cacheKey = actor + ":" + dni;
    var reciente = consultasRecientes.get(cacheKey);
    if (reciente != null && reciente.vence() > ahora) return reciente.persona();
    synchronized (ultimaConsulta) {
      Long anterior = ultimaConsulta.get(actor);
      if (
        anterior != null && ahora - anterior < 3000
      ) throw OperacionException.invalida(
        "Espera tres segundos antes de otra consulta externa."
      );
      ultimaConsulta.entrySet().removeIf(e -> ahora - e.getValue() > 60000);
      ultimaConsulta.put(actor, ahora);
    }
    try {
      var request = HttpRequest.newBuilder(
        URI.create("https://api.decolecta.com/v1/reniec/dni?numero=" + dni)
      )
        .timeout(Duration.ofSeconds(6))
        .header("Authorization", "Bearer " + token)
        .header("Accept", "application/json")
        .GET()
        .build();
      var response = http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) throw OperacionException.invalida(
        "El proveedor de DNI no devolvió datos. Revisa su disponibilidad y el token configurado."
      );
      var datos = json.readTree(response.body());
      String nombre = datos.path("full_name").asText("").strip();
      if (
        !dni.equals(datos.path("document_number").asText()) ||
        nombre.length() < 3 ||
        nombre.length() > 150
      ) throw OperacionException.invalida(
        "El proveedor devolvió datos de identidad incompletos."
      );
      var identidad = new Identidad(dni, nombre, "Proveedor externo Decolecta");
      consultasRecientes
        .entrySet()
        .removeIf(e -> e.getValue().vence() <= ahora);
      if (consultasRecientes.size() >= 1000) consultasRecientes.clear();
      consultasRecientes.put(
        cacheKey,
        new ConsultaReciente(identidad, ahora + 60000)
      );
      return identidad;
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

  public int registrarTercero(int actor, String dni) {
    var persona = consultar(actor, dni);
    return repository.registrarTercero(actor, dni, persona.nombre());
  }
}
