package com.servicesvales.dto;

import com.servicesvales.model.PrecioContrato;
import java.math.BigDecimal;

public record PrecioContratoRequest(String proveedor, String contrato, String suministro, BigDecimal precio) {
    public PrecioContrato aModelo() {
        return new PrecioContrato(proveedor, contrato, suministro, precio);
    }
}
