package com.servicesvales.dto;

import com.servicesvales.model.LoteVales;
import java.util.List;

public record LoteValesRequest(List<Long> vales) {
    public LoteVales aModelo() {
        return new LoteVales(vales);
    }
}
