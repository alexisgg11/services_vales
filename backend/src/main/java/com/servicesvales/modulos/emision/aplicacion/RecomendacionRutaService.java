package com.servicesvales.modulos.emision.aplicacion;

import com.servicesvales.compartido.dominio.MotorRutas;
import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.autorizacion.aplicacion.RutasService;
import com.servicesvales.modulos.emision.dominio.*;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.math.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class RecomendacionRutaService {

  public record ConsultaRuta(
    Long ruta,
    Integer version,
    MotorRutas.Punto origen,
    RecomendacionService.Consulta condiciones,
    String proveedor
  ) {}

  public record OpcionRuta(
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
    String criterio,
    double recorridoKm,
    double minutos,
    double minutosAdicionales,
    List<List<Double>> trazado,
    List<Integer> orden
  ) {}

  public record Resultado(
    JsonNode ruta,
    double baseKm,
    List<OpcionRuta> opciones,
    List<String> omitidos
  ) {}

  private final RutasService rutas;
  private final UsuarioService usuarios;
  private final RecomendacionService precios;
  private final MotorRutas motor;
  private final Set<Integer> enCurso = ConcurrentHashMap.newKeySet();

  public RecomendacionRutaService(
    RutasService rutas,
    UsuarioService usuarios,
    RecomendacionService precios,
    MotorRutas motor
  ) {
    this.rutas = rutas;
    this.usuarios = usuarios;
    this.precios = precios;
    this.motor = motor;
  }

  public Resultado generar(String login, ConsultaRuta q) {
    if (
      q == null ||
      q.ruta() == null ||
      q.version() == null ||
      q.origen() == null ||
      q.condiciones() == null ||
      q.condiciones().fecha() == null
    ) throw OperacionException.invalida(
      "Selecciona una ruta de trabajo y un origen antes de generar la mejor opción."
    );
    int actor = usuarios.identificarActor(login);
    JsonNode ruta = rutas.asignada(actor, q.ruta(), q.condiciones().fecha());
    if (
      ruta.path("version").asInt() != q.version()
    ) throw OperacionException.invalida(
      "La ruta cambió. Actualiza tus rutas y vuelve a intentarlo."
    );
    if (!enCurso.add(actor)) throw OperacionException.invalida(
      "Ya hay un cálculo de ruta en curso."
    );
    try {
      return calcular(login, q, ruta);
    } finally {
      enCurso.remove(actor);
    }
  }

  private Resultado calcular(String login, ConsultaRuta q, JsonNode ruta) {
    var consulta = q.condiciones();
    var candidatos = precios.consultar(login, consulta);
    var ubicados = candidatos
      .stream()
      .filter(o -> o.latitud() != null && o.longitud() != null)
      .toList();
    if (ubicados.size() > 20) throw OperacionException.invalida(
      "La comparación admite hasta veinte grifos por cálculo."
    );
    if (ubicados.isEmpty()) throw OperacionException.invalida(
      "No hay grifos habilitados con precio, saldo y ubicación para esta solicitud."
    );
    var puntos = new ArrayList<MotorRutas.Punto>();
    puntos.add(q.origen());
    for (var p : ruta.path("paradas"))
      puntos.add(
        new MotorRutas.Punto(
          p.path("latitud").asDouble(),
          p.path("longitud").asDouble()
        )
      );
    int n = puntos.size() - 1;
    for (var o : ubicados)
      puntos.add(new MotorRutas.Punto(o.latitud(), o.longitud()));
    var matriz = motor.matriz(puntos);
    var base = PlanificadorGrifo.medir(
      matriz,
      java.util.stream.IntStream.rangeClosed(0, n).boxed().toList()
    ).orElseThrow(() ->
      OperacionException.invalida(
        "No existe un recorrido vial entre las paradas de la ruta. Revisa sus puntos con Jefatura."
      )
    );
    BigDecimal costo =
      consulta.costoKm() == null ? new BigDecimal("0.50") : consulta.costoKm();
    var opciones = new ArrayList<OpcionRuta>();
    var omitidos = new ArrayList<String>();
    candidatos
      .stream()
      .filter(o -> o.latitud() == null || o.longitud() == null)
      .forEach(o -> omitidos.add(o.nombre()));
    for (int i = 0; i < ubicados.size(); i++) {
      var o = ubicados.get(i);
      var recorrido = PlanificadorGrifo.insertar(matriz, n, n + 1 + i);
      if (recorrido.isEmpty()) {
        omitidos.add(o.nombre());
        continue;
      }
      var t = recorrido.get();
      double adicional = Math.max(0, (t.metros() - base.metros()) / 1000);
      BigDecimal traslado = BigDecimal.valueOf(adicional)
        .multiply(costo)
        .setScale(2, RoundingMode.HALF_UP);
      opciones.add(
        new OpcionRuta(
          o.proveedor(),
          o.nombre(),
          o.precio(),
          o.combustible(),
          redondear(adicional),
          traslado,
          o.combustible().add(traslado),
          o.latitud(),
          o.longitud(),
          o.demostracion(),
          "Combustible más desvío vial sobre la ruta asignada.",
          redondear(t.metros() / 1000),
          redondear(t.segundos() / 60),
          redondear(Math.max(0, (t.segundos() - base.segundos()) / 60)),
          List.of(),
          t.indices()
        )
      );
    }
    opciones.sort(
      Comparator.comparing(OpcionRuta::estimado)
        .thenComparing(OpcionRuta::distanciaKm)
        .thenComparing(OpcionRuta::proveedor)
    );
    if (opciones.isEmpty()) throw OperacionException.invalida(
      "Ningún grifo tiene acceso vial al recorrido. Puedes elegir un grifo manualmente."
    );
    int elegido = 0;
    if (q.proveedor() != null) {
      elegido = -1;
      for (int i = 0; i < opciones.size(); i++) if (
        opciones.get(i).proveedor().equals(q.proveedor())
      ) elegido = i;
      if (elegido < 0) throw OperacionException.invalida(
        "El grifo ya no está habilitado para este recorrido."
      );
    }
    var o = opciones.get(elegido);
    var camino = o.orden().stream().map(puntos::get).toList();
    var trazado = motor.trazado(camino);
    opciones.set(
      elegido,
      new OpcionRuta(
        o.proveedor(),
        o.nombre(),
        o.precio(),
        o.combustible(),
        o.distanciaKm(),
        o.traslado(),
        o.estimado(),
        o.latitud(),
        o.longitud(),
        o.demostracion(),
        o.criterio(),
        o.recorridoKm(),
        o.minutos(),
        o.minutosAdicionales(),
        trazado,
        o.orden()
      )
    );
    return new Resultado(
      ruta,
      redondear(base.metros() / 1000),
      opciones,
      omitidos
    );
  }

  private double redondear(double n) {
    return Math.round(n * 100d) / 100d;
  }
}
