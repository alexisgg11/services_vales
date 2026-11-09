package com.servicesvales.model;

import tools.jackson.databind.JsonNode;

public record FichaVale(JsonNode datos, String enlaceQr) {}
