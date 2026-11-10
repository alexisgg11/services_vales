package com.servicesvales.dto;

import com.servicesvales.model.RespaldoFactura;
import java.util.List;

public record RespaldoFacturaRequest(List<String> tickets, String origen, String referenciaAnexo) {
    public RespaldoFactura aModelo() {
        return new RespaldoFactura(tickets == null ? List.of() : tickets, origen, referenciaAnexo);
    }
}
