package com.servicesvales.modulos.emision.dominio;

import com.servicesvales.compartido.dominio.MotorRutas;
import java.util.*;

/** Inserta el abastecimiento sin cambiar el orden de visita asignado por Jefatura. */
public final class PlanificadorGrifo {

  private PlanificadorGrifo() {}

  public record Trayecto(
    List<Integer> indices,
    double metros,
    double segundos
  ) {}

  public static Optional<Trayecto> medir(
    MotorRutas.Matriz matriz,
    List<Integer> indices
  ) {
    double metros = 0,
      segundos = 0;
    for (int i = 1; i < indices.size(); i++) {
      int a = indices.get(i - 1),
        b = indices.get(i);
      Double m = matriz.metros()[a][b],
        s = matriz.segundos()[a][b];
      if (
        m == null ||
        s == null ||
        !Double.isFinite(m) ||
        !Double.isFinite(s) ||
        m < 0 ||
        s < 0
      ) return Optional.empty();
      metros += m;
      segundos += s;
    }
    return Optional.of(new Trayecto(List.copyOf(indices), metros, segundos));
  }

  public static Optional<Trayecto> insertar(
    MotorRutas.Matriz matriz,
    int paradas,
    int grifo
  ) {
    Trayecto mejor = null;
    for (int antes = 1; antes <= paradas; antes++) {
      var orden = new ArrayList<Integer>();
      orden.add(0);
      for (int p = 1; p <= paradas; p++) {
        if (p == antes) orden.add(grifo);
        orden.add(p);
      }
      var t = medir(matriz, orden);
      if (
        t.isPresent() &&
        (mejor == null ||
          t.get().metros() < mejor.metros() ||
          (t.get().metros() == mejor.metros() &&
            t.get().segundos() < mejor.segundos()))
      ) mejor = t.get();
    }
    return Optional.ofNullable(mejor);
  }
}
