package com.servicesvales.repository;

import com.servicesvales.model.RespaldoFactura;
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

    public JsonNode validarTickets(int actor, long factura, RespaldoFactura respaldo) {
        String resultado = jdbc.sql("SELECT vales.validar_tickets_factura(:actor, :factura, :tickets)::text")
                .param("actor", actor).param("factura", factura)
                .param("tickets", new SqlArrayValue("text", respaldo.tickets().toArray()))
                .query(String.class).single();
        return json.readTree(resultado);
    }

    public void asociarFactura(int actor, long factura, RespaldoFactura respaldo) {
        jdbc.sql("SELECT vales.asociar_factura_con_tickets(:actor, :factura, :tickets, :origen, :referencia)")
                .param("actor", actor).param("factura", factura)
                .param("tickets", new SqlArrayValue("text", respaldo.tickets().toArray()))
                .param("origen", respaldo.origen()).param("referencia", respaldo.referenciaAnexo())
                .query(Long.class).single();
    }

    public JsonNode consultarGastos(int actor, LocalDate mes) {
        String gastos = jdbc.sql("SELECT vales.consultar_gastos(:actor, :mes)::text")
                .param("actor", actor).param("mes", mes).query(String.class).single();
        return json.readTree(gastos);
    }
}
