package com.servicesvales.model;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TarifaCombustible(String grifo, String suministro, LocalDate desde, BigDecimal precio) {}
