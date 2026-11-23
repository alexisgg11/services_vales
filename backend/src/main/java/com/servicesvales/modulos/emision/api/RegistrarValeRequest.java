package com.servicesvales.modulos.emision.api;

import com.servicesvales.compartido.dominio.MotorRutas;
import com.servicesvales.modulos.emision.dominio.EmisionVale;
import java.math.BigDecimal;
import java.time.LocalDate;

public record RegistrarValeRequest(
  String dni,
  String proveedor,
  String suministro,
  BigDecimal cantidad,
  String observacion,
  boolean sinContrato,
  String tercero,
  String destino,
  LocalDate fecha,
  String centro,
  String localidad,
  Integer unidadMovil,
  Long rutaId,
  Integer rutaVersion,
  MotorRutas.Punto origenRuta
) {
  public EmisionVale aModelo() {
    return new EmisionVale(
      dni,
      proveedor,
      suministro,
      cantidad,
      observacion,
      sinContrato,
      tercero,
      destino,
      fecha,
      centro,
      localidad,
      unidadMovil,
      rutaId,
      rutaVersion,
      origenRuta
    );
  }
}
