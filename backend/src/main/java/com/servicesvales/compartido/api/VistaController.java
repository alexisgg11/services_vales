package com.servicesvales.compartido.api;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class VistaController {

  @GetMapping({ "/", "/app/" })
  public String inicio() {
    return "redirect:/app/index.html";
  }

  @GetMapping("/app/login")
  public String acceso() {
    return "forward:/app/index.html";
  }

  @GetMapping({ "/vales/q/{idQr}", "/vales/q/{idQr}/verificacion" })
  public String verificar() {
    return "forward:/app/index.html";
  }

  @GetMapping({ "/consulta", "/vales/q/{idQr}/documento" })
  public String consulta() {
    return "forward:/app/index.html";
  }
}
