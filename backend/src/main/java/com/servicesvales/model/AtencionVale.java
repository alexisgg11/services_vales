package com.servicesvales.model;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AtencionVale(LocalDate fecha, BigDecimal cantidad, BigDecimal precio, BigDecimal precioConfirmado,
                           String dniPresentado, boolean identidadVerificada) {}
