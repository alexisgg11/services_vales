package com.servicesvales.modulos.anulacion.infraestructura;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AnulacionRepository {

  private final JdbcClient jdbc;

  public AnulacionRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public void anular(int actor, long id, String motivo) {
    jdbc
      .sql("SELECT (vales.anular_vale(:actor, :id, :motivo)).id_vale")
      .param("actor", actor)
      .param("id", id)
      .param("motivo", motivo)
      .query(Long.class)
      .single();
  }
}
