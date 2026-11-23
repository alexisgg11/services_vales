package com.servicesvales.modulos.autorizacion.api;

import com.servicesvales.compartido.api.LoteValesRequest;
import com.servicesvales.modulos.autorizacion.aplicacion.AutorizacionService;
import com.servicesvales.modulos.identidad.api.ContextoResponse;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
public class AutorizacionController {

  private final AutorizacionService service;

  public AutorizacionController(AutorizacionService service) {
    this.service = service;
  }

  @PostMapping({ "/api/vales/autorizacion", "/api/v1/autorizacion/vales" })
  public ContextoResponse autorizar(
    Principal p,
    @RequestBody LoteValesRequest r
  ) {
    return ContextoResponse.desde(service.autorizar(p.getName(), r.aModelo()));
  }
}
