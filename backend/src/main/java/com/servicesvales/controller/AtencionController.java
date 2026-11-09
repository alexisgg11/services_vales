package com.servicesvales.controller;

import com.servicesvales.dto.ConsultaValeResponse;
import com.servicesvales.dto.PrecioAtencionResponse;
import com.servicesvales.dto.RegistrarAtencionRequest;
import com.servicesvales.service.AtencionService;
import java.security.Principal;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vales/qr/{idQr}")
public class AtencionController {
    private final AtencionService atenciones;

    public AtencionController(AtencionService atenciones) {
        this.atenciones = atenciones;
    }

    @GetMapping("/precio")
    public PrecioAtencionResponse sugerirPrecio(Principal principal, @PathVariable UUID idQr, @RequestParam LocalDate fecha) {
        return PrecioAtencionResponse.desde(atenciones.sugerirPrecio(principal.getName(), idQr, fecha));
    }

    @PostMapping("/atencion")
    public ConsultaValeResponse registrar(Principal principal, @PathVariable UUID idQr, @RequestBody RegistrarAtencionRequest datos) {
        return ConsultaValeResponse.desde(atenciones.registrar(principal.getName(), idQr, datos.aModelo()));
    }
}
