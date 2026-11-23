package com.servicesvales.modulos.atencion.api;

import com.servicesvales.modulos.atencion.dominio.AtencionVale;
import java.math.BigDecimal;
import java.time.LocalDate;

public record RegistrarAtencionRequest(
  LocalDate fecha,
  BigDecimal cantidad,
  BigDecimal precio,
  BigDecimal precioConfirmado,
  String dniPresentado,
  boolean identidadVerificada
) {
  public AtencionVale aModelo() {
    return new AtencionVale(
      fecha,
      cantidad,
      precio,
      precioConfirmado,
      dniPresentado,
      identidadVerificada
    );
  }
}
