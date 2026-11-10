# Flujos de Vales

El estado del vale sigue la secuencia **Emitido → Autorizado → Usado**. El emisor puede anularlo antes del despacho. Vincular una factura conserva el estado **Usado**.

Los diagramas describen el comportamiento de la aplicación tras las migraciones 12 a 14.

## 1. Registrar vale

```mermaid
flowchart TD
    start(["Operativo inicia la emisión"]) --> mode{"Elige modalidad y fecha"}
    mode -->|"Con contrato"| contract["Contrato vigente, combustible pactado y saldo"]
    mode -->|"S/C para tercero"| third["Tarifa vigente, tercero y motivo"]
    mode -->|"S/C por vencimiento"| expired["Contrato vencido, sin vigente y con tarifa"]
    contract --> check{"¿Cumple la modalidad?"}
    third --> check
    expired --> check
    check -->|"No"| correct["Corregir datos o configuración"]
    check -->|"Sí"| supply["Elige un proveedor y un combustible disponibles"]
    supply --> assignment["Revisa la ubicación del vale y elige un centro de costo de su unidad"]
    assignment --> vehicle{"¿Elige una unidad móvil?"}
    vehicle -->|"No"| confirm["Revisa cantidad e importe estimado"]
    vehicle -->|"Sí"| allowed{"¿Es de la zonal del vale o tiene habilitación para el trabajo?"}
    allowed -->|"No"| assignment
    allowed -->|"Sí"| confirm
    confirm --> issue(["Emitido con código y QR"])
```

Un operativo puede tener varios vales emitidos o autorizados a la vez. La emisión con contrato reserva el importe estimado de cada vale y comprueba que haya saldo.

La localidad de la ficha se usa en la emisión cuando está registrada. Si falta, el operativo elige una localidad de su zonal. El centro habitual se propone desde la ficha y puede sustituirse por otro habilitado para la misma unidad organizativa. Cuando el centro tiene una localidad propia, se muestra por separado.

La unidad móvil es opcional y queda guardada en cada vale. Se muestran primero las unidades de la zonal del vale. Para elegir una de otra zonal, Administración debe haberla habilitado para esa zonal, el centro de costo elegido y la fecha de emisión. La zonal base de la unidad se muestra como un dato del catálogo.

## 2. Autorizar vales

```mermaid
flowchart LR
    chief(["Jefatura abre los emitidos de su zonal"]) --> select["Revisa uno o varios vales"]
    select --> allowed{"¿Siguen emitidos y pertenecen a otro emisor?"}
    allowed -->|"Sí"| confirm["Confirma la autorización"]
    confirm --> authorized(["Autorizado"])
    allowed -->|"No"| denied["Se bloquea la autorización"]
```

Cada vale registra una sola autorización, incluso si hay varios jefes de la zonal. Si un vale del lote deja de ser elegible, se rechaza el lote.

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

La tarifa de la fecha de consumo sugiere el precio real. Si falta tarifa, un vale con contrato puede usar el precio pactado como respaldo. El consumo no puede superar lo autorizado. Un despacho parcial también cierra el vale y libera la diferencia de la reserva cuando corresponde. El ticket identifica el despacho dentro de ese grifo.

## 4. Asociar factura

```mermaid
flowchart TD
    start(["Contabilidad elige una factura ya cargada"]) --> evidence["Copia los tickets de la factura o del anexo"]
    evidence --> validate["Valida cada ticket contra los despachos del grifo"]
    validate --> tickets{"¿Todos son únicos, atendidos y sin factura?"}
    tickets -->|"No"| correct["Revisa el respaldo del grifo"]
    tickets -->|"Sí"| match{"¿La suma coincide con el total de la factura?"}
    match -->|"No"| correct
    match -->|"Sí"| confirm["Confirma y guarda los tickets y su origen"]
    confirm --> expense(["Consumos disponibles en Consultar gastos"])
```

Los tickets se ingresan uno por línea. Si el origen es un anexo, también se registra su referencia. Una factura puede incluir consumos con contrato y S/C cuando su respaldo incluye ambos. Para facturas separadas se carga la lista correspondiente a cada una. Se compara el total final a dos decimales, sin desglose de IGV. Una diferencia o un ticket inválido bloquea la asociación. La asociación cerrada no admite agregar ni quitar vales.

## 5. Anular vale

```mermaid
flowchart LR
    start(["Operativo elige un vale propio"]) --> check{"¿Emitido o autorizado sin uso?"}
    check -->|"No"| stop["Se bloquea la anulación"]
    check -->|"Sí"| reason["Indica motivo y confirma"]
    reason --> cancel["Registra la anulación y libera la reserva si corresponde"]
    cancel --> done(["Anulado"])
```

La anulación guarda el motivo, el responsable y la fecha. Un vale usado permanece en el historial de atención.

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

La ficha pública muestra los cuatro datos del diagrama. El PDF completo requiere una cuenta con acceso al vale. El detalle y el PDF muestran por separado la localidad del centro de costo y la zonal base de la unidad cuando están registradas.

## 7. Consultar gastos

```mermaid
flowchart LR
    start(["Contabilidad elige año y mes"]) --> used["Busca vales usados con factura por fecha de consumo"]
    used --> supply["Agrupa por combustible"]
    supply --> totals["Muestra subtotales con contrato y S/C y el total facturado"]
    totals --> details(["Abre el detalle de los vales por combustible"])
```

El consumo se incorpora al mes del despacho cuando queda asociado a una factura. Por ejemplo, un despacho de noviembre facturado en diciembre se consulta en noviembre.
