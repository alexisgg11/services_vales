package com.servicesvales.modulos.administracion.api;

import com.servicesvales.modulos.administracion.dominio.HabilitacionUnidad;
import java.time.LocalDate;

public record HabilitacionUnidadRequest(
  String zonal,
  String centro,
  LocalDate desde,
  LocalDate hasta
) {
  public HabilitacionUnidad aModelo(int unidad) {
    return new HabilitacionUnidad(unidad, zonal, centro, desde, hasta);
  }
}
