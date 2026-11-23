package com.servicesvales.modulos.facturacion.api;

import com.servicesvales.compartido.api.LoteValesRequest;
import com.servicesvales.modulos.facturacion.aplicacion.FacturacionService;
import com.servicesvales.modulos.identidad.api.ContextoResponse;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
public class FacturacionController {

  private final FacturacionService service;

  public FacturacionController(FacturacionService service) {
    this.service = service;
  }

  @PostMapping({
    "/api/facturas/{id}/vales",
    "/api/v1/facturacion/facturas/{id}/vales",
  })
  public ContextoResponse asociar(
    Principal p,
    @PathVariable long id,
    @RequestBody LoteValesRequest r
  ) {
    return ContextoResponse.desde(
      service.asociarFactura(p.getName(), id, r.aModelo())
    );
  }
}
