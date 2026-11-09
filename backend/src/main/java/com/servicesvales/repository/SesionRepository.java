package com.servicesvales.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class SesionRepository {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public SesionRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public JsonNode consultarCuenta(int actor) {
        String datos = jdbc.sql("SELECT vales.contexto_aplicacion(:actor)::text")
                .param("actor", actor).query(String.class).single();
        return json.readTree(datos);
    }
}
