package com.servicesvales.modulos.administracion.api;

import com.servicesvales.modulos.administracion.dominio.CambioCuenta;

public record CuentaRequest(
  String login,
  Integer trabajador,
  String clave,
  Boolean activo,
  RolRequest rol
) {
  public CambioCuenta aModelo() {
    return new CambioCuenta(
      login,
      trabajador,
      clave,
      activo,
      rol == null ? null : rol.aModelo()
    );
  }
}
