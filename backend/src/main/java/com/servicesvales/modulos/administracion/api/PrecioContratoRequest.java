package com.servicesvales.modulos.administracion.api;

import com.servicesvales.modulos.administracion.dominio.PrecioContrato;
import java.math.BigDecimal;

public record PrecioContratoRequest(
  String proveedor,
  String contrato,
  String suministro,
  BigDecimal precio
) {
  public PrecioContrato aModelo() {
    return new PrecioContrato(proveedor, contrato, suministro, precio);
  }
}
