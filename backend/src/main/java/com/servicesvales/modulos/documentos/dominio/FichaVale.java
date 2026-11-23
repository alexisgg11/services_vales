package com.servicesvales.modulos.documentos.dominio;

import tools.jackson.databind.JsonNode;

public record FichaVale(JsonNode datos, String enlaceQr) {}
