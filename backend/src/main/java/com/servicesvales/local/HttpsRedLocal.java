package com.servicesvales.local;

import java.io.IOException;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.TimeUnit;

/** Certificado público para un nombre DuckDNS que apunta a la red privada de la PC. */
final class HttpsRedLocal {
    private HttpsRedLocal() {}

    static Map<String, Object> preparar(Path home, Properties configuracion, int puerto) throws Exception {
        if (!Boolean.parseBoolean(configuracion.getProperty("VALES_HTTPS_ENABLED", "false"))) return Map.of();
        if (!Boolean.parseBoolean(configuracion.getProperty("VALES_HTTPS_ACCEPT_TERMS", "false")))
            throw new IOException("Para activar HTTPS, confirma los términos de Let's Encrypt en .env.");
        String subdominio = configuracion.getProperty("VALES_HTTPS_DOMAIN", "").strip().toLowerCase(Locale.ROOT)
                .replaceFirst("\\.duckdns\\.org$", "");
        String token = configuracion.getProperty("VALES_DUCKDNS_TOKEN", "").strip();
        if (!subdominio.matches("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?") || !token.matches("[a-fA-F0-9-]{36}"))
            throw new IOException("Completa VALES_HTTPS_DOMAIN y VALES_DUCKDNS_TOKEN en .env.");

        String ip = direccionPrivada(configuracion.getProperty("VALES_HTTPS_IPV4", "").strip());
        String dominio = subdominio + ".duckdns.org";
        Path estado = home.resolve("https");
        Files.createDirectories(estado);
        actualizarDns(estado, subdominio, token, ip);
        Path certificado = estado.resolve("certificates").resolve(dominio + ".crt");
        Path clave = certificado.resolveSibling(dominio + ".key");
        Instant vencimiento = vencimiento(certificado, clave, dominio);
        if (vencimiento.isBefore(Instant.now().plus(Duration.ofDays(21)))) {
            try {
                emitir(estado, dominio, token, Files.isRegularFile(certificado));
            } catch (IOException error) {
                if (!vencimiento.isAfter(Instant.now())) throw error;
                System.err.println("No se pudo renovar HTTPS. Se usará el certificado aún vigente.");
            }
        }
        if (!vencimiento(certificado, clave, dominio).isAfter(Instant.now()))
            throw new IOException("Let's Encrypt no entregó un certificado vigente para " + dominio);

        String url = "https://" + dominio + ":" + puerto;
        return Map.of(
                "server.address", ip,
                "server.ssl.enabled", true,
                "server.ssl.certificate", certificado.toUri().toString(),
                "server.ssl.certificate-private-key", clave.toUri().toString(),
                "server.servlet.session.cookie.secure", true,
                "vales.public-base-url", url,
                "vales.local.start-url", url);
    }

    private static String direccionPrivada(String ip) throws IOException {
        if (ip != null && ip.matches("[0-9]+(?:\\.[0-9]+){3}")) {
            InetAddress direccion = InetAddress.getByName(ip);
            if (direccion.isSiteLocalAddress() && NetworkInterface.getByInetAddress(direccion) != null) return ip;
        }
        throw new IOException("Indica la IPv4 privada actual de la PC en VALES_HTTPS_IPV4, en .env.");
    }

    private static void actualizarDns(Path estado, String subdominio, String token, String ip)
            throws IOException, InterruptedException {
        Path registro = estado.resolve("dns-ipv4");
        String entrada = subdominio + "=" + ip;
        if (Files.isRegularFile(registro) && Files.readString(registro).equals(entrada)) return;
        URI uri = URI.create("https://www.duckdns.org/update?domains=" + subdominio
                + "&token=" + token + "&ip=" + ip + "&verbose=true");
        var solicitud = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15)).build();
        HttpResponse<String> respuesta;
        try {
            respuesta = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build()
                    .send(solicitud, HttpResponse.BodyHandlers.ofString());
        } catch (IOException error) {
            throw new IOException("No se pudo conectar con DuckDNS. Comprueba la conexión de la PC.");
        }
        List<String> lineas = respuesta.body().lines().toList();
        if (respuesta.statusCode() != 200 || lineas.size() < 4 || !lineas.get(0).equals("OK")
                || !lineas.get(1).equals(ip) || !lineas.get(2).isBlank())
            throw new IOException("DuckDNS no confirmó una dirección IPv4 privada sin IPv6. Revisa el subdominio y el token.");
        Files.writeString(registro, entrada);
    }

    private static Instant vencimiento(Path certificado, Path clave, String dominio) throws Exception {
        if (!Files.isRegularFile(certificado) || !Files.isRegularFile(clave)) return Instant.EPOCH;
        try (var input = Files.newInputStream(certificado)) {
            var cadena = List.copyOf(CertificateFactory.getInstance("X.509").generateCertificates(input));
            if (cadena.size() < 2) return Instant.EPOCH;
            var hoja = (X509Certificate) cadena.get(0);
            if (hoja.getNotBefore().toInstant().isAfter(Instant.now())) return Instant.EPOCH;
            var nombres = hoja.getSubjectAlternativeNames();
            if (nombres == null || nombres.stream().noneMatch(san -> san.get(0).equals(2) && dominio.equals(san.get(1))))
                return Instant.EPOCH;
            return hoja.getNotAfter().toInstant();
        }
    }

    private static void emitir(Path estado, String dominio, String token, boolean existente) throws Exception {
        Path lego = LegoLocal.instalar(estado);
        var comando = new ArrayList<>(List.of(lego.toString(), "run", "--accept-tos", "--path", estado.toString(),
                "--server", "letsencrypt", "--domains", dominio, "--dns", "duckdns", "--http-timeout", "15"));
        if (existente) comando.addAll(List.of("--renew-days", "21", "--no-random-sleep"));
        var ejecutor = new ProcessBuilder(comando).redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD);
        ejecutor.environment().keySet().removeIf(nombre -> nombre.toUpperCase(Locale.ROOT).startsWith("LEGO_"));
        ejecutor.environment().put("DUCKDNS_TOKEN", token);
        ejecutor.environment().put("DUCKDNS_PROPAGATION_TIMEOUT", "120");
        Process proceso = ejecutor.start();
        try {
            if (!proceso.waitFor(240, TimeUnit.SECONDS) || proceso.exitValue() != 0)
                throw new IOException("No se pudo obtener el certificado de Let's Encrypt para " + dominio
                        + ". Revisa el subdominio y la conexión DNS de la PC.");
        } finally {
            if (proceso.isAlive()) proceso.destroyForcibly();
        }
    }
}
