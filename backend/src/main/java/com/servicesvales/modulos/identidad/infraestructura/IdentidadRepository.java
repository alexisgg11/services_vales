package com.servicesvales.modulos.identidad.infraestructura;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class IdentidadRepository {

  private final JdbcClient jdbc;
  private final ObjectMapper json;

  public IdentidadRepository(JdbcClient jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public JsonNode consultar(int actor, String dni) {
    String valor = jdbc
      .sql("SELECT coalesce(vales.identidad_local(:actor,:dni)::text,'null')")
      .param("actor", actor)
      .param("dni", dni)
      .query((rs, i) -> rs.getString(1))
      .single();
    return "null".equals(valor) ? null : json.readTree(valor);
  }

  public int registrarTercero(int actor, String dni, String nombre) {
    return jdbc
      .sql("SELECT vales.registrar_tercero_identificado(:actor,:dni,:nombre)")
      .param("actor", actor)
      .param("dni", dni)
      .param("nombre", nombre)
      .query(Integer.class)
      .single();
  }
}
