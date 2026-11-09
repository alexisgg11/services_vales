package com.servicesvales.dto;

import com.servicesvales.model.CambioCuenta;

public record CuentaRequest(String login, Integer trabajador, String clave, Boolean activo, RolRequest rol) {
    public CambioCuenta aModelo() {
        return new CambioCuenta(login, trabajador, clave, activo, rol == null ? null : rol.aModelo());
    }
}
