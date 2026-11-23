package com.servicesvales.compartido.api;

import com.servicesvales.compartido.dominio.LoteVales;
import java.util.List;

public record LoteValesRequest(List<Long> vales) {
  public LoteVales aModelo() {
    return new LoteVales(vales);
  }
}
