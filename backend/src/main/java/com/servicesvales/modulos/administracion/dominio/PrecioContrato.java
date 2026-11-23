package com.servicesvales.modulos.administracion.dominio;

import java.math.BigDecimal;

public record PrecioContrato(
  String proveedor,
  String contrato,
  String suministro,
  BigDecimal precio
) {}
