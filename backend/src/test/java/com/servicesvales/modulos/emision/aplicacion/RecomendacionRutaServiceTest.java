package com.servicesvales.modulos.emision.aplicacion;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.servicesvales.compartido.dominio.MotorRutas;
import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.autorizacion.aplicacion.RutasService;
import com.servicesvales.modulos.emision.dominio.*;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class RecomendacionRutaServiceTest {

  final UsuarioService usuarios = mock(UsuarioService.class);
  final RutasService rutas = mock(RutasService.class);
  final RecomendacionService precios = mock(RecomendacionService.class);
  final MotorRutas motor = mock(MotorRutas.class);
  final RecomendacionRutaService service = new RecomendacionRutaService(
    rutas,
    usuarios,
    precios,
    motor
  );
  final RecomendacionService.Consulta condiciones =
    new RecomendacionService.Consulta(
      LocalDate.of(2026, 11, 21),
      "CONTRATO",
      "B5",
      new BigDecimal("2"),
      null,
      null,
      new BigDecimal("0.50")
    );
  final RecomendacionRutaService.ConsultaRuta consulta =
    new RecomendacionRutaService.ConsultaRuta(
      1L,
      1,
      new MotorRutas.Punto(-5.2, -80.6),
      condiciones,
      null
    );

  void preparar() {
    when(usuarios.identificarActor("operativo")).thenReturn(5);
    when(rutas.asignada(eq(5), eq(1L), any())).thenReturn(
      new ObjectMapper().readTree(
        "{\"id\":\"1\",\"version\":1,\"paradas\":[{\"latitud\":-5.1,\"longitud\":-80.5}]}"
      )
    );
  }

  RecomendacionService.Opcion opcion(String id, String precio) {
    var p = new BigDecimal(precio);
    var total = p.multiply(new BigDecimal("2"));
    return new RecomendacionService.Opcion(
      id,
      id,
      p,
      total,
      null,
      null,
      total,
      -5.15,
      -80.55,
      false,
      ""
    );
  }

  @Test
  void combinaPrecioConDesvioEnLugarDeElegirSoloElMasCercano() {
    preparar();
    when(precios.consultar(anyString(), any())).thenReturn(
      List.of(opcion("cercano", "25"), opcion("en-ruta", "24"))
    );
    // 0 origen, 1 destino, 2 cercano al origen con desvío de 6 km, 3 en ruta con desvío de 1 km.
    Double[][] m = {
      { 0d, 10000d, 1000d, 5000d },
      { 10000d, 0d, 15000d, 6000d },
      { 1000d, 15000d, 0d, 7000d },
      { 5000d, 6000d, 7000d, 0d },
    };
    when(motor.matriz(anyList())).thenReturn(new MotorRutas.Matriz(m, m));
    when(motor.trazado(anyList())).thenReturn(
      List.of(List.of(-5.2, -80.6), List.of(-5.1, -80.5))
    );
    var r = service.generar("operativo", consulta);
    assertEquals("en-ruta", r.opciones().get(0).proveedor());
    assertEquals(1d, r.opciones().get(0).distanciaKm());
    assertEquals(new BigDecimal("48.50"), r.opciones().get(0).estimado());
    assertEquals(new BigDecimal("48"), r.opciones().get(0).combustible());
    assertEquals(10d, r.baseKm());
  }

  @Test
  void rechazaRutaAjenaAntesDeConsultarProveedor() {
    preparar();
    when(rutas.asignada(anyInt(), anyLong(), any())).thenThrow(
      OperacionException.invalida("Ruta ajena")
    );
    assertThrows(OperacionException.class, () ->
      service.generar("operativo", consulta)
    );
    verifyNoInteractions(motor, precios);
  }

  @Test
  void rechazaVersionDesactualizada() {
    preparar();
    assertThrows(OperacionException.class, () ->
      service.generar(
        "operativo",
        new RecomendacionRutaService.ConsultaRuta(
          1L,
          2,
          consulta.origen(),
          condiciones,
          null
        )
      )
    );
    verifyNoInteractions(motor, precios);
  }

  @Test
  void respetaOrdenAlInsertarGrifoEntreTrabajos() {
    Double[][] m = {
      { 0d, 10d, 20d, 15d },
      { 10d, 0d, 10d, 2d },
      { 20d, 10d, 0d, 20d },
      { 15d, 2d, 10d, 0d },
    };
    var r = PlanificadorGrifo.insertar(
      new MotorRutas.Matriz(m, m),
      2,
      3
    ).orElseThrow();
    assertEquals(List.of(0, 1, 3, 2), r.indices());
    assertEquals(22d, r.metros());
  }

  @Test
  void noInventaUnRecorridoSiNoExisteAccesoVial() {
    Double[][] m = {
      { 0d, 10d, null },
      { 10d, 0d, null },
      { null, null, 0d },
    };
    assertTrue(
      PlanificadorGrifo.insertar(new MotorRutas.Matriz(m, m), 1, 2).isEmpty()
    );
  }

  @Test
  void validaCoordenadas() {
    assertThrows(IllegalArgumentException.class, () ->
      new MotorRutas.Punto(Double.NaN, 0)
    );
  }
}
