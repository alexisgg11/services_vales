package com.servicesvales.dto;

import com.servicesvales.model.AtencionVale;
import java.math.BigDecimal;
import java.time.LocalDate;

public record RegistrarAtencionRequest(LocalDate fecha, BigDecimal cantidad, BigDecimal precio,
                                      BigDecimal precioConfirmado, String dniPresentado, boolean identidadVerificada) {
    public AtencionVale aModelo() {
        return new AtencionVale(fecha, cantidad, precio, precioConfirmado, dniPresentado, identidadVerificada);
    }
}
