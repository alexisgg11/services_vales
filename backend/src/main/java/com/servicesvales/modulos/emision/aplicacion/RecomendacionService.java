package com.servicesvales.modulos.emision.aplicacion;

import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.emision.infraestructura.RecomendacionRepository;
import com.servicesvales.modulos.identidad.aplicacion.SesionService;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.math.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class RecomendacionService {

  public record Consulta(
    LocalDate fecha,
    String modalidad,
    String suministro,
    BigDecimal galones,
    Double latitud,
    Double longitud,
    BigDecimal costoKm
  ) {}

  public record Opcion(
    String proveedor,
    String nombre,
    BigDecimal precio,
    BigDecimal combustible,
    Double distanciaKm,
    BigDecimal traslado,
    BigDecimal estimado,
    Double latitud,
    Double longitud,
    boolean demostracion,
    String criterio
  ) {}

  private final UsuarioService usuarios;
  private final SesionService sesiones;
  private final RecomendacionRepository repository;

  public RecomendacionService(
    UsuarioService usuarios,
    SesionService sesiones,
    RecomendacionRepository repository
  ) {
    this.usuarios = usuarios;
    this.sesiones = sesiones;
    this.repository = repository;
  }

  public List<Opcion> consultar(String login, Consulta q) {
    if (
      q.fecha() == null ||
      q.galones() == null ||
      q.galones().signum() <= 0 ||
      q.galones().compareTo(new BigDecimal("1000000")) > 0 ||
      q.suministro() == null ||
      !List.of("CONTRATO", "SC_TRABAJADOR", "SC_TERCERO").contains(
        q.modalidad()
      )
    ) throw OperacionException.invalida(
      "Indica modalidad, fecha, combustible y galones válidos."
    );
    if (
      (q.latitud() == null) != (q.longitud() == null) ||
      (q.latitud() != null &&
        (!Double.isFinite(q.latitud()) ||
          !Double.isFinite(q.longitud()) ||
          Math.abs(q.latitud()) > 90 ||
          Math.abs(q.longitud()) > 180))
    ) throw OperacionException.invalida(
      "El origen debe tener coordenadas válidas."
    );
    BigDecimal costo = q.costoKm() == null ? BigDecimal.ZERO : q.costoKm();
    if (
      costo.signum() < 0 || costo.compareTo(new BigDecimal("1000")) > 0
    ) throw OperacionException.invalida(
      "Indica un costo por kilómetro entre 0 y 1000."
    );
    int actor = usuarios.identificarActor(login);
    var ubicaciones = repository.ubicaciones(actor);
    var contexto = sesiones.cuenta(actor);
    var resultado = new ArrayList<Opcion>();
    String fecha = q.fecha().toString();
    for (var p : contexto.path("proveedores")) {
      String id = p.path("cod_proveedor").asText();
      var vigentes = new ArrayList<JsonNode>();
      boolean vencido = false;
      for (var c : contexto.path("contratos"))
        if (id.equals(c.path("proveedor").asText())) {
          vencido |= c.path("fin").asText().compareTo(fecha) < 0;
          if (
            c.path("activo").asBoolean() &&
            c.path("inicio").asText().compareTo(fecha) <= 0 &&
            c.path("fin").asText().compareTo(fecha) >= 0
          ) vigentes.add(c);
        }
      BigDecimal precio = null;
      if ("CONTRATO".equals(q.modalidad())) {
        if (vigentes.size() != 1) continue;
        var c = vigentes.get(0);
        var valor = c.path("precios").path(q.suministro());
        if (!valor.isNumber()) continue;
        precio = valor.decimalValue();
        if (
          c
            .path("saldo")
            .decimalValue()
            .compareTo(
              precio.multiply(q.galones()).setScale(2, RoundingMode.HALF_UP)
            ) < 0
        ) continue;
      } else {
        if (
          "SC_TRABAJADOR".equals(q.modalidad()) &&
          (!vencido || !vigentes.isEmpty())
        ) continue;
        String ultima = "";
        for (var t : contexto.path("tarifas"))
          if (
            id.equals(t.path("proveedor").asText()) &&
            q.suministro().equals(t.path("suministro").asText()) &&
            t.path("inicio").asText().compareTo(fecha) <= 0 &&
            t.path("inicio").asText().compareTo(ultima) >= 0
          ) {
            ultima = t.path("inicio").asText();
            precio = t.path("precio").decimalValue();
          }
      }
      if (precio == null || precio.signum() <= 0) continue;
      Double lat = null,
        lon = null,
        km = null;
      boolean demo = false;
      for (var u : ubicaciones)
        if (id.equals(u.path("cod_proveedor").asText())) {
          lat = u.path("latitud").asDouble();
          lon = u.path("longitud").asDouble();
          demo = u.path("demostracion").asBoolean();
        }
      if (q.latitud() != null && lat != null) km =
        Math.round(distancia(q.latitud(), q.longitud(), lat, lon) * 100d) /
        100d;
      BigDecimal combustible = precio
          .multiply(q.galones())
          .setScale(2, RoundingMode.HALF_UP),
        traslado =
          km == null
            ? null
            : BigDecimal.valueOf(km * 2)
                .multiply(costo)
                .setScale(2, RoundingMode.HALF_UP);
      resultado.add(
        new Opcion(
          id,
          p.path("razon_social").asText(),
          precio,
          combustible,
          km,
          traslado,
          combustible.add(traslado == null ? BigDecimal.ZERO : traslado),
          lat,
          lon,
          demo,
          km == null
            ? "Ordenado por combustible. Falta un origen o ubicación del grifo para estimar traslado."
            : "Distancia en línea recta, ida y vuelta. El costo por km es un supuesto; no representa una ruta vial."
        )
      );
    }
    resultado.sort(
      Comparator.comparing(Opcion::estimado).thenComparing(Opcion::proveedor)
    );
    return resultado;
  }

  static double distancia(double a, double b, double c, double d) {
    double x = Math.sin(Math.toRadians(c - a) / 2),
      y = Math.sin(Math.toRadians(d - b) / 2);
    return (
      6371 *
      2 *
      Math.asin(
        Math.min(
          1,
          Math.sqrt(
            x * x +
              Math.cos(Math.toRadians(a)) * Math.cos(Math.toRadians(c)) * y * y
          )
        )
      )
    );
  }
}
