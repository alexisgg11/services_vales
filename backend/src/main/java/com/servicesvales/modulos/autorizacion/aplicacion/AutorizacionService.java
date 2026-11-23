package com.servicesvales.modulos.autorizacion.aplicacion;

import com.servicesvales.compartido.dominio.LoteVales;
import com.servicesvales.modulos.autorizacion.infraestructura.AutorizacionRepository;
import com.servicesvales.modulos.identidad.aplicacion.SesionService;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import com.servicesvales.modulos.identidad.dominio.ContextoAplicacion;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AutorizacionService {

  private final AutorizacionRepository repository;
  private final UsuarioService usuarios;
  private final SesionService sesiones;

  public AutorizacionService(
    AutorizacionRepository repository,
    UsuarioService usuarios,
    SesionService sesiones
  ) {
    this.repository = repository;
    this.usuarios = usuarios;
    this.sesiones = sesiones;
  }

  @Transactional
  public ContextoAplicacion autorizar(String login, LoteVales lote) {
    int actor = usuarios.identificarActor(login);
    repository.autorizar(actor, lote);
    return sesiones.contexto(actor, null);
  }
}
