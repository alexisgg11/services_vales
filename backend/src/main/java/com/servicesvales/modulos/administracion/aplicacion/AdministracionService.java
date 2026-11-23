package com.servicesvales.modulos.administracion.aplicacion;

import com.servicesvales.compartido.dominio.OperacionException;
import com.servicesvales.modulos.administracion.dominio.AsignacionRol;
import com.servicesvales.modulos.administracion.dominio.CambioCuenta;
import com.servicesvales.modulos.administracion.dominio.HabilitacionUnidad;
import com.servicesvales.modulos.administracion.dominio.PrecioContrato;
import com.servicesvales.modulos.administracion.dominio.TarifaCombustible;
import com.servicesvales.modulos.administracion.infraestructura.AdministracionRepository;
import com.servicesvales.modulos.identidad.aplicacion.UsuarioService;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class AdministracionService {

  private final UsuarioService usuarios;
  private final AdministracionRepository administracion;
  private final PasswordEncoder claves;

  public AdministracionService(
    UsuarioService usuarios,
    AdministracionRepository administracion,
    PasswordEncoder claves
  ) {
    this.usuarios = usuarios;
    this.administracion = administracion;
    this.claves = claves;
  }

  @Transactional(readOnly = true)
  public JsonNode consultar(String login) {
    return administracion.consultar(usuarios.identificarActor(login));
  }

  @Transactional
  public void guardarCuenta(String login, Integer id, CambioCuenta datos) {
    int actor = usuarios.identificarActor(login);
    administracion.consultar(actor);
    if (
      id == null &&
      (datos.rol() == null || !Boolean.TRUE.equals(datos.rol().otorgar()))
    ) throw OperacionException.invalida("Asigna el rol inicial de la cuenta.");
    String hash = codificarClave(datos.clave(), id == null);
    int cuenta = administracion.guardarCuenta(actor, id, datos, hash);
    if (id == null) administracion.guardarRol(actor, cuenta, datos.rol());
  }

  private String codificarClave(String clave, boolean obligatoria) {
    if (!obligatoria && (clave == null || clave.isEmpty())) return null;
    if (
      clave == null ||
      clave.length() < 8 ||
      clave.getBytes(StandardCharsets.UTF_8).length > 72
    ) throw OperacionException.invalida(
      "La contraseña debe tener al menos 8 caracteres y un máximo de 72 bytes."
    );
    return claves.encode(clave);
  }

  @Transactional
  public void guardarRol(String login, int cuenta, AsignacionRol datos) {
    administracion.guardarRol(usuarios.identificarActor(login), cuenta, datos);
  }

  @Transactional
  public void registrarTarifa(String login, TarifaCombustible datos) {
    administracion.registrarTarifa(usuarios.identificarActor(login), datos);
  }

  @Transactional(readOnly = true)
  public JsonNode contratosVigentes(String login) {
    return administracion.contratosVigentes(usuarios.identificarActor(login));
  }

  @Transactional
  public void registrarPrecioContrato(String login, PrecioContrato datos) {
    administracion.registrarPrecioContrato(
      usuarios.identificarActor(login),
      datos
    );
  }

  @Transactional(readOnly = true)
  public JsonNode unidades(String login) {
    return administracion.unidades(usuarios.identificarActor(login));
  }

  @Transactional
  public void asignarZonalUnidad(String login, int unidad, String zonal) {
    administracion.asignarZonalUnidad(
      usuarios.identificarActor(login),
      unidad,
      zonal
    );
  }

  @Transactional(readOnly = true)
  public JsonNode unidadesJefatura(String login) {
    return administracion.unidadesJefatura(usuarios.identificarActor(login));
  }

  @Transactional
  public void habilitarUnidad(String login, HabilitacionUnidad datos) {
    administracion.habilitarUnidad(usuarios.identificarActor(login), datos);
  }
}
