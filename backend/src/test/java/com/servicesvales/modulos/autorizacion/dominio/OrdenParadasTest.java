package com.servicesvales.modulos.autorizacion.dominio;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class OrdenParadasTest {

  @Test
  void comparaElRecorridoCompletoEnUnaMatrizDirigida() {
    Double[][] metros = {
      { 0.0, 1.0, 2.0, 8.0 },
      { 1.0, 0.0, 1.0, 2.0 },
      { 1.0, 20.0, 0.0, 30.0 },
      { 1.0, 10.0, 1.0, 0.0 },
    };

    var recorrido = OrdenParadas.calcular(metros).orElseThrow();
    assertEquals(List.of(0, 2, 1), recorrido.orden());
    assertEquals(32.0, recorrido.metrosPrevios());
    assertEquals(4.0, recorrido.metros());
  }

  @Test
  void conservaElOrdenOriginalSiTieneElMismoCosto() {
    Double[][] metros = {
      { 0.0, 2.0, 1.0 },
      { 9.0, 0.0, 2.0 },
      { 1.0, 3.0, 0.0 },
    };

    var recorrido = OrdenParadas.calcular(metros).orElseThrow();
    assertEquals(List.of(0, 1), recorrido.orden());
    assertEquals(4.0, recorrido.metros());
  }

  @Test
  void encuentraUnOrdenAlternativoSiAlOrdenActualLeFaltaUnTramo() {
    Double[][] metros = {
      { 0.0, 1.0, 3.0 },
      { 12.0, 0.0, null },
      { 5.0, 2.0, 0.0 },
    };

    var recorrido = OrdenParadas.calcular(metros).orElseThrow();
    assertEquals(List.of(1, 0), recorrido.orden());
    assertNull(recorrido.metrosPrevios());
    assertEquals(5.0, recorrido.metros());
  }

  @Test
  void noSugiereUnOrdenSiNingunoCubreTodasLasParadas() {
    Double[][] metros = {
      { 0.0, 1.0, 3.0 },
      { 12.0, 0.0, null },
      { 5.0, null, 0.0 },
    };

    assertTrue(OrdenParadas.calcular(metros).isEmpty());
  }
}
