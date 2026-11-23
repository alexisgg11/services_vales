package com.servicesvales.modulos.identidad.aplicacion;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.identidad.dominio.CuentaAcceso;
import com.servicesvales.modulos.identidad.infraestructura.UsuarioRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class UsuarioServiceTest {

  @Test
  void identificaActorDeCuentaActiva() {
    var repo = mock(UsuarioRepository.class);
    when(repo.buscarActiva("activa")).thenReturn(
      Optional.of(new CuentaAcceso(7, "activa", "hash"))
    );
    assertEquals(
      7,
      new UsuarioService(repo).identificarActor("activa")
    );
  }

  @Test
  void rechazaCuentaInactiva() {
    var repo = mock(UsuarioRepository.class);
    when(repo.buscarActiva("inactiva")).thenReturn(Optional.empty());
    var error = assertThrows(OperacionException.class, () ->
      new UsuarioService(repo).identificarActor("inactiva")
    );
    assertEquals(OperacionException.Tipo.SIN_PERMISO, error.tipo());
    verify(repo).buscarActiva("inactiva");
    verifyNoMoreInteractions(repo);
  }
}
