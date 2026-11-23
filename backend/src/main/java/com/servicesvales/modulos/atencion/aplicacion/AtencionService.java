package com.servicesvales.modulos.atencion.aplicacion;

import com.servicesvales.modulos.atencion.dominio.AtencionVale;
import com.servicesvales.modulos.atencion.dominio.IdentidadAtencion;
import com.servicesvales.modulos.atencion.dominio.PrecioAtencion;
import com.servicesvales.modulos.atencion.infraestructura.AtencionRepository;
import com.servicesvales.modulos.documentos.aplicacion.ConsultaValeService;
import com.servicesvales.modulos.documentos.dominio.FichaVale;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AtencionService {

  private final AtencionRepository atenciones;
  private final ConsultaValeService consultas;
  private final UsuarioService usuarios;

  public AtencionService(
    AtencionRepository atenciones,
    ConsultaValeService consultas,
    UsuarioService usuarios
  ) {
    this.atenciones = atenciones;
    this.consultas = consultas;
    this.usuarios = usuarios;
  }

  @Transactional(readOnly = true)
  public PrecioAtencion sugerirPrecio(
    String login,
    UUID idQr,
    LocalDate fecha
  ) {
    int actor = usuarios.identificarActor(login);
    long vale = consultas.obtenerDocumento(actor, idQr).id();
    return atenciones.sugerirPrecio(actor, vale, fecha);
  }

  @Transactional(readOnly = true)
  public IdentidadAtencion validarDni(String login, UUID idQr, String dni) {
    int actor = usuarios.identificarActor(login);
    long vale = consultas.obtenerDocumento(actor, idQr).id();
    return atenciones.validarDni(actor, vale, dni);
  }

  @Transactional
  public FichaVale registrar(String login, UUID idQr, AtencionVale datos) {
    int actor = usuarios.identificarActor(login);
    long vale = consultas.obtenerDocumento(actor, idQr).id();
    atenciones.registrar(actor, vale, datos);
    return consultas.ficha(actor, idQr);
  }
}
