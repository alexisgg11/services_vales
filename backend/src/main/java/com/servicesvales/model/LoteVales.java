package com.servicesvales.model;

import java.util.List;

public record LoteVales(List<Long> ids) {
    public LoteVales {
        if (ids == null || ids.isEmpty() || ids.stream().anyMatch(id -> id == null || id <= 0))
            throw OperacionException.invalida("Selecciona uno o más vales válidos.");
        ids = List.copyOf(ids);
    }
}
