package com.servicesvales.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class VistaController {
    @GetMapping("/")
    public String inicio() {
        return "redirect:/app/index.html";
    }

    @GetMapping("/app/login")
    public String acceso() {
        return "forward:/app/index.html";
    }

    @GetMapping({"/vales/q/{idQr}", "/vales/q/{idQr}/verificacion"})
    public String verificar() {
        return "forward:/app/verificacion-vale.html";
    }

    @GetMapping({"/consulta", "/vales/q/{idQr}/documento"})
    public String consulta() {
        return "forward:/app/consulta-vale.html";
    }
}
