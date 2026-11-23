package com.servicesvales.modulos.autorizacion.dominio;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public final class OrdenParadas {

  public static final int MAX_PARADAS = 15;

  private OrdenParadas() {}

  public record Recorrido(
    List<Integer> orden,
    Double metrosPrevios,
    double metros
  ) {}

  public static Optional<Recorrido> calcular(Double[][] metros) {
    int paradas = metros.length - 1;
    if (paradas < 0 || paradas > MAX_PARADAS) return Optional.empty();
    if (paradas == 0) return Optional.of(new Recorrido(List.of(), 0.0, 0));

    int todas = (1 << paradas) - 1;
    int base = paradas + 1;
    double[] distancias = new double[(todas + 1) * paradas];
    Arrays.fill(distancias, Double.POSITIVE_INFINITY);
    // Cada ordinal es un dígito en base paradas + 1. Con 15 paradas la
    // secuencia cabe en un long y su orden numérico resuelve los empates.
    long[] ordenes = new long[distancias.length];
    for (int parada = 0; parada < paradas; parada++) {
      Double tramo = metros[0][parada + 1];
      if (tramo == null) continue;
      int estado = (1 << parada) * paradas + parada;
      distancias[estado] = tramo;
      ordenes[estado] = parada + 1L;
    }

    // Cada estado conserva el mejor recorrido para el conjunto visitado y su
    // última parada. Añadir una parada siempre lleva a una máscara mayor.
    for (int visitadas = 1; visitadas < todas; visitadas++) {
      for (int ultima = 0; ultima < paradas; ultima++) {
        int estado = visitadas * paradas + ultima;
        if (ordenes[estado] == 0) continue;
        for (int siguiente = 0; siguiente < paradas; siguiente++) {
          int bit = 1 << siguiente;
          if ((visitadas & bit) != 0) continue;
          Double tramo = metros[ultima + 1][siguiente + 1];
          if (tramo == null) continue;
          int destino = (visitadas | bit) * paradas + siguiente;
          double distancia = distancias[estado] + tramo;
          long orden = ordenes[estado] * base + siguiente + 1;
          if (esMejor(distancia, orden, distancias[destino], ordenes[destino])) {
            distancias[destino] = distancia;
            ordenes[destino] = orden;
          }
        }
      }
    }

    int mejor = todas * paradas;
    for (int estado = mejor + 1; estado < distancias.length; estado++) {
      if (
        esMejor(
          distancias[estado],
          ordenes[estado],
          distancias[mejor],
          ordenes[mejor]
        )
      ) {
        mejor = estado;
      }
    }
    if (ordenes[mejor] == 0) return Optional.empty();

    var orden = new ArrayList<Integer>(paradas);
    for (long secuencia = ordenes[mejor]; secuencia > 0; secuencia /= base) {
      orden.add((int) (secuencia % base) - 1);
    }
    Collections.reverse(orden);
    return Optional.of(
      new Recorrido(
        List.copyOf(orden),
        medirOrdenOriginal(metros),
        distancias[mejor]
      )
    );
  }

  private static boolean esMejor(
    double distancia,
    long orden,
    double mejorDistancia,
    long mejorOrden
  ) {
    return (
      distancia < mejorDistancia ||
      (distancia == mejorDistancia && orden < mejorOrden)
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
}
