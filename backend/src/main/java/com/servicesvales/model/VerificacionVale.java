package com.servicesvales.model;

import java.time.LocalDate;

public record VerificacionVale(String codigo, String grifo, LocalDate fechaEmision, short estado) {}
