package com.servicesvales.compartido.api;

import com.servicesvales.modulos.documentos.dominio.FichaVale;
import tools.jackson.databind.JsonNode;

public record ConsultaValeResponse(JsonNode vale, String qrUrl) {
  public static ConsultaValeResponse desde(FichaVale ficha) {
    return new ConsultaValeResponse(ficha.datos(), ficha.enlaceQr());
  }
}
