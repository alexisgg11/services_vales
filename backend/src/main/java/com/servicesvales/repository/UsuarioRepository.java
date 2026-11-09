package com.servicesvales.repository;

import com.servicesvales.model.CuentaAcceso;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UsuarioRepository {
    private final JdbcClient jdbc;

    public UsuarioRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<CuentaAcceso> buscarActiva(String login) {
        return jdbc.sql("""
                SELECT id_usuario, login, clave_hash FROM vales.usuario
                WHERE login = :login AND activo AND clave_hash IS NOT NULL
                """)
                .param("login", login)
                .query((rs, fila) -> new CuentaAcceso(rs.getInt("id_usuario"), rs.getString("login"), rs.getString("clave_hash")))
                .optional();
    }
}
