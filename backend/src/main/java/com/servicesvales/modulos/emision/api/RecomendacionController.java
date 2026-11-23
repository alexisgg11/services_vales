package com.servicesvales.modulos.emision.api;

import com.servicesvales.modulos.emision.aplicacion.RecomendacionService;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/emision/recomendaciones")
public class RecomendacionController {

  private final RecomendacionService service;
  private final com.servicesvales.modulos.emision.aplicacion.RecomendacionRutaService rutas;

  public RecomendacionController(
    RecomendacionService service,
    com.servicesvales.modulos.emision.aplicacion.RecomendacionRutaService rutas
  ) {
    this.service = service;
    this.rutas = rutas;
  }

  @PostMapping("/ruta")
  public com.servicesvales.modulos.emision.aplicacion.RecomendacionRutaService.Resultado generar(
    Principal p,
    @RequestBody com.servicesvales.modulos.emision.aplicacion.RecomendacionRutaService.ConsultaRuta q
  ) {
    return rutas.generar(p.getName(), q);
  }

  @PostMapping
  public List<RecomendacionService.Opcion> consultar(
    Principal p,
    @RequestBody RecomendacionService.Consulta consulta
  ) {
    return service.consultar(p.getName(), consulta);
  }
}
