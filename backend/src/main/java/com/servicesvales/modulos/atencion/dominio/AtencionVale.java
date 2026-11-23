package com.servicesvales.modulos.atencion.dominio;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AtencionVale(
  LocalDate fecha,
  BigDecimal cantidad,
  BigDecimal precio,
  BigDecimal precioConfirmado,
  String dniPresentado,
  boolean identidadVerificada
) {}
