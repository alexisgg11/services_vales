package com.servicesvales.modulos.emision.api;

import com.servicesvales.modulos.emision.aplicacion.EmisionService;
import com.servicesvales.modulos.identidad.api.ContextoResponse;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({ "/api/vales", "/api/v1/emision/vales" })
public class EmisionController {

  private final EmisionService service;

  public EmisionController(EmisionService service) {
    this.service = service;
  }

  @PostMapping
  public ContextoResponse registrar(
    Principal p,
    @RequestBody RegistrarValeRequest r
  ) {
    return ContextoResponse.desde(service.registrar(p.getName(), r.aModelo()));
  }
}
