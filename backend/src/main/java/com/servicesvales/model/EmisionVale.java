package com.servicesvales.model;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmisionVale(String dni, String proveedor, String suministro, BigDecimal cantidad, String observacion,
                          boolean sinContrato, String tercero, String destino, LocalDate fecha, String centro,
                          String localidad, Integer unidadMovil) {}
