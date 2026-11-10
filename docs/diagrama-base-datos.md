# Diagrama de la base de datos de vales

Los tres diagramas muestran las relaciones vigentes del esquema PostgreSQL de vales. [Administración](../backend/src/main/resources/db/migraciones/04-administracion.sql) añade el historial de cuentas y roles. La [migración de unidades móviles](../backend/src/main/resources/db/migraciones/12-unidad-movil-por-vale.sql) deja la asignación del vehículo en el vale.

**PK** indica clave primaria, **FK** indica clave foránea y **UK** indica unicidad. Varias columnas marcadas PK en una tabla forman una sola clave compuesta. Un círculo indica participación opcional. La pata de gallo indica que puede haber varias filas relacionadas.

## Personas, accesos y vales

```mermaid
erDiagram
    direction LR
    persona ||..o| trabajador : "tiene ficha"
    trabajador ||..o| usuario : "tiene cuenta"
    usuario ||--o{ usuarioRol : "recibe asignación"
    rol ||--o{ usuarioRol : "se asigna"
    trabajador ||..o{ vales : "es trabajador del vale"
    usuario ||..o{ vales : "registra"
    usuario |o..o{ vales : "autoriza, atiende o anula"
    usuario ||..o{ historialVale : "ejecuta acción"
    vales ||..o{ historialVale : "registra eventos"

    persona {
        varchar dni PK "8 dígitos"
        varchar nombre
        varchar ap_paterno
        varchar ap_materno
    }
    trabajador {
        integer id_trabajador PK
        varchar dni FK, UK
        varchar cargo
        boolean activo
    }
    usuario {
        integer id_usuario PK
        integer id_trabajador FK, UK
        varchar login UK
        boolean activo
    }
    rol {
        varchar codigo PK
        varchar descripcion
    }
    usuarioRol["usuario_rol"] {
        integer id_usuario PK, FK
        varchar codigo_rol PK, FK
        varchar cod_zonal FK "Ámbito de Operativo, Jefe o Grifo"
        varchar cod_proveedor FK "Ámbito de Grifo"
    }
    vales {
        bigint id_vale PK
        uuid id_qr UK
        varchar codigo_vale
        varchar cod_zonal FK
        integer id_trabajador FK
        integer registrado_por FK "Obligatorio"
        integer autorizado_por FK "Opcional"
        integer atendido_por FK "Opcional"
        integer anulado_por FK "Opcional"
    }
    historialVale["historial_vale"] {
        bigint id_evento PK
        bigint id_vale FK
        integer id_usuario FK
        varchar accion
        timestamptz fecha
    }
```

Una persona puede tener una ficha de trabajador vinculada por DNI. Una ficha puede tener una cuenta. Toda cuenta pertenece a un trabajador y enlaza con su ficha por `id_trabajador`. La base admite como máximo una ficha por persona y una cuenta por ficha.

El trabajador emisor se identifica por `id_trabajador`. El vale exige que coincida con la ficha del usuario de `registrado_por`. Los responsables de registrar, autorizar, atender y anular se identifican por `id_usuario`. `registrado_por` siempre se guarda al emitir. Los otros responsables se completan según lo que ocurra con el vale. Cada evento de `historial_vale` conserva su vale, actor, acción y fecha.

Un usuario puede tener varios roles mediante `usuario_rol`. La clave es el par `(id_usuario, codigo_rol)`. Cada asignación de Operativo o Jefe requiere una zonal y cada asignación de Grifo requiere un proveedor y una zonal. Contabilidad y Administrador tienen asignaciones sin esos ámbitos. La columna `trabajador.cargo` describe el puesto laboral. Los permisos se determinan mediante `usuario_rol`.

## Ubicación, costo y maquinaria

