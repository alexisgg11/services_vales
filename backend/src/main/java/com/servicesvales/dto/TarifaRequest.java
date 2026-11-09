package com.servicesvales.dto;

import com.servicesvales.model.TarifaCombustible;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TarifaRequest(String grifo, String suministro, LocalDate desde, BigDecimal precio) {
    public TarifaCombustible aModelo() {
        return new TarifaCombustible(grifo, suministro, desde, precio);
    }
}
