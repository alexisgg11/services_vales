package com.servicesvales.modulos.autorizacion.dominio;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class OrdenParadas {

  private OrdenParadas() {}

  public record Recorrido(
    List<Integer> orden,
    Double metrosPrevios,
    double metros
  ) {}

  public static Optional<Recorrido> calcular(Double[][] metros) {
    var busqueda = new Busqueda(metros);
    busqueda.visitar(0, 0, new ArrayList<>());
    return Optional.ofNullable(busqueda.mejorOrden).map(orden ->
      new Recorrido(orden, medirOrdenOriginal(metros), busqueda.mejorDistancia)
    );
  }

  private static Double medirOrdenOriginal(Double[][] metros) {
    double total = 0;
    for (int parada = 1; parada < metros.length; parada++) {
      Double tramo = metros[parada - 1][parada];
      if (tramo == null) return null;
      total += tramo;
    }
    return total;
  }

  private static final class Busqueda {

    private final Double[][] metros;
    private final boolean[] visitadas;
    private List<Integer> mejorOrden;
    private double mejorDistancia = Double.POSITIVE_INFINITY;

    private Busqueda(Double[][] metros) {
      this.metros = metros;
      this.visitadas = new boolean[metros.length];
    }

    private void visitar(int desde, double distancia, List<Integer> orden) {
      if (distancia >= mejorDistancia) return;
      if (orden.size() == metros.length - 1) {
        mejorOrden = List.copyOf(orden);
        mejorDistancia = distancia;
        return;
      }
      // La matriz empieza por el origen. Se prueban primero las paradas
      // en su orden actual para conservarlo si empata con el mejor.
      for (int hasta = 1; hasta < metros.length; hasta++) {
        Double tramo = metros[desde][hasta];
        if (visitadas[hasta] || tramo == null) continue;
        visitadas[hasta] = true;
        orden.add(hasta - 1);
        visitar(hasta, distancia + tramo, orden);
        orden.remove(orden.size() - 1);
        visitadas[hasta] = false;
      }
    }
  }
}
