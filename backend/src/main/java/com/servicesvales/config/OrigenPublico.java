package com.servicesvales.config;

import java.net.URI;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OrigenPublico {
    private final URI origen;

    public OrigenPublico(@Value("${vales.public-base-url}") URI origen) {
        if (!("https".equals(origen.getScheme()) || "http".equals(origen.getScheme()))
                || origen.getHost() == null || origen.getUserInfo() != null
                || origen.getQuery() != null || origen.getFragment() != null
                || !("".equals(origen.getPath()) || "/".equals(origen.getPath()))) {
            throw new IllegalArgumentException("VALES_PUBLIC_BASE_URL debe ser un origen HTTP o HTTPS.");
        }
        this.origen = origen;
    }

    public String url() {
        return origen.toString().replaceFirst("/$", "");
    }

    public String enlaceVale(UUID idQr) {
        return origen.resolve("/vales/q/" + idQr).toString();
    }
}
