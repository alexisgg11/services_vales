package com.servicesvales.model;

import tools.jackson.databind.JsonNode;

public record ContextoAplicacion(JsonNode cuenta, JsonNode vales, String publicBaseUrl, Long valeCreado) {}
