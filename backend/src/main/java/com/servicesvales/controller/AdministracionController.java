package com.servicesvales.controller;

import com.servicesvales.dto.CuentaRequest;
import com.servicesvales.dto.OperacionResponse;
import com.servicesvales.dto.PrecioContratoRequest;
import com.servicesvales.dto.RolRequest;
import com.servicesvales.dto.TarifaRequest;
import com.servicesvales.service.AdministracionService;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/administracion")
public class AdministracionController {
    private final AdministracionService administracion;

    public AdministracionController(AdministracionService administracion) {
        this.administracion = administracion;
    }

    @GetMapping
    public JsonNode consultar(Principal principal) {
        return administracion.consultar(principal.getName());
    }

    @PostMapping("/usuarios")
    public OperacionResponse crearCuenta(Principal principal, @RequestBody CuentaRequest datos) {
        administracion.guardarCuenta(principal.getName(), null, datos.aModelo());
        return OperacionResponse.completada();
    }

    @PostMapping("/usuarios/{id}")
    public OperacionResponse editarCuenta(Principal principal, @PathVariable int id, @RequestBody CuentaRequest datos) {
        administracion.guardarCuenta(principal.getName(), id, datos.aModelo());
        return OperacionResponse.completada();
    }

    @PostMapping("/usuarios/{id}/roles")
    public OperacionResponse guardarRol(Principal principal, @PathVariable int id, @RequestBody RolRequest datos) {
        administracion.guardarRol(principal.getName(), id, datos.aModelo());
        return OperacionResponse.completada();
    }

    @PostMapping("/tarifas")
    public OperacionResponse registrarTarifa(Principal principal, @RequestBody TarifaRequest datos) {
        administracion.registrarTarifa(principal.getName(), datos.aModelo());
        return OperacionResponse.completada();
    }

    @GetMapping("/contratos-vigentes")
    public JsonNode contratosVigentes(Principal principal) {
        return administracion.contratosVigentes(principal.getName());
    }

    @PostMapping("/precios-contrato")
    public OperacionResponse registrarPrecioContrato(Principal principal, @RequestBody PrecioContratoRequest datos) {
        administracion.registrarPrecioContrato(principal.getName(), datos.aModelo());
        return OperacionResponse.completada();
    }
}
