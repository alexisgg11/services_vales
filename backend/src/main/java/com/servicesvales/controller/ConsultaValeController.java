package com.servicesvales.controller;

import com.servicesvales.dto.ConsultaValeResponse;
import com.servicesvales.service.ConsultaValeService;
import java.security.Principal;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/vales/qr")
public class ConsultaValeController {
    private final ConsultaValeService consultas;

    public ConsultaValeController(ConsultaValeService consultas) {
        this.consultas = consultas;
    }

    @GetMapping
    public JsonNode listar(Principal principal) {
        return consultas.listar(principal.getName());
    }

    @GetMapping("/{idQr}")
    public ConsultaValeResponse consultar(Principal principal, @PathVariable UUID idQr) {
        return ConsultaValeResponse.desde(consultas.consultar(principal.getName(), idQr));
    }
}
