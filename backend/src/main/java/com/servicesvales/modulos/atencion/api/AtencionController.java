package com.servicesvales.modulos.atencion.api;

import com.servicesvales.compartido.api.ConsultaValeResponse;
import com.servicesvales.modulos.atencion.aplicacion.AtencionService;
import com.servicesvales.modulos.atencion.dominio.IdentidadAtencion;
import java.security.Principal;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({ "/api/vales/qr/{idQr}", "/api/v1/atencion/vales/{idQr}" })
public class AtencionController {

  private final AtencionService atenciones;

  public AtencionController(AtencionService atenciones) {
    this.atenciones = atenciones;
  }

  public record DniPresentado(String dni) {}

  @PostMapping("/validar-dni")
  public IdentidadAtencion validarDni(
    Principal principal,
    @PathVariable UUID idQr,
    @RequestBody DniPresentado datos
  ) {
    return atenciones.validarDni(principal.getName(), idQr, datos.dni());
  }

  @GetMapping("/precio")
  public PrecioAtencionResponse sugerirPrecio(
    Principal principal,
    @PathVariable UUID idQr,
    @RequestParam LocalDate fecha
  ) {
    return PrecioAtencionResponse.desde(
      atenciones.sugerirPrecio(principal.getName(), idQr, fecha)
    );
  }

  @PostMapping("/atencion")
  public ConsultaValeResponse registrar(
    Principal principal,
    @PathVariable UUID idQr,
    @RequestBody RegistrarAtencionRequest datos
  ) {
    return ConsultaValeResponse.desde(
      atenciones.registrar(principal.getName(), idQr, datos.aModelo())
    );
  }
}
