package com.servicesvales.modulos.identidad.dominio;

import tools.jackson.databind.JsonNode;

public record ContextoAplicacion(
  JsonNode cuenta,
  JsonNode vales,
  String publicBaseUrl,
  Long valeCreado
) {}
