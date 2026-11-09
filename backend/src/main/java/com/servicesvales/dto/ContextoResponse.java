package com.servicesvales.dto;

import com.servicesvales.model.ContextoAplicacion;
import tools.jackson.databind.JsonNode;

public record ContextoResponse(JsonNode cuenta, JsonNode vales, String publicBaseUrl, String id) {
    public static ContextoResponse desde(ContextoAplicacion contexto) {
        Long id = contexto.valeCreado();
        return new ContextoResponse(contexto.cuenta(), contexto.vales(), contexto.publicBaseUrl(),
                id == null ? null : id.toString());
    }
}
