package com.servicesvales.service;

import com.servicesvales.model.CuentaAcceso;
import com.servicesvales.model.OperacionException;
import com.servicesvales.repository.UsuarioRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {
    private final UsuarioRepository usuarios;

    public UsuarioService(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    public Optional<CuentaAcceso> buscarActiva(String login) {
        return usuarios.buscarActiva(login);
    }

    public int identificarActor(String login) {
        return buscarActiva(login).orElseThrow(() ->
                new OperacionException(OperacionException.Tipo.SIN_PERMISO, "La cuenta no está habilitada.")).id();
    }
}
