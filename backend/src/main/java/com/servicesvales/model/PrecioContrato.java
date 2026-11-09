package com.servicesvales.model;

import java.math.BigDecimal;

public record PrecioContrato(String proveedor, String contrato, String suministro, BigDecimal precio) {}