```mermaid
erDiagram
    direction LR
    zonal ||..o{ localidad : "agrupa"
    zonal |o..o{ usuarioRol : "define ámbito zonal"
    unidadOrg ||--o{ asignacionCosto : "admite centros"
    centroCosto ||--o{ asignacionCosto : "se asigna"
    localidad |o..o{ trabajador : "ubica por defecto"
    localidad ||..o{ vales : "ubica al emitir"
    localidad |o..o{ centroCosto : "ubica el centro"
    unidadOrg |o..o{ trabajador : "identifica organización"
    centroCosto |o..o{ trabajador : "identifica centro"
    unidadOrg |o..o{ vales : "se conserva al emitir"
    centroCosto |o..o{ vales : "se conserva al emitir"
    asignacionCosto |o..o{ trabajador : "valida el par de costos"
    asignacionCosto |o..o{ vales : "valida el par de costos"
    zonal |o..o{ unidadMaquinaria : "es base de"
    unidadMaquinaria |o..o{ vales : "se elige al emitir"
    unidadMaquinaria ||--o{ habilitacionUnidad : "se habilita por trabajo"
    zonal ||--o{ habilitacionUnidad : "recibe la unidad"
    centroCosto ||--o{ habilitacionUnidad : "identifica el trabajo"
    zonal ||--o{ correlativoVale : "numera por año"

    zonal {
        varchar id_zona PK
        varchar nom_zona
    }
    localidad {
        varchar id_localidad PK
        varchar id_zona FK
        varchar nom_localidad
    }
    unidadOrg["unidad_organizativa"] {
        varchar cod_uni_organizativa PK
        varchar descripcion
    }
    centroCosto["centro_costo"] {
        varchar cod_centro_costo PK
        varchar descripcion
        varchar cod_localidad FK
        text ubicacion_referencia
    }
    asignacionCosto["asignacion_costo"] {
        varchar cod_uni_organizativa PK, FK
        varchar cod_centro_costo PK, FK
    }
    unidadMaquinaria["unidad_maquinaria"] {
        integer codigo PK
        varchar placa UK
        varchar cod_zonal FK
    }
    habilitacionUnidad["habilitacion_unidad"] {
        integer codigo_unidad PK, FK
        varchar cod_zonal PK, FK
        varchar cod_centro_costo PK, FK
        date desde PK
        date hasta
    }
    trabajador {
        integer id_trabajador PK
        varchar cod_zonal FK
        varchar cod_localidad FK
        varchar cod_uni_organizativa FK
        varchar cod_centro_costo FK
    }
    vales {
        bigint id_vale PK
        varchar cod_zonal FK
        varchar cod_localidad FK
        varchar cod_uni_organizativa FK
        varchar cod_centrocosto FK
        integer codigo_unidad_movil FK
    }
    usuarioRol["usuario_rol"] {
        integer id_usuario PK, FK
        varchar codigo_rol PK, FK
        varchar cod_zonal FK
    }
    correlativoVale["correlativo_vale"] {
        varchar cod_zonal PK, FK
        integer anio PK
        integer ultimo
    }
```

Zonal y localidad son obligatorias en el vale y deben coincidir con el catálogo. Si la ficha del trabajador carece de localidad, se indica al emitir. Unidad organizativa y centro de costo son opcionales y, cuando ambos existen, su pareja se valida en `asignacion_costo`. Al emitir se propone el centro de la ficha y se puede elegir otro habilitado para la misma unidad organizativa. El vale conserva el centro y, si corresponde, la unidad móvil seleccionada. Una misma unidad puede aparecer en vales de diferentes trabajadores.

La unidad de otra zonal se acepta cuando una habilitación coincide con la zonal y el centro de costo del vale y está vigente en su fecha de emisión.

El centro de costo puede referenciar su localidad. La zonal de esa localidad se obtiene del catálogo. Cuando un dato heredado no identifica una localidad de forma inequívoca, se conserva como referencia de ubicación.

El correlativo de vale se guarda por `(cod_zonal, anio)`. La identidad interna es `id_vale` y la búsqueda por código de negocio se distingue mediante el par único `(cod_zonal, codigo_vale)`.

