package com.servicesvales.controller;

import com.servicesvales.model.VerificacionVale;
import com.servicesvales.service.ConsultaValeService;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VerificacionValeController {
    private final ConsultaValeService consultas;

    public VerificacionValeController(ConsultaValeService consultas) {
        this.consultas = consultas;
    }

    @GetMapping("/api/publico/vales/{idQr}")
    public ResponseEntity<VerificacionVale> verificar(@PathVariable UUID idQr) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-Robots-Tag", "noindex, nofollow")
                .body(consultas.verificar(idQr));
    }
}
