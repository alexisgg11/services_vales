package com.servicesvales.modulos.facturacion.api;

import com.servicesvales.compartido.dominio.LoteVales;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record EmitirFacturaRequest(
  List<Long> vales,
  UUID solicitud,
  LocalDate fecha
) {
  public com.servicesvales.modulos.facturacion.dominio.EmisionFactura aModelo() {
    return new com.servicesvales.modulos.facturacion.dominio.EmisionFactura(
      new LoteVales(vales),
      solicitud,
      fecha
    );
  }
}
