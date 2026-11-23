package com.servicesvales.modulos.administracion.api;

import com.servicesvales.modulos.administracion.dominio.AsignacionRol;

public record RolRequest(
  String codigo,
  String zonal,
  String grifo,
  Boolean otorgar
) {
  public AsignacionRol aModelo() {
    return new AsignacionRol(codigo, zonal, grifo, otorgar);
  }
}
