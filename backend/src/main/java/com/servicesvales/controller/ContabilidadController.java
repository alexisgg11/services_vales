package com.servicesvales.controller;

import com.servicesvales.dto.ContextoResponse;
import com.servicesvales.dto.LoteValesRequest;
import com.servicesvales.service.ContabilidadService;
import java.security.Principal;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
public class ContabilidadController {
    private final ContabilidadService contabilidad;

    public ContabilidadController(ContabilidadService contabilidad) {
        this.contabilidad = contabilidad;
    }

    @PostMapping("/api/facturas/{id}/vales")
    public ContextoResponse asociarFactura(Principal principal, @PathVariable long id, @RequestBody LoteValesRequest datos) {
        return ContextoResponse.desde(contabilidad.asociarFactura(principal.getName(), id, datos.aModelo()));
    }

    @GetMapping("/api/gastos")
    public JsonNode consultarGastos(Principal principal, @RequestParam LocalDate mes) {
        return contabilidad.consultarGastos(principal.getName(), mes);
    }
}
