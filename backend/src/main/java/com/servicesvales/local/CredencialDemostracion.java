package com.servicesvales.local;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;

final class CredencialDemostracion {

  private CredencialDemostracion() {}

  static String hash(Path directorio, String configurada) throws IOException {
    String clave =
      configurada == null || configurada.isBlank()
        ? claveLocal(directorio)
        : configurada;
    if (
      clave.length() < 8 || clave.getBytes(StandardCharsets.UTF_8).length > 72
    ) {
      throw new IOException(
        "VALES_DEMO_PASSWORD debe tener al menos 8 caracteres y como máximo 72 bytes."
      );
    }
    return PasswordEncoderFactories.createDelegatingPasswordEncoder().encode(
      clave
    );
  }

  private static String claveLocal(Path directorio) throws IOException {
    Path archivo = directorio.resolve("demo.clave");
    if (Files.isRegularFile(archivo)) return Files.readString(archivo).strip();
    byte[] aleatorios = new byte[24];
    new SecureRandom().nextBytes(aleatorios);
    String clave = Base64.getUrlEncoder()
      .withoutPadding()
      .encodeToString(aleatorios);
    Files.writeString(archivo, clave, StandardOpenOption.CREATE_NEW);
    return clave;
  }
}
