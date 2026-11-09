package com.servicesvales.model;

public class OperacionException extends RuntimeException {
    public enum Tipo { SIN_PERMISO, NO_ENCONTRADO, INVALIDA }

    private final Tipo tipo;

    public OperacionException(Tipo tipo, String mensaje) {
        super(mensaje);
        this.tipo = tipo;
    }

    public Tipo tipo() {
        return tipo;
    }

    public static OperacionException invalida(String mensaje) {
        return new OperacionException(Tipo.INVALIDA, mensaje);
    }
}
