package com.servicesvales.compartido.api;

public record OperacionResponse(boolean ok) {
  public static OperacionResponse completada() {
    return new OperacionResponse(true);
  }
}
