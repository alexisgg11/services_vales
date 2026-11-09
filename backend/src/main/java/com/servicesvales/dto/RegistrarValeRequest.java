package com.servicesvales.dto;

import com.servicesvales.model.EmisionVale;
import java.math.BigDecimal;
import java.time.LocalDate;

public record RegistrarValeRequest(String dni, String proveedor, String suministro, BigDecimal cantidad,
                                  String observacion, boolean sinContrato, String tercero, String destino,
                                  LocalDate fecha, String centro, String localidad, Integer unidadMovil) {
    public EmisionVale aModelo() {
        return new EmisionVale(dni, proveedor, suministro, cantidad, observacion, sinContrato,
                tercero, destino, fecha, centro, localidad, unidadMovil);
    }
}
