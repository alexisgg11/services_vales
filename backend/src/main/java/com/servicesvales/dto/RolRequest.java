package com.servicesvales.dto;

import com.servicesvales.model.AsignacionRol;

public record RolRequest(String codigo, String zonal, String grifo, Boolean otorgar) {
    public AsignacionRol aModelo() {
        return new AsignacionRol(codigo, zonal, grifo, otorgar);
    }
}
