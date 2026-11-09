package com.servicesvales.dto;

import com.servicesvales.model.PrecioAtencion;
import java.math.BigDecimal;

public record PrecioAtencionResponse(BigDecimal precio, String fuente) {
    public static PrecioAtencionResponse desde(PrecioAtencion precio) {
        return new PrecioAtencionResponse(precio.precio(), precio.fuente());
    }
}
