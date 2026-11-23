package com.servicesvales.modulos.identidad.api;

import com.servicesvales.modulos.identidad.aplicacion.IdentidadService;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/identidad")
public class IdentidadController {

  private final IdentidadService service;

  public IdentidadController(IdentidadService service) {
    this.service = service;
  }

  public record Consulta(String dni) {}

  @PostMapping("/dni")
  public IdentidadService.Identidad consultar(
    Principal p,
    @RequestBody Consulta consulta
  ) {
    return service.consultar(p.getName(), consulta.dni());
  }
}
