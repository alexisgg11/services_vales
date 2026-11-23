package com.servicesvales.modulos.facturacion.aplicacion;

import com.servicesvales.compartido.dominio.LoteVales;
import com.servicesvales.modulos.facturacion.infraestructura.FacturacionRepository;
import com.servicesvales.modulos.identidad.aplicacion.SesionService;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import com.servicesvales.modulos.identidad.dominio.ContextoAplicacion;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class FacturacionService {

  private final FacturacionRepository contabilidad;
  private final UsuarioService usuarios;
  private final SesionService sesiones;

  public FacturacionService(
    FacturacionRepository contabilidad,
    UsuarioService usuarios,
    SesionService sesiones
  ) {
    this.contabilidad = contabilidad;
    this.usuarios = usuarios;
    this.sesiones = sesiones;
  }

  @Transactional
  public ContextoAplicacion asociarFactura(
    String login,
    long factura,
    LoteVales lote
  ) {
    int actor = usuarios.identificarActor(login);
    contabilidad.asociarFactura(actor, factura, lote);
    return sesiones.contexto(actor, null);
  }
}
