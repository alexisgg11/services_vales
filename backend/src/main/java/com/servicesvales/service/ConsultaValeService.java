package com.servicesvales.service;

import com.servicesvales.config.OrigenPublico;
import com.servicesvales.model.DocumentoVale;
import com.servicesvales.model.FichaVale;
import com.servicesvales.model.OperacionException;
import com.servicesvales.model.VerificacionVale;
import com.servicesvales.repository.ConsultaValeRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class ConsultaValeService {
    private final ConsultaValeRepository consultas;
    private final UsuarioService usuarios;
    private final OrigenPublico origen;

    public ConsultaValeService(ConsultaValeRepository consultas, UsuarioService usuarios, OrigenPublico origen) {
        this.consultas = consultas;
        this.usuarios = usuarios;
        this.origen = origen;
    }

    @Transactional(readOnly = true)
    public JsonNode listar(String login) {
        return consultas.listarReferencias(usuarios.identificarActor(login));
    }

    @Transactional(readOnly = true)
    public FichaVale consultar(String login, UUID idQr) {
        return ficha(usuarios.identificarActor(login), idQr);
    }

    @Transactional(readOnly = true)
    public VerificacionVale verificar(UUID idQr) {
        return consultas.verificarQr(idQr).orElseThrow(() ->
                new OperacionException(OperacionException.Tipo.NO_ENCONTRADO, "Vale no disponible"));
    }

    FichaVale ficha(int actor, UUID idQr) {
        return new FichaVale(obtenerDocumento(actor, idQr).datosParaConsulta(), origen.enlaceVale(idQr));
    }

    DocumentoVale obtenerDocumento(int actor, UUID idQr) {
        return consultas.buscarPorQr(actor, idQr).orElseThrow(() ->
                new OperacionException(OperacionException.Tipo.NO_ENCONTRADO, "Vale no disponible"));
    }
}
