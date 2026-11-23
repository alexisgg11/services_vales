package com.servicesvales.modulos.autorizacion.api;

import com.servicesvales.modulos.administracion.aplicacion.AdministracionService;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
public class PrestamosController {

  private final AdministracionService service;

  public PrestamosController(AdministracionService service) {
    this.service = service;
  }

  @GetMapping("/api/v1/autorizacion/unidades")
  public JsonNode unidades(Principal p) {
    return service.unidadesJefatura(p.getName());
  }
}
