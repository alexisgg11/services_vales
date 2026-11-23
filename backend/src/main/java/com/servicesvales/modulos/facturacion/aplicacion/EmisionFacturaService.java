package com.servicesvales.modulos.facturacion.aplicacion;

import com.servicesvales.modulos.facturacion.dominio.EmisionFactura;
import com.servicesvales.modulos.facturacion.infraestructura.FacturacionRepository;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class EmisionFacturaService {

  private final FacturacionRepository repository;
  private final UsuarioService usuarios;

  public EmisionFacturaService(
    FacturacionRepository repository,
    UsuarioService usuarios
  ) {
    this.repository = repository;
    this.usuarios = usuarios;
  }

  @Transactional(readOnly = true)
  public JsonNode consultar(String login) {
    return repository.consultarGrifo(usuarios.identificarActor(login));
  }

  @Transactional
  public JsonNode emitir(String login, EmisionFactura r) {
    return repository.emitir(
      usuarios.identificarActor(login),
      r.lote(),
      r.solicitud(),
      r.fecha()
    );
  }
}
