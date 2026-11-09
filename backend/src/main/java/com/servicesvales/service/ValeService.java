package com.servicesvales.service;

import com.servicesvales.model.ContextoAplicacion;
import com.servicesvales.model.EmisionVale;
import com.servicesvales.model.LoteVales;
import com.servicesvales.model.OperacionException;
import com.servicesvales.repository.ValeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ValeService {
    private final ValeRepository vales;
    private final UsuarioService usuarios;
    private final SesionService sesiones;

    public ValeService(ValeRepository vales, UsuarioService usuarios, SesionService sesiones) {
        this.vales = vales;
        this.usuarios = usuarios;
        this.sesiones = sesiones;
    }

    @Transactional
    public ContextoAplicacion registrar(String login, EmisionVale datos) {
        int actor = usuarios.identificarActor(login);
        Integer tercero = resolverTercero(actor, datos);
        long id = vales.registrar(actor, datos, tercero);
        return sesiones.contexto(actor, id);
    }

    private Integer resolverTercero(int actor, EmisionVale datos) {
        String documento = datos.tercero();
        boolean tieneDocumento = documento != null && !documento.isBlank();
        boolean tieneDestino = datos.destino() != null && !datos.destino().isBlank();
        if (!datos.sinContrato()) {
            if (tieneDocumento || tieneDestino)
                throw OperacionException.invalida("El tercero se registra solo en la modalidad sin contrato.");
            return null;
        }
        if (!tieneDocumento && !tieneDestino) return null;
        if (!tieneDocumento || !documento.strip().matches("[0-9]{8}"))
            throw OperacionException.invalida("Indica el DNI de ocho dígitos del tercero.");
        if (!tieneDestino)
            throw OperacionException.invalida("Indica el destino o motivo del vale sin contrato.");
        return vales.buscarTercero(actor, documento).orElseThrow(() ->
                OperacionException.invalida("Indica el DNI de un tercero registrado."));
    }

    @Transactional
    public ContextoAplicacion autorizar(String login, LoteVales lote) {
        int actor = usuarios.identificarActor(login);
        vales.autorizar(actor, lote);
        return sesiones.contexto(actor, null);
    }

    @Transactional
    public ContextoAplicacion anular(String login, long id, String motivo) {
        int actor = usuarios.identificarActor(login);
        vales.anular(actor, id, motivo);
        return sesiones.contexto(actor, null);
    }
}
