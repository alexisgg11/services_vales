package com.servicesvales.modulos.anulacion.api;

import com.servicesvales.modulos.anulacion.aplicacion.AnulacionService;
import com.servicesvales.modulos.identidad.api.ContextoResponse;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
public class AnulacionController {

  private final AnulacionService service;

  public AnulacionController(AnulacionService service) {
    this.service = service;
  }

  @PostMapping({ "/api/vales/{id}/anulacion", "/api/v1/anulacion/vales/{id}" })
  public ContextoResponse anular(
    Principal p,
    @PathVariable long id,
    @RequestBody AnularValeRequest r
  ) {
    return ContextoResponse.desde(service.anular(p.getName(), id, r.motivo()));
  }
}
