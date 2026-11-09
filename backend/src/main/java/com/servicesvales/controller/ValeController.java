package com.servicesvales.controller;

import com.servicesvales.dto.AnularValeRequest;
import com.servicesvales.dto.ContextoResponse;
import com.servicesvales.dto.LoteValesRequest;
import com.servicesvales.dto.RegistrarValeRequest;
import com.servicesvales.service.ValeService;
import java.security.Principal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vales")
public class ValeController {
    private final ValeService vales;

    public ValeController(ValeService vales) {
        this.vales = vales;
    }

    @PostMapping
    public ContextoResponse registrar(Principal principal, @RequestBody RegistrarValeRequest datos) {
        return ContextoResponse.desde(vales.registrar(principal.getName(), datos.aModelo()));
    }

    @PostMapping("/autorizacion")
    public ContextoResponse autorizar(Principal principal, @RequestBody LoteValesRequest datos) {
        return ContextoResponse.desde(vales.autorizar(principal.getName(), datos.aModelo()));
    }

    @PostMapping("/{id}/anulacion")
    public ContextoResponse anular(Principal principal, @PathVariable long id, @RequestBody AnularValeRequest datos) {
        return ContextoResponse.desde(vales.anular(principal.getName(), id, datos.motivo()));
    }
}
