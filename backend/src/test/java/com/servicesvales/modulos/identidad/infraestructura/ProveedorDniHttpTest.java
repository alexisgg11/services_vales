package com.servicesvales.modulos.identidad.infraestructura;

import static org.junit.jupiter.api.Assertions.*;

import com.servicesvales.compartido.dominio.OperacionException;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ProveedorDniHttpTest {

  private static final String DNI = "09900001";
  private static final String TOKEN_DE_PRUEBA = "prueba+&";
  private HttpServer servidor;
  private final AtomicReference<Solicitud> recibida = new AtomicReference<>();

  private record Solicitud(String metodo, String ruta, String autorizacion) {}

  @AfterEach
  void detenerServidor() {
    if (servidor != null) servidor.stop(0);
  }

  @Test
  void consultaApisPeruYComponeElNombreCompleto() throws IOException {
    var proveedor = proveedor(
      """
      {
        "dni": "09900001",
        "nombres": " Ana Lucía ",
        "apellidoPaterno": "Ruiz",
        "apellidoMaterno": "Perea"
      }
      """
    );

    var resultado = proveedor.consultar("apisperu", DNI);

    assertEquals("Ana Lucía Ruiz Perea", resultado.nombre());
    assertEquals("Proveedor externo APIs Perú", resultado.origen());
    assertEquals(
      new Solicitud("GET", "/api/v1/dni/09900001?token=prueba%2B%26", null),
      recibida.get()
    );
  }

  @Test
  void rechazaUnDniDistintoAunqueElProveedorRespondaConUnNombre() throws IOException {
    var proveedor = proveedor(
      """
      {"dni":"09900002","nombres":"Ana","apellidoPaterno":"Ruiz"}
      """
    );

    assertThrows(OperacionException.class, () ->
      proveedor.consultar("apisperu", DNI)
    );
  }

  @Test
  void rechazaElErrorDeApisPeruDentroDeUnaRespuestaHttpExitosa() throws IOException {
    var proveedor = proveedor(
      """
      {"success":false,"message":"Mensaje interno sobre prueba+&"}
      """
    );

    var error = assertThrows(OperacionException.class, () ->
      proveedor.consultar("apisperu", DNI)
    );
    assertFalse(error.getMessage().contains(TOKEN_DE_PRUEBA));
  }

  @Test
  void usaElFormatoDeDecolectaCuandoSeConfiguraEseProveedor() throws IOException {
    var proveedor = proveedor(
      """
      {"document_number":"09900001","full_name":"Ana Ruiz"}
      """
    );

    assertEquals("Ana Ruiz", proveedor.consultar("decolecta", DNI).nombre());
    assertEquals(
      new Solicitud(
        "GET",
        "/api/v1/dni?numero=09900001",
        "Bearer " + TOKEN_DE_PRUEBA
      ),
      recibida.get()
    );
  }

  private ProveedorDniHttp proveedor(String cuerpo) throws IOException {
    byte[] respuesta = cuerpo.getBytes(StandardCharsets.UTF_8);
    servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    servidor.createContext("/", intercambio -> {
      recibida.set(
        new Solicitud(
          intercambio.getRequestMethod(),
          intercambio.getRequestURI().toString(),
          intercambio.getRequestHeaders().getFirst("Authorization")
        )
      );
      try {
        intercambio
          .getResponseHeaders()
          .set("Content-Type", "application/json; charset=UTF-8");
        intercambio.sendResponseHeaders(200, respuesta.length);
        intercambio.getResponseBody().write(respuesta);
      } finally {
        intercambio.close();
      }
    });
    servidor.start();
    return new ProveedorDniHttp(
      new ObjectMapper(),
      "http://127.0.0.1:" + servidor.getAddress().getPort() + "/api/v1/",
      TOKEN_DE_PRUEBA
    );
  }
}
