package com.servicesvales.modulos.gastos.api;

import com.servicesvales.modulos.gastos.aplicacion.GastosService;
import java.security.Principal;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping({ "/api/gastos", "/api/v1/gastos" })
public class GastosController {

  private final GastosService service;

  public GastosController(GastosService service) {
    this.service = service;
  }

  @GetMapping
  public JsonNode consultar(Principal p, @RequestParam LocalDate mes) {
    return service.consultarGastos(p.getName(), mes);
  }
}
