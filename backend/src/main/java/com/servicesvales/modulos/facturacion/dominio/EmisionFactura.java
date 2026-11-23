package com.servicesvales.modulos.facturacion.dominio;

import com.servicesvales.compartido.dominio.LoteVales;
import java.time.LocalDate;
import java.util.UUID;

public record EmisionFactura(LoteVales lote, UUID solicitud, LocalDate fecha) {}
