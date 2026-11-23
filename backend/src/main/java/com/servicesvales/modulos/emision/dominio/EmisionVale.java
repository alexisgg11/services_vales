package com.servicesvales.modulos.emision.dominio;

import com.servicesvales.compartido.dominio.MotorRutas;
import java.math.BigDecimal;
import java.time.LocalDate;

public record EmisionVale(
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
) {}
