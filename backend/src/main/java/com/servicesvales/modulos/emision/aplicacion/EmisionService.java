package com.servicesvales.modulos.emision.aplicacion;

import com.servicesvales.compartido.dominio.LoteVales;
import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.emision.dominio.EmisionVale;
import com.servicesvales.modulos.emision.infraestructura.EmisionRepository;
import com.servicesvales.modulos.identidad.aplicacion.SesionService;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import com.servicesvales.modulos.identidad.dominio.ContextoAplicacion;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmisionService {

  private final com.servicesvales.modulos.identidad.aplicacion.IdentidadService identidades;
  private final EmisionRepository vales;
  private final UsuarioService usuarios;
  private final SesionService sesiones;
  private final com.servicesvales.modulos.autorizacion.aplicacion.RutasService rutas;

  public EmisionService(
    EmisionRepository vales,
    UsuarioService usuarios,
    SesionService sesiones,
    com.servicesvales.modulos.identidad.aplicacion.IdentidadService identidades,
    com.servicesvales.modulos.autorizacion.aplicacion.RutasService rutas
  ) {
    this.identidades = identidades;
    this.rutas = rutas;
    this.vales = vales;
    this.usuarios = usuarios;
    this.sesiones = sesiones;
  }

  @Transactional
  public ContextoAplicacion registrar(String login, EmisionVale datos) {
    int actor = usuarios.identificarActor(login);
    Integer tercero = resolverTercero(actor, datos);
    long id = vales.registrar(actor, datos, tercero);
    if (datos.rutaId() != null) {
      if (datos.rutaVersion() == null) throw OperacionException.invalida(
        "Actualiza la ruta del trabajo antes de registrar."
      );
      String origen =
        datos.origenRuta() == null
          ? null
          : String.format(
              java.util.Locale.ROOT,
              "{\"latitud\":%s,\"longitud\":%s}",
              datos.origenRuta().latitud(),
              datos.origenRuta().longitud()
            );
      rutas.vincular(actor, id, datos.rutaId(), datos.rutaVersion(), origen);
    }
    return sesiones.contexto(actor, id);
  }

  private Integer resolverTercero(int actor, EmisionVale datos) {
    String documento = datos.tercero();
    boolean tieneDocumento = documento != null && !documento.isBlank();
    boolean tieneDestino =
      datos.destino() != null && !datos.destino().isBlank();
    if (!datos.sinContrato()) {
      if (tieneDocumento || tieneDestino) throw OperacionException.invalida(
        "El tercero se registra solo en la modalidad sin contrato."
      );
      return null;
    }
    if (!tieneDocumento && !tieneDestino) return null;
    if (
      !tieneDocumento || !documento.strip().matches("[0-9]{8}")
    ) throw OperacionException.invalida(
      "Indica el DNI de ocho dígitos del tercero."
    );
    if (!tieneDestino) throw OperacionException.invalida(
      "Indica el destino o motivo del vale sin contrato."
    );
    return vales
      .buscarTercero(actor, documento)
      .orElseGet(() -> identidades.registrarTercero(actor, documento));
  }
}
