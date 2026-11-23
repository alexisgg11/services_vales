package com.servicesvales.modulos.administracion.dominio;

public record CambioCuenta(
  String login,
  Integer trabajador,
  String clave,
  Boolean activo,
  AsignacionRol rol
) {}
