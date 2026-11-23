package com.servicesvales.modulos.autorizacion.aplicacion;

import com.servicesvales.compartido.dominio.MotorRutas;
import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.autorizacion.dominio.OrdenParadas;
import com.servicesvales.modulos.identidad.aplicacion.SesionService;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class OptimizacionRutaService {

  public record Coordenadas(Double latitud, Double longitud) {}

  public record Consulta(
    String zonal,
    Coordenadas origen,
    List<Coordenadas> paradas
  ) {}

  public record Resultado(
    List<Integer> orden,
    Double distanciaActualKm,
    double distanciaOptimaKm
  ) {}

  private record PuntosAutorizados(int actor, List<MotorRutas.Punto> puntos) {}

  private final UsuarioService usuarios;
  private final SesionService sesiones;
  private final MotorRutas motor;
  private final Set<Integer> enCurso = ConcurrentHashMap.newKeySet();

  public OptimizacionRutaService(
    UsuarioService usuarios,
    SesionService sesiones,
    MotorRutas motor
  ) {
    this.usuarios = usuarios;
    this.sesiones = sesiones;
    this.motor = motor;
  }

  public Resultado optimizar(String login, Consulta consulta) {
    var ruta = preparar(login, consulta, 2);
    if (!enCurso.add(ruta.actor())) throw OperacionException.invalida(
      "Ya se está optimizando una ruta."
    );
    try {
      var recorrido = OrdenParadas.calcular(
        distancias(ruta.puntos())
      ).orElseThrow(() ->
        OperacionException.invalida(
          "No hay un recorrido vial que conecte todas las paradas. Revisa sus ubicaciones."
        )
      );
      Double anterior = recorrido.metrosPrevios();
      return new Resultado(
        recorrido.orden(),
        anterior == null ? null : anterior / 1000,
        recorrido.metros() / 1000
      );
    } finally {
      enCurso.remove(ruta.actor());
    }
  }

  public MotorRutas.Recorrido trazar(String login, Consulta consulta) {
    var ruta = preparar(login, consulta, 1);
    try {
      return motor.recorridoOrdenado(ruta.puntos());
    } catch (OperacionException error) {
      throw OperacionException.invalida(
        "No se pudo trazar el recorrido por calles. Revisa los puntos o reintenta."
      );
    }
  }

  private PuntosAutorizados preparar(
    String login,
    Consulta consulta,
    int minimoParadas
  ) {
    if (
      consulta == null ||
      consulta.zonal() == null ||
      consulta.zonal().isBlank() ||
      consulta.paradas() == null ||
      consulta.paradas().size() < minimoParadas ||
      consulta.paradas().size() > 8
    ) throw OperacionException.invalida(
      "Selecciona una zonal y entre " + minimoParadas + " y 8 paradas."
    );

    int actor = usuarios.identificarActor(login);
    boolean jefeZonal = sesiones
      .cuenta(actor)
      .path("roles")
      .valueStream()
      .anyMatch(
        rol ->
          "JEFE".equals(rol.path("codigo_rol").asText()) &&
          consulta.zonal().equals(rol.path("cod_zonal").asText())
      );
    if (!jefeZonal) throw new OperacionException(
      OperacionException.Tipo.SIN_PERMISO,
      "Solo Jefatura puede planificar recorridos de su zonal."
    );

    var puntos = new ArrayList<MotorRutas.Punto>();
    puntos.add(punto(consulta.origen()));
    for (var parada : consulta.paradas()) puntos.add(punto(parada));
    return new PuntosAutorizados(actor, puntos);
  }

  private MotorRutas.Punto punto(Coordenadas valor) {
    if (valor != null && valor.latitud() != null && valor.longitud() != null) {
      try {
        return new MotorRutas.Punto(valor.latitud(), valor.longitud());
      } catch (IllegalArgumentException error) {
        throw OperacionException.invalida(
          "Selecciona coordenadas válidas para la partida y las paradas."
        );
      }
    }
    throw OperacionException.invalida(
      "Ubica la partida y todas las paradas en el mapa."
    );
  }

  private Double[][] distancias(List<MotorRutas.Punto> puntos) {
    try {
      return motor.matriz(puntos).metros();
    } catch (OperacionException error) {
      throw OperacionException.invalida(
        "No se pudo consultar el recorrido vial. Reintenta o ajusta el orden manualmente."
      );
    }
  }
}
