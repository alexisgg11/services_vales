package com.servicesvales.modulos.identidad.aplicacion;

import com.servicesvales.config.OrigenPublico;
import com.servicesvales.modulos.documentos.aplicacion.ConsultaValeService;
import com.servicesvales.modulos.identidad.dominio.ContextoAplicacion;
import com.servicesvales.modulos.identidad.infraestructura.SesionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SesionService {

  private final UsuarioService usuarios;
  private final SesionRepository sesiones;
  private final ConsultaValeService consultas;
  private final OrigenPublico origen;

  public SesionService(
    UsuarioService usuarios,
    SesionRepository sesiones,
    ConsultaValeService consultas,
    OrigenPublico origen
  ) {
    this.usuarios = usuarios;
    this.sesiones = sesiones;
    this.consultas = consultas;
    this.origen = origen;
  }

  @Transactional(readOnly = true)
  public ContextoAplicacion cargar(String login) {
    return contexto(usuarios.identificarActor(login), null);
  }

  public ContextoAplicacion contexto(int actor, Long idCreado) {
    return new ContextoAplicacion(
      sesiones.consultarCuenta(actor),
      consultas.documentos(actor),
      origen.url(),
      idCreado
    );
  }

  public tools.jackson.databind.JsonNode cuenta(int actor) {
    return sesiones.consultarCuenta(actor);
  }
}
