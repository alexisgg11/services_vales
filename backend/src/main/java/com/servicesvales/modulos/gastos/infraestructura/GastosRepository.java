package com.servicesvales.modulos.gastos.infraestructura;

import java.time.LocalDate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.*;

@Repository
public class GastosRepository {

  private final JdbcClient jdbc;
  private final ObjectMapper json;

  public GastosRepository(JdbcClient jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public JsonNode consultarGastos(int actor, LocalDate mes) {
    return json.readTree(
      jdbc
        .sql("SELECT vales.consultar_gastos(:actor,:mes)::text")
        .param("actor", actor)
        .param("mes", mes)
        .query(String.class)
        .single()
    );
  }
}
