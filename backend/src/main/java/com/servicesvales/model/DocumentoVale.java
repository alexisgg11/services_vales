package com.servicesvales.model;

import tools.jackson.databind.node.ObjectNode;

public record DocumentoVale(long id, ObjectNode datos) {
    public ObjectNode datosParaConsulta() {
        ObjectNode copia = datos.deepCopy();
        // Las bases externas pueden seguir usando la función QR anterior.
        if (!copia.path("dni_filtrado_por_rol").asBoolean()) copia.remove("dni_trabajador");
        copia.remove("dni_filtrado_por_rol");
        return copia;
    }
}
