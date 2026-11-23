package com.servicesvales.modulos.administracion.api;

import com.servicesvales.compartido.api.OperacionResponse;
import com.servicesvales.modulos.administracion.api.CuentaRequest;
import com.servicesvales.modulos.administracion.api.HabilitacionUnidadRequest;
import com.servicesvales.modulos.administracion.api.PrecioContratoRequest;
import com.servicesvales.modulos.administracion.api.RolRequest;
import com.servicesvales.modulos.administracion.api.TarifaRequest;
import com.servicesvales.modulos.administracion.aplicacion.AdministracionService;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/administracion")
public class AdministracionController {

  private final AdministracionService administracion;

  public AdministracionController(AdministracionService administracion) {
    this.administracion = administracion;
  }

  @GetMapping
  public JsonNode consultar(Principal principal) {
    return administracion.consultar(principal.getName());
  }

  @PostMapping("/usuarios")
  public OperacionResponse crearCuenta(
    Principal principal,
    @RequestBody CuentaRequest datos
  ) {
    administracion.guardarCuenta(principal.getName(), null, datos.aModelo());
    return OperacionResponse.completada();
  }

  @PostMapping("/usuarios/{id}")
  public OperacionResponse editarCuenta(
    Principal principal,
    @PathVariable int id,
    @RequestBody CuentaRequest datos
  ) {
    administracion.guardarCuenta(principal.getName(), id, datos.aModelo());
    return OperacionResponse.completada();
  }

  @PostMapping("/usuarios/{id}/roles")
  public OperacionResponse guardarRol(
    Principal principal,
    @PathVariable int id,
    @RequestBody RolRequest datos
  ) {
    administracion.guardarRol(principal.getName(), id, datos.aModelo());
    return OperacionResponse.completada();
  }

  @PostMapping("/tarifas")
  public OperacionResponse registrarTarifa(
    Principal principal,
    @RequestBody TarifaRequest datos
  ) {
    administracion.registrarTarifa(principal.getName(), datos.aModelo());
    return OperacionResponse.completada();
  }

  @GetMapping("/contratos-vigentes")
  public JsonNode contratosVigentes(Principal principal) {
    return administracion.contratosVigentes(principal.getName());
  }

  @PostMapping("/precios-contrato")
  public OperacionResponse registrarPrecioContrato(
    Principal principal,
    @RequestBody PrecioContratoRequest datos
  ) {
    administracion.registrarPrecioContrato(
      principal.getName(),
      datos.aModelo()
    );
    return OperacionResponse.completada();
  }

  @GetMapping("/unidades")
  public JsonNode unidades(Principal principal) {
    return administracion.unidades(principal.getName());
  }

  @PostMapping("/unidades/{id}/zonal/{zonal}")
  public OperacionResponse asignarZonalUnidad(
    Principal principal,
    @PathVariable int id,
    @PathVariable String zonal
  ) {
    administracion.asignarZonalUnidad(principal.getName(), id, zonal);
    return OperacionResponse.completada();
  }

  @PostMapping("/unidades/{id}/habilitaciones")
  public OperacionResponse habilitarUnidad(
    Principal principal,
    @PathVariable int id,
    @RequestBody HabilitacionUnidadRequest datos
  ) {
    administracion.habilitarUnidad(principal.getName(), datos.aModelo(id));
    return OperacionResponse.completada();
  }
}
