# Flujos de Vales

El estado del vale sigue la secuencia **Emitido → Autorizado → Usado**. El emisor puede anularlo antes del despacho. Vincular una factura conserva el estado **Usado**.

## 1. Registrar vale

```mermaid
flowchart TD
    start(["Operativo inicia la emisión"]) --> supply["Elige fecha, grifo y combustible"]
    supply --> mode{"Modalidad"}
    mode -->|"Con contrato"| contract["Contrato vigente, combustible pactado y saldo"]
    mode -->|"S/C para tercero"| third["Tarifa vigente, tercero y motivo"]
    mode -->|"S/C por vencimiento"| expired["Contrato vencido, sin vigente y con tarifa"]
    contract --> check{"¿Cumple la modalidad?"}
    third --> check
    expired --> check
    check -->|"No"| correct["Corregir datos o configuración"]
    check -->|"Sí"| assignment["Revisa trabajador, unidad móvil y centro de costo"]
    assignment --> confirm["Confirma cantidad y datos"]
    confirm --> issue(["Emitido con código y QR"])
```

El centro de costo se propone desde la ficha del trabajador. El operativo puede elegir otro de su misma unidad organizativa. La emisión con contrato reserva el importe estimado.

## 2. Autorizar vales

```mermaid
flowchart LR
    chief(["Jefatura abre los emitidos de su zonal"]) --> select["Revisa uno o varios vales"]
    select --> allowed{"¿Siguen emitidos y pertenecen a otro emisor?"}
    allowed -->|"Sí"| confirm["Confirma la autorización"]
    confirm --> authorized(["Autorizado"])
    allowed -->|"No"| denied["Se bloquea la autorización"]
```

Cada vale registra una sola autorización, incluso si hay varios jefes de la zonal.

## 3. Registrar atención

```mermaid
flowchart TD
    start(["Grifo busca por código, lista o QR"]) --> allowed{"¿Autorizado y del grifo y zonal asignados?"}
    allowed -->|"No"| notice["Se muestra el motivo y se bloquea el despacho"]
    allowed -->|"Sí"| identity["Verifica el DNI del conductor o tercero"]
    identity --> consumption["Registra fecha, galones y precio real"]
    consumption --> valid{"¿Identidad, cantidad y precio válidos?"}
    valid -->|"No"| correct["Corrige los datos"]
    valid -->|"Sí"| confirm["Confirma el despacho y revisa el aviso de cambio de precio si aplica"]
    confirm --> ticket["Genera ticket por grifo y guarda el importe real"]
    ticket --> used(["Usado con resumen de atención"])
```

La tarifa de la fecha sugiere el precio real. Si falta tarifa, un vale con contrato puede usar el precio pactado como respaldo. El consumo no puede superar lo autorizado. Un despacho parcial también cierra el vale y libera la diferencia de la reserva cuando corresponde.

## 4. Asociar factura

```mermaid
flowchart TD
    start(["Contabilidad revisa las facturas del grifo"]) --> documents{"¿Cómo facturó el grifo?"}
    documents -->|"Un solo documento"| combined["Selecciona los vales cubiertos, con contrato y S/C si aplica"]
    documents -->|"Documentos separados"| separate["Selecciona solo el grupo de la factura actual"]
    combined --> choose["Elige la factura ya cargada"]
    separate --> choose
    choose --> match{"¿Vales usados, sin factura, del mismo grifo y con el mismo total?"}
    match -->|"No"| correct["Revisa la selección o el documento"]
    match -->|"Sí"| confirm["Confirma y cierra la asociación"]
    confirm --> expense(["Consumos disponibles en Consultar gastos"])
```

Por ejemplo, S/ 300 con contrato y S/ 80 S/C se pueden asociar a una factura de **S/ 380** que cubra ambos consumos. Si hay facturas de **S/ 300** y **S/ 80**, cada una se asocia a su grupo. Incluir el vale S/C en la de S/ 300 daría S/ 380 y bloquearía la asociación. Se compara el total final a dos decimales, sin desglose de IGV. La asociación cerrada no admite agregar ni quitar vales.

## 5. Anular vale

```mermaid
flowchart LR
    start(["Operativo elige un vale propio"]) --> check{"¿Emitido o autorizado sin uso?"}
    check -->|"No"| stop["Se bloquea la anulación"]
    check -->|"Sí"| reason["Indica motivo y confirma"]
    reason --> cancel["Registra la anulación y libera la reserva si corresponde"]
    cancel --> done(["Anulado"])
```

## 6. PDF del vale y QR

```mermaid
flowchart TD
    qr(["Se abre el QR en la red local"]) --> publicCard["Consulta básica de código, grifo, fecha y estado"]
    publicCard --> request["Solicita ver el PDF"]
    list(["Cuenta abre PDF del vale"]) --> scope
    request --> login["Inicia sesión si hace falta"]
    login --> scope{"¿Tiene acceso al vale?"}
    scope -->|"No"| deny["Se conserva el acceso a la ficha básica por QR"]
    scope -->|"Sí"| pdf["Vista previa del PDF comparativo"]
    pdf --> actions(["Imprimir o descargar"])
    pdf --> service["Si hay una acción habilitada, se abre el servicio correspondiente"]
```

La ficha pública no entrega DNI. En el PDF, el grifo verifica el documento presentado y los perfiles habilitados pueden ver el DNI del trabajador.

## 7. Consultar gastos

```mermaid
flowchart LR
    start(["Contabilidad elige año y mes"]) --> used["Busca vales usados con factura por fecha de consumo"]
    used --> supply["Agrupa por combustible"]
    supply --> totals["Muestra subtotales con contrato y S/C y el total facturado"]
    totals --> details(["Abre el detalle de los vales por combustible"])
```

El consumo se incorpora al mes del despacho cuando queda asociado a una factura.
