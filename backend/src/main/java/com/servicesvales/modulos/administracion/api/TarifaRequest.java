package com.servicesvales.modulos.administracion.api;

import com.servicesvales.modulos.administracion.dominio.TarifaCombustible;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TarifaRequest(
  String grifo,
  String suministro,
  LocalDate desde,
  BigDecimal precio
) {
  public TarifaCombustible aModelo() {
    return new TarifaCombustible(grifo, suministro, desde, precio);
  }
}
