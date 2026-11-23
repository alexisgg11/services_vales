package com.servicesvales.modulos.emision.infraestructura;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.*;

@Repository
public class RecomendacionRepository {

  private final JdbcClient jdbc;
  private final ObjectMapper json;

  public RecomendacionRepository(JdbcClient jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public JsonNode ubicaciones(int actor) {
    return json.readTree(
      jdbc
        .sql("SELECT vales.ubicaciones_emision(:actor)::text")
        .param("actor", actor)
        .query(String.class)
        .single()
    );
  }
}
