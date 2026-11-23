package com.servicesvales.modulos.autorizacion.api;

import com.servicesvales.compartido.dominio.MotorRutas;
import com.servicesvales.modulos.autorizacion.aplicacion.OptimizacionRutaService;
import com.servicesvales.modulos.autorizacion.aplicacion.RutasService;
import java.security.Principal;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
public class RutasController {

  private final RutasService service;
  private final OptimizacionRutaService optimizacion;

  public RutasController(
    RutasService service,
    OptimizacionRutaService optimizacion
  ) {
    this.service = service;
    this.optimizacion = optimizacion;
  }

  @GetMapping({ "/api/v1/autorizacion/rutas", "/api/v1/emision/rutas" })
  public JsonNode listar(
    Principal p,
    @RequestParam(required = false) LocalDate fecha
  ) {
    return service.contexto(p.getName(), fecha);
  }

  @PostMapping("/api/v1/autorizacion/rutas")
  public JsonNode crear(Principal p, @RequestBody JsonNode datos) {
    return service.guardar(p.getName(), null, datos);
  }

  @PostMapping("/api/v1/autorizacion/rutas/{id}")
  public JsonNode editar(
    Principal p,
    @PathVariable long id,
    @RequestBody JsonNode datos
  ) {
    return service.guardar(p.getName(), id, datos);
  }

  @PostMapping("/api/v1/autorizacion/rutas/optimizar")
  public OptimizacionRutaService.Resultado optimizar(
    Principal p,
    @RequestBody OptimizacionRutaService.Consulta consulta
  ) {
    return optimizacion.optimizar(p.getName(), consulta);
  }

  @PostMapping("/api/v1/autorizacion/rutas/trazado")
  public MotorRutas.Recorrido trazar(
    Principal p,
    @RequestBody OptimizacionRutaService.Consulta consulta
  ) {
    return optimizacion.trazar(p.getName(), consulta);
  }

  @GetMapping("/api/v1/emision/vales/{id}/ruta")
  public JsonNode detalle(Principal p, @PathVariable long id) {
    return service.delVale(p.getName(), id);
  }
}
