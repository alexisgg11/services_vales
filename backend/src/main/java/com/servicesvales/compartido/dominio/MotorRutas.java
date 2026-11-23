package com.servicesvales.compartido.dominio;

import java.util.List;

public interface MotorRutas {
  record Punto(double latitud, double longitud) {
    public Punto {
      if (
        !Double.isFinite(latitud) ||
        !Double.isFinite(longitud) ||
        Math.abs(latitud) > 90 ||
        Math.abs(longitud) > 180
      ) throw new IllegalArgumentException("Punto no válido");
    }
  }

  record Matriz(Double[][] metros, Double[][] segundos) {}

  record Recorrido(
    List<List<Double>> trazado,
    double metros,
    double segundos,
    List<Double> distanciasAVia
  ) {}

  Matriz matriz(List<Punto> puntos);
  List<List<Double>> trazado(List<Punto> puntos);
  Recorrido recorridoOrdenado(List<Punto> puntos);
}
