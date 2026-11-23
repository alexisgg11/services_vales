package com.servicesvales.modulos.facturacion.infraestructura;

import com.servicesvales.compartido.dominio.LoteVales;
import java.time.LocalDate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.SqlArrayValue;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class FacturacionRepository {

  private final JdbcClient jdbc;
  private final ObjectMapper json;

  public FacturacionRepository(JdbcClient jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public void asociarFactura(int actor, long factura, LoteVales lote) {
    jdbc
      .sql("SELECT vales.asociar_factura_desde_vales(:actor, :factura, :ids)")
      .param("actor", actor)
      .param("factura", factura)
      .param("ids", new SqlArrayValue("bigint", lote.ids().toArray()))
      .query(Long.class)
      .single();
  }

  public JsonNode consultarGrifo(int actor) {
    return normalizarFactura(
      jdbc
        .sql("SELECT vales.facturacion_grifo(:actor)::text")
        .param("actor", actor)
        .query(String.class)
        .single()
    );
  }

  public JsonNode emitir(
    int actor,
    LoteVales lote,
    java.util.UUID solicitud,
    LocalDate fecha
  ) {
    return normalizarFactura(
      jdbc
        .sql(
          "SELECT vales.emitir_factura_grifo(:actor,:ids,:solicitud,:fecha)::text"
        )
        .param("actor", actor)
        .param("ids", new SqlArrayValue("bigint", lote.ids().toArray()))
        .param("solicitud", solicitud)
        .param("fecha", fecha)
        .query(String.class)
        .single()
    );
  }

  private JsonNode normalizarFactura(String contenido) {
    JsonNode datos = json.readTree(contenido);
    if (datos instanceof tools.jackson.databind.node.ObjectNode objeto) {
      if (objeto.has("codigo_factura")) objeto.put(
        "codigo_factura",
        objeto.path("codigo_factura").asText()
      );
      for (var factura : objeto.path("facturas"))
        if (factura instanceof tools.jackson.databind.node.ObjectNode f) f.put(
          "codigo_factura",
          f.path("codigo_factura").asText()
        );
    }
    return datos;
  }
}
