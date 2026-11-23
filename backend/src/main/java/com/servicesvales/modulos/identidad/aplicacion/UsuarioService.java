package com.servicesvales.modulos.identidad.aplicacion;

import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.identidad.dominio.CuentaAcceso;
import com.servicesvales.modulos.identidad.infraestructura.UsuarioRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

  private final UsuarioRepository usuarios;

  public UsuarioService(UsuarioRepository usuarios) {
    this.usuarios = usuarios;
  }

  public Optional<CuentaAcceso> buscarActiva(String login) {
    return usuarios.buscarActiva(login);
  }

  public int identificarActor(String login) {
    return buscarActiva(login)
      .orElseThrow(() ->
        new OperacionException(
          OperacionException.Tipo.SIN_PERMISO,
          "La cuenta no está habilitada."
        )
      )
      .id();
  }
}
