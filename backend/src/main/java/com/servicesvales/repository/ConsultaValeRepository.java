package com.servicesvales.repository;

import com.servicesvales.model.DocumentoVale;
import com.servicesvales.model.VerificacionVale;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

@Repository
public class ConsultaValeRepository {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public ConsultaValeRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public JsonNode listarDocumentos(int actor) {
        String documentos = jdbc.sql("SELECT vales.listar_documentos_aplicacion(:actor)::text")
                .param("actor", actor).query(String.class).single();
        return json.readTree(documentos);
    }

    public JsonNode listarReferencias(int actor) {
        String referencias = jdbc.sql("""
                SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'id_qr', v.id_qr, 'codigo_vale', v.codigo_vale, 'cod_zonal', v.cod_zonal,
                    'estado_vale', v.estado_vale, 'fecha_emision', v.fecha_emision
                ) ORDER BY v.fecha_emision DESC, v.id_vale DESC), '[]'::jsonb)::text
                FROM vales.listar_vales(:actor) v
                """).param("actor", actor).query(String.class).single();
        return json.readTree(referencias);
    }

    public Optional<DocumentoVale> buscarPorQr(int actor, UUID idQr) {
        try {
            return jdbc.sql("SELECT vales.consultar_vale_qr(:actor, :idQr)::text")
                    .param("actor", actor).param("idQr", idQr)
                    .query((rs, fila) -> rs.getString(1)).list().stream()
                    .filter(Objects::nonNull).findFirst().map(this::mapearDocumento);
        } catch (DataAccessException error) {
            if (error.getMostSpecificCause() instanceof SQLException sql && "42501".equals(sql.getSQLState()))
                return Optional.empty();
            throw error;
        }
    }

    public Optional<VerificacionVale> verificarQr(UUID idQr) {
        return jdbc.sql("SELECT codigo, grifo, fecha_emision, estado FROM vales.verificar_vale_qr(:idQr)")
                .param("idQr", idQr)
                .query((rs, fila) -> new VerificacionVale(rs.getString("codigo"), rs.getString("grifo"),
                        rs.getObject("fecha_emision", LocalDate.class), rs.getShort("estado")))
                .optional();
    }

    private DocumentoVale mapearDocumento(String contenido) {
        ObjectNode datos = (ObjectNode) json.readTree(contenido);
        return new DocumentoVale(datos.path("id_vale").asLong(), datos);
    }
}
