package com.servicesvales.modulos.identidad.api;

import com.servicesvales.modulos.identidad.api.ContextoResponse;
import com.servicesvales.modulos.identidad.api.CsrfResponse;
import com.servicesvales.modulos.identidad.aplicacion.SesionService;
import java.security.Principal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SesionController {

  private final SesionService sesiones;

  public SesionController(SesionService sesiones) {
    this.sesiones = sesiones;
  }

  @GetMapping("/api/aplicacion")
  public ContextoResponse contexto(Principal principal) {
    return ContextoResponse.desde(sesiones.cargar(principal.getName()));
  }

  @GetMapping("/api/csrf")
  public CsrfResponse csrf(@RequestAttribute("_csrf") CsrfToken token) {
    return new CsrfResponse(token.getHeaderName(), token.getToken());
  }
}
