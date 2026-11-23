package com.servicesvales.modulos.facturacion.api;

import com.servicesvales.modulos.facturacion.aplicacion.EmisionFacturaService;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/v1/facturacion/grifo")
public class GrifoFacturaController {

  private final EmisionFacturaService service;

  public GrifoFacturaController(EmisionFacturaService service) {
    this.service = service;
  }

  @GetMapping
  public JsonNode consultar(Principal p) {
    return service.consultar(p.getName());
  }

  @PostMapping
  public JsonNode emitir(Principal p, @RequestBody EmitirFacturaRequest r) {
    return service.emitir(p.getName(), r.aModelo());
  }
}
