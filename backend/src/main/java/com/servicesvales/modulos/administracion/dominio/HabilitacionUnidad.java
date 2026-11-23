package com.servicesvales.modulos.administracion.dominio;

import java.time.LocalDate;

public record HabilitacionUnidad(
  int unidad,
  String zonal,
  String centro,
  LocalDate desde,
  LocalDate hasta
) {}
