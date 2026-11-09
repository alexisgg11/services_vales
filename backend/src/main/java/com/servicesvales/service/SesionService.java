package com.servicesvales.service;

import com.servicesvales.config.OrigenPublico;
import com.servicesvales.model.ContextoAplicacion;
import com.servicesvales.repository.ConsultaValeRepository;
import com.servicesvales.repository.SesionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SesionService {
    private final UsuarioService usuarios;
    private final SesionRepository sesiones;
    private final ConsultaValeRepository consultas;
    private final OrigenPublico origen;

    public SesionService(UsuarioService usuarios, SesionRepository sesiones,
                         ConsultaValeRepository consultas, OrigenPublico origen) {
        this.usuarios = usuarios;
        this.sesiones = sesiones;
        this.consultas = consultas;
        this.origen = origen;
    }

    @Transactional(readOnly = true)
    public ContextoAplicacion cargar(String login) {
        return contexto(usuarios.identificarActor(login), null);
    }

    ContextoAplicacion contexto(int actor, Long idCreado) {
        return new ContextoAplicacion(sesiones.consultarCuenta(actor), consultas.listarDocumentos(actor),
                origen.url(), idCreado);
    }
}
