package com.servicesvales.modulos.autorizacion.aplicacion;

import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.autorizacion.infraestructura.RutasRepository;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class RutasService {

  private final RutasRepository rutas;
  private final UsuarioService usuarios;

  public RutasService(RutasRepository rutas, UsuarioService usuarios) {
    this.rutas = rutas;
    this.usuarios = usuarios;
  }

  public JsonNode contexto(String login, LocalDate fecha) {
    return rutas.contexto(usuarios.identificarActor(login), fecha);
  }

  @Transactional
  public JsonNode guardar(String login, Long id, JsonNode datos) {
    var guardada = rutas.guardar(usuarios.identificarActor(login), id, datos);
    if (datos.path("origen").isObject() && !guardada.path("origen").isObject()) {
      throw OperacionException.invalida(
        "Aplica la migración 19 de puntos de partida para guardar la ruta."
      );
    }
    return guardada;
  }

  public JsonNode asignada(int actor, long ruta, LocalDate fecha) {
    return rutas.paraEmision(actor, ruta, fecha);
  }

  public void vincular(
    int actor,
    long vale,
    long ruta,
    int version,
    String origen
  ) {
    rutas.vincular(actor, vale, ruta, version, origen);
  }

  public JsonNode delVale(String login, long vale) {
    return rutas.delVale(usuarios.identificarActor(login), vale);
  }
}
