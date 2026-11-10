package com.servicesvales.dto;

import com.servicesvales.model.HabilitacionUnidad;
import java.time.LocalDate;

public record HabilitacionUnidadRequest(String zonal, String centro, LocalDate desde, LocalDate hasta) {
    public HabilitacionUnidad aModelo(int unidad) {
        return new HabilitacionUnidad(unidad, zonal, centro, desde, hasta);
    }
}
