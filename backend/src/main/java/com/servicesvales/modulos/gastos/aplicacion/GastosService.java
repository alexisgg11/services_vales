package com.servicesvales.modulos.gastos.aplicacion;

import com.servicesvales.modulos.gastos.infraestructura.GastosRepository;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class GastosService {

  private final GastosRepository repository;
  private final UsuarioService usuarios;

  public GastosService(GastosRepository repository, UsuarioService usuarios) {
    this.repository = repository;
    this.usuarios = usuarios;
  }

  @Transactional(readOnly = true)
  public JsonNode consultarGastos(String login, LocalDate mes) {
    return repository.consultarGastos(usuarios.identificarActor(login), mes);
  }
}
