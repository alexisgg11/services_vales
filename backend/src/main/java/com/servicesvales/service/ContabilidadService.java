package com.servicesvales.service;

import com.servicesvales.model.ContextoAplicacion;
import com.servicesvales.model.LoteVales;
import com.servicesvales.repository.ContabilidadRepository;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class ContabilidadService {
    private final ContabilidadRepository contabilidad;
    private final UsuarioService usuarios;
    private final SesionService sesiones;

    public ContabilidadService(ContabilidadRepository contabilidad, UsuarioService usuarios, SesionService sesiones) {
        this.contabilidad = contabilidad;
        this.usuarios = usuarios;
        this.sesiones = sesiones;
    }

    @Transactional
    public ContextoAplicacion asociarFactura(String login, long factura, LoteVales lote) {
        int actor = usuarios.identificarActor(login);
        contabilidad.asociarFactura(actor, factura, lote);
        return sesiones.contexto(actor, null);
    }

    @Transactional(readOnly = true)
    public JsonNode consultarGastos(String login, LocalDate mes) {
        return contabilidad.consultarGastos(usuarios.identificarActor(login), mes);
    }
}
