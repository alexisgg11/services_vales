package com.servicesvales.modulos.autorizacion.infraestructura;

import java.time.LocalDate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.*;

@Repository
public class RutasRepository {

  private final JdbcClient jdbc;
  private final ObjectMapper json;

  public RutasRepository(JdbcClient jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public JsonNode contexto(int actor, LocalDate fecha) {
    return json.readTree(
      leer("SELECT vales.rutas_contexto(:actor,:fecha)::text", actor)
        .param("fecha", fecha)
        .query(String.class)
        .single()
    );
  }

  private JdbcClient.StatementSpec leer(String sql, int actor) {
    return jdbc.sql(sql).param("actor", actor);
  }

  public JsonNode guardar(int actor, Long id, JsonNode datos) {
    return json.readTree(
      leer(
        "SELECT vales.guardar_ruta(:actor,:id,CAST(:datos AS jsonb))::text",
        actor
      )
        .param("id", id)
        .param("datos", datos.toString())
        .query(String.class)
        .single()
    );
  }

  public JsonNode paraEmision(int actor, long id, LocalDate fecha) {
    return json.readTree(
      leer("SELECT vales.ruta_emision(:actor,:id,:fecha)::text", actor)
        .param("id", id)
        .param("fecha", fecha)
        .query(String.class)
        .single()
    );
  }

  public void vincular(
    int actor,
    long vale,
    long ruta,
    int version,
    String origen
  ) {
    leer(
      "SELECT vales.vincular_ruta_vale(:actor,:vale,:ruta,:version,CAST(:origen AS jsonb))",
      actor
    )
      .param("vale", vale)
      .param("ruta", ruta)
      .param("version", version)
      .param("origen", origen)
      .query()
      .singleRow();
  }

  public JsonNode delVale(int actor, long vale) {
    return leer("SELECT vales.ruta_del_vale(:actor,:vale)::text", actor)
      .param("vale", vale)
      .query(String.class)
      .optional()
      .map(json::readTree)
      .orElseGet(json::nullNode);
  }
}
