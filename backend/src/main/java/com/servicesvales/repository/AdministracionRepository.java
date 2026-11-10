package com.servicesvales.repository;

import com.servicesvales.model.AsignacionRol;
import com.servicesvales.model.CambioCuenta;
import com.servicesvales.model.HabilitacionUnidad;
import com.servicesvales.model.PrecioContrato;
import com.servicesvales.model.TarifaCombustible;
import java.math.BigDecimal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Repository
public class AdministracionRepository {
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public AdministracionRepository(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public JsonNode consultar(int actor) {
        String datos = jdbc.sql("SELECT vales.contexto_administracion(:actor)::text")
                .param("actor", actor).query(String.class).single();
        return json.readTree(datos);
    }

    public int guardarCuenta(int actor, Integer id, CambioCuenta datos, String hash) {
        return jdbc.sql("SELECT vales.administrar_cuenta(:actor, :id, :login, :trabajador, :hash, :activo)")
                .param("actor", actor).param("id", id).param("login", datos.login())
                .param("trabajador", datos.trabajador()).param("hash", hash).param("activo", datos.activo())
                .query(Integer.class).single();
    }

    public void guardarRol(int actor, int cuenta, AsignacionRol datos) {
        jdbc.sql("SELECT vales.administrar_rol(:actor, :cuenta, :rol, :zonal, :grifo, :otorgar)")
                .param("actor", actor).param("cuenta", cuenta).param("rol", datos.codigo())
                .param("zonal", datos.zonal()).param("grifo", datos.grifo()).param("otorgar", datos.otorgar())
                .query((rs, fila) -> Boolean.TRUE).single();
    }

    public void registrarTarifa(int actor, TarifaCombustible datos) {
        jdbc.sql("SELECT (vales.registrar_tarifa(:actor, :grifo, :suministro, :fecha, :precio)).precio")
                .param("actor", actor).param("grifo", datos.grifo()).param("suministro", datos.suministro())
                .param("fecha", datos.desde()).param("precio", datos.precio()).query(BigDecimal.class).single();
    }

    public JsonNode contratosVigentes(int actor) {
        String datos = jdbc.sql("SELECT vales.contratos_vigentes_administracion(:actor)::text")
                .param("actor", actor).query(String.class).single();
        return json.readTree(datos);
    }

    public void registrarPrecioContrato(int actor, PrecioContrato datos) {
        jdbc.sql("SELECT vales.registrar_precio_contrato(:actor, :proveedor, :contrato, :suministro, :precio)")
                .param("actor", actor).param("proveedor", datos.proveedor()).param("contrato", datos.contrato())
                .param("suministro", datos.suministro()).param("precio", datos.precio())
                .query((rs, fila) -> Boolean.TRUE).single();
    }

    public JsonNode unidades(int actor) {
        String datos = jdbc.sql("SELECT vales.unidades_administracion(:actor)::text")
                .param("actor", actor).query(String.class).single();
        return json.readTree(datos);
    }

    public void asignarZonalUnidad(int actor, int unidad, String zonal) {
        jdbc.sql("SELECT vales.asignar_zonal_unidad(:actor, :unidad, :zonal)")
                .param("actor", actor).param("unidad", unidad).param("zonal", zonal)
                .query((rs, fila) -> Boolean.TRUE).single();
    }

    public void habilitarUnidad(int actor, HabilitacionUnidad datos) {
        jdbc.sql("SELECT vales.habilitar_unidad(:actor, :unidad, :zonal, :centro, :desde, :hasta)")
                .param("actor", actor).param("unidad", datos.unidad()).param("zonal", datos.zonal())
                .param("centro", datos.centro()).param("desde", datos.desde()).param("hasta", datos.hasta())
                .query((rs, fila) -> Boolean.TRUE).single();
    }
}
