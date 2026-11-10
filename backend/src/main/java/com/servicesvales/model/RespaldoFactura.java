package com.servicesvales.model;

import java.util.List;

public record RespaldoFactura(List<String> tickets, String origen, String referenciaAnexo) {}
