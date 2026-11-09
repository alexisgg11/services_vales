package com.servicesvales.service;

import com.servicesvales.model.AtencionVale;
import com.servicesvales.model.FichaVale;
import com.servicesvales.model.PrecioAtencion;
import com.servicesvales.repository.AtencionRepository;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AtencionService {
    private final AtencionRepository atenciones;
    private final ConsultaValeService consultas;
    private final UsuarioService usuarios;

    public AtencionService(AtencionRepository atenciones, ConsultaValeService consultas, UsuarioService usuarios) {
        this.atenciones = atenciones;
        this.consultas = consultas;
        this.usuarios = usuarios;
    }

    @Transactional(readOnly = true)
    public PrecioAtencion sugerirPrecio(String login, UUID idQr, LocalDate fecha) {
        int actor = usuarios.identificarActor(login);
        long vale = consultas.obtenerDocumento(actor, idQr).id();
        return atenciones.sugerirPrecio(actor, vale, fecha);
    }

    @Transactional
    public FichaVale registrar(String login, UUID idQr, AtencionVale datos) {
        int actor = usuarios.identificarActor(login);
        long vale = consultas.obtenerDocumento(actor, idQr).id();
        atenciones.registrar(actor, vale, datos);
        return consultas.ficha(actor, idQr);
    }
}
