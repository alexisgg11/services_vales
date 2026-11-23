package com.servicesvales.modulos.atencion.infraestructura;

import com.servicesvales.modulos.atencion.dominio.AtencionVale;
import com.servicesvales.modulos.atencion.dominio.IdentidadAtencion;
import com.servicesvales.modulos.atencion.dominio.PrecioAtencion;
import java.time.LocalDate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AtencionRepository {

  private final JdbcClient jdbc;

  public AtencionRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public PrecioAtencion sugerirPrecio(int actor, long vale, LocalDate fecha) {
    return jdbc
      .sql(
        "SELECT precio, fuente FROM vales.sugerir_precio_atencion(:actor, :vale, :fecha)"
      )
      .param("actor", actor)
      .param("vale", vale)
      .param("fecha", fecha)
      .query((rs, fila) ->
        new PrecioAtencion(rs.getBigDecimal("precio"), rs.getString("fuente"))
      )
      .single();
  }

  public IdentidadAtencion validarDni(int actor, long vale, String dni) {
    return jdbc
      .sql(
        "SELECT nombre, tipo FROM vales.validar_dni_atencion(:actor, :vale, :dni)"
      )
      .param("actor", actor)
      .param("vale", vale)
      .param("dni", dni)
      .query((rs, fila) ->
        new IdentidadAtencion(rs.getString("nombre"), rs.getString("tipo"))
      )
      .single();
  }

  public void registrar(int actor, long vale, AtencionVale datos) {
    jdbc
      .sql(
        """
        SELECT (vales.registrar_atencion(:actor, :vale, :fecha, :cantidad, :precio,
            :confirmado, :dni, :identidad)).ticket
        """
      )
      .param("actor", actor)
      .param("vale", vale)
      .param("fecha", datos.fecha())
      .param("cantidad", datos.cantidad())
      .param("precio", datos.precio())
      .param("confirmado", datos.precioConfirmado())
      .param("dni", datos.dniPresentado())
      .param("identidad", datos.identidadVerificada())
      .query(String.class)
      .single();
  }
}
