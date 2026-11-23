package com.servicesvales.modulos.anulacion.aplicacion;

import com.servicesvales.modulos.anulacion.infraestructura.AnulacionRepository;
import com.servicesvales.modulos.identidad.aplicacion.SesionService;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import com.servicesvales.modulos.identidad.dominio.ContextoAplicacion;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnulacionService {

  private final AnulacionRepository repository;
  private final UsuarioService usuarios;
  private final SesionService sesiones;

  public AnulacionService(
    AnulacionRepository repository,
    UsuarioService usuarios,
    SesionService sesiones
  ) {
    this.repository = repository;
    this.usuarios = usuarios;
    this.sesiones = sesiones;
  }

  @Transactional
  public ContextoAplicacion anular(String login, long id, String motivo) {
    int actor = usuarios.identificarActor(login);
    repository.anular(actor, id, motivo);
    return sesiones.contexto(actor, null);
  }
}
