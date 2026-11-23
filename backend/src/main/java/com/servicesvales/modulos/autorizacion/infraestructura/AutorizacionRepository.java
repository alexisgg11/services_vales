package com.servicesvales.modulos.autorizacion.infraestructura;

import com.servicesvales.compartido.dominio.LoteVales;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.SqlArrayValue;
import org.springframework.stereotype.Repository;

@Repository
public class AutorizacionRepository {

  private final JdbcClient jdbc;

  public AutorizacionRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public void autorizar(int actor, LoteVales lote) {
    jdbc
      .sql("SELECT count(*) FROM vales.autorizar_vales(:actor, :ids)")
      .param("actor", actor)
      .param("ids", new SqlArrayValue("bigint", lote.ids().toArray()))
      .query(Long.class)
      .single();
  }
}
