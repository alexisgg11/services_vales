package com.servicesvales.repository;

import com.servicesvales.model.EmisionVale;
import com.servicesvales.model.LoteVales;
import java.util.Objects;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.SqlArrayValue;
import org.springframework.stereotype.Repository;

@Repository
public class ValeRepository {
    private final JdbcClient jdbc;

    public ValeRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Integer> buscarTercero(int actor, String documento) {
        return jdbc.sql("SELECT vales.tercero_aplicacion(:actor, :documento)")
                .param("actor", actor).param("documento", documento)
                .query((rs, fila) -> rs.getObject(1, Integer.class)).list().stream()
                .filter(Objects::nonNull).findFirst();
    }

    public long registrar(int actor, EmisionVale datos, Integer tercero) {
        return jdbc.sql("""
                SELECT (vales.registrar_vale(:actor, :dni, :proveedor, :suministro, :cantidad,
                    :observacion, :tercero, :destino, :fecha, :localidad, :unidadMovil, :centro, :sinContrato)).id_vale
                """)
                .param("actor", actor).param("dni", datos.dni()).param("proveedor", datos.proveedor())
                .param("suministro", datos.suministro()).param("cantidad", datos.cantidad())
                .param("observacion", datos.observacion()).param("tercero", tercero)
                .param("destino", datos.destino()).param("fecha", datos.fecha())
                .param("centro", datos.centro()).param("localidad", datos.localidad())
                .param("unidadMovil", datos.unidadMovil()).param("sinContrato", datos.sinContrato())
                .query(Long.class).single();
    }

    public void autorizar(int actor, LoteVales lote) {
        jdbc.sql("SELECT count(*) FROM vales.autorizar_vales(:actor, :ids)")
                .param("actor", actor).param("ids", new SqlArrayValue("bigint", lote.ids().toArray()))
                .query(Long.class).single();
    }

    public void anular(int actor, long id, String motivo) {
        jdbc.sql("SELECT (vales.anular_vale(:actor, :id, :motivo)).id_vale")
                .param("actor", actor).param("id", id).param("motivo", motivo).query(Long.class).single();
    }
}
