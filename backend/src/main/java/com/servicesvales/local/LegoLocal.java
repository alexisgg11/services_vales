package com.servicesvales.local;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.zip.ZipInputStream;

final class LegoLocal {
    private static final String URL = "https://github.com/go-acme/lego/releases/download/v5.6.0/lego_v5.6.0_windows_amd64.zip";
    private static final String SHA256 = "9c4e5f77996ef2ebbcb1ea270fa7e94190b531057e02a645b124b38f66c12755";

    private LegoLocal() {}

    static Path instalar(Path estado) throws Exception {
        Path destino = estado.resolve("lego.exe");
        if (Files.isRegularFile(destino)) return destino;
        if (!System.getProperty("os.name").startsWith("Windows") || !System.getProperty("os.arch").equals("amd64"))
            throw new IOException("La preparación HTTPS automática requiere Windows x64.");
        Path zip = Files.createTempFile(estado, "lego-", ".zip");
        Path temporal = Files.createTempFile(estado, "lego-", ".tmp");
        try {
            var request = HttpRequest.newBuilder(URI.create(URL)).timeout(Duration.ofSeconds(90)).build();
            var respuesta = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL)
                    .connectTimeout(Duration.ofSeconds(10)).build().send(request, HttpResponse.BodyHandlers.ofFile(zip));
            if (respuesta.statusCode() != 200) throw new IOException("No se pudo descargar lego desde su publicación oficial.");
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(zip));
            if (!HexFormat.of().formatHex(digest).equals(SHA256))
                throw new IOException("La descarga de lego no coincide con la suma de verificación oficial.");
            try (var archivo = new ZipInputStream(Files.newInputStream(zip))) {
                for (var entrada = archivo.getNextEntry(); entrada != null; entrada = archivo.getNextEntry()) {
                    if (entrada.getName().equals("lego.exe")) {
                        Files.copy(archivo, temporal, StandardCopyOption.REPLACE_EXISTING);
                        Files.move(temporal, destino, StandardCopyOption.ATOMIC_MOVE);
                        return destino;
                    }
                }
            }
            throw new IOException("La publicación de lego no contiene el ejecutable esperado.");
        } finally {
            Files.deleteIfExists(zip);
            Files.deleteIfExists(temporal);
        }
    }
}