## Grifos, precios, tickets y facturas

```mermaid
erDiagram
    direction LR
    proveedor ||..o{ vales : "atiende"
    proveedor ||..o{ contratoVale : "tiene contratos"
    proveedor ||..o{ factura : "emite factura"
    proveedor ||--o{ tarifa : "publica tarifa"
    proveedor |o..o{ usuarioRol : "define ámbito de grifo"
    proveedor ||--o| correlativoTicket : "numera tickets"
    suministro ||..o{ vales : "se emite"
    suministro ||--o{ tarifa : "tiene tarifa"
    contratoVale ||--o{ contratoSuministro : "pacta precios"
    suministro ||--o{ contratoSuministro : "se pacta"
    contratoVale |o..o{ vales : "financia"
    contratoSuministro |o..o{ vales : "respalda precio"
    factura |o..o{ vales : "agrupa consumos"
    factura ||--o{ facturaTicket : "documenta tickets"
    vales ||..o| facturaTicket : "respalda el despacho"
    estadoVale ||..o{ vales : "clasifica"
    tercero |o..o{ vales : "recibe vale S/C"
    usuario ||..o{ tarifa : "registra tarifa"
    usuario |o..o{ factura : "asocia factura"

    proveedor {
        varchar cod_proveedor PK "RUC"
        varchar razon_social
    }
    suministro {
        varchar id_suministro PK
        varchar descripcion UK
    }
    contratoVale["contrato_vale"] {
        varchar cod_contrato PK
        varchar ruc FK
        numeric monto_total
        numeric monto_disponible
    }
    contratoSuministro["contrato_suministro"] {
        varchar cod_contrato PK, FK
        varchar id_suministro PK, FK
        numeric precio_pactado
    }
    tarifa {
        varchar cod_proveedor PK, FK
        varchar id_suministro PK, FK
        date vigente_desde PK
        numeric precio
        integer registrado_por FK
    }
    factura {
        bigint codigo_factura PK
        varchar cod_proveedor FK
        varchar serie
        varchar numero
        numeric total
        integer asociado_por FK
        varchar origen_tickets
        varchar referencia_anexo
    }
    facturaTicket["factura_ticket"] {
        bigint codigo_factura PK, FK
        varchar cod_proveedor FK
        varchar ticket PK, FK
    }
    estadoVale["estado_vale"] {
        smallint codigo PK
        varchar descripcion UK
    }
    tercero {
        integer codigo_tercero PK
        varchar documento UK
    }
    vales {
        bigint id_vale PK
        varchar cod_proveedor FK
        varchar id_suministro FK
        varchar nrocontrato FK
        bigint codigo_factura FK
        smallint estado_vale FK
        integer codigo_tercero FK
        varchar ticket
    }
    correlativoTicket["correlativo_ticket"] {
        varchar cod_proveedor PK, FK
        bigint ultimo
    }
    usuario {
        integer id_usuario PK
    }
    usuarioRol["usuario_rol"] {
        integer id_usuario PK, FK
        varchar codigo_rol PK, FK
        varchar cod_proveedor FK
    }
```

Un vale corresponde a un grifo y a un combustible. Si tiene contrato, sus referencias validan tanto el grifo del contrato como el combustible pactado. S/C admite un tercero registrado o un trabajador cuando el grifo tiene un contrato vencido y ninguno vigente. La factura se asocia por `(codigo_factura, cod_proveedor)` y puede reunir varios vales usados del mismo grifo.

En las nuevas conciliaciones, `factura_ticket` identifica los despachos del respaldo del grifo. Se guarda su origen en la factura y la referencia cuando procede de un anexo. Los vínculos históricos se conservan.

El correlativo del ticket es por grifo. La unicidad corresponde al par `(cod_proveedor, ticket)`. Los estados vigentes son EMITIDO (0), AUTORIZADO (1), USADO (3) y ANULADO (4).
