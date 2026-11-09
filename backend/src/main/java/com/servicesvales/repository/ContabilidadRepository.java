package com.servicesvales.repository;

import com.servicesvales.model.LoteVales;
import java.time.LocalDate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.SqlArrayValue;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class ContabilidadRepository {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public ContabilidadRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void asociarFactura(int actor, long factura, LoteVales lote) {
        jdbc.sql("SELECT (vales.asociar_factura(:actor, :factura, :ids)).codigo_factura")
                .param("actor", actor).param("factura", factura)
                .param("ids", new SqlArrayValue("bigint", lote.ids().toArray())).query(Long.class).single();
    }

    public JsonNode consultarGastos(int actor, LocalDate mes) {
        String gastos = jdbc.sql("SELECT vales.consultar_gastos(:actor, :mes)::text")
                .param("actor", actor).param("mes", mes).query(String.class).single();
        return json.readTree(gastos);
    }
}
