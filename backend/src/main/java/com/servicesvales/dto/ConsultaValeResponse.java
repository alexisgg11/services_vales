package com.servicesvales.dto;

import com.servicesvales.model.FichaVale;
import tools.jackson.databind.JsonNode;

public record ConsultaValeResponse(JsonNode vale, String qrUrl) {
    public static ConsultaValeResponse desde(FichaVale ficha) {
        return new ConsultaValeResponse(ficha.datos(), ficha.enlaceQr());
    }
}
