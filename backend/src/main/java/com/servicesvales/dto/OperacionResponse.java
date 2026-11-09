package com.servicesvales.dto;

public record OperacionResponse(boolean ok) {
    public static OperacionResponse completada() {
        return new OperacionResponse(true);
    }
}
