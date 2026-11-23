package com.servicesvales.modulos.documentos.dominio;

import java.time.LocalDate;

public record VerificacionVale(
  String codigo,
  String grifo,
  LocalDate fechaEmision,
  short estado
) {}
