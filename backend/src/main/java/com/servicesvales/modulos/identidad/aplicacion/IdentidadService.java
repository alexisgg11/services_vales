package com.servicesvales.modulos.identidad.aplicacion;

import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.identidad.infraestructura.IdentidadRepository;
import com.servicesvales.modulos.identidad.infraestructura.ProveedorDniHttp;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class IdentidadService {

  public record Identidad(String documento, String nombre, String origen) {}

  private final IdentidadRepository repository;
  private final UsuarioService usuarios;
  private final ProveedorDniHttp proveedorHttp;
  private final String proveedor;
  private final Map<Integer, Long> ultimaConsulta = new ConcurrentHashMap<>();

  private record ConsultaReciente(Identidad persona, long vence) {}

  private final Map<String, ConsultaReciente> consultasRecientes =
    new ConcurrentHashMap<>();

  public IdentidadService(
    IdentidadRepository repository,
    UsuarioService usuarios,
    ProveedorDniHttp proveedorHttp,
    @Value("${vales.dni.proveedor:apisperu}") String proveedor
  ) {
    this.repository = repository;
    this.usuarios = usuarios;
    this.proveedorHttp = proveedorHttp;
    this.proveedor = proveedor;
  }

  public Identidad consultar(String login, String dni) {
    return consultar(usuarios.identificarActor(login), dni);
  }

  public Identidad consultar(int actor, String dni) {
    if (
      dni == null || !dni.matches("[0-9]{8}")
    ) throw OperacionException.invalida("Indica un DNI de ocho dígitos.");
    var local = repository.consultar(actor, dni);
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
    var consulta = proveedorHttp.consultar(proveedor, dni);
    var identidad = new Identidad(dni, consulta.nombre(), consulta.origen());
    consultasRecientes.entrySet().removeIf(e -> e.getValue().vence() <= ahora);
    if (consultasRecientes.size() >= 1000) consultasRecientes.clear();
    consultasRecientes.put(
      cacheKey,
      new ConsultaReciente(identidad, ahora + 60000)
    );
    return identidad;
  }

  public int registrarTercero(int actor, String dni) {
    var persona = consultar(actor, dni);
    return repository.registrarTercero(actor, dni, persona.nombre());
  }
}
