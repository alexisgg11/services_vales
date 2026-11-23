# Flujos de Vales

El estado del vale sigue la secuencia **Emitido → Autorizado → Usado**. El emisor puede anularlo antes del despacho. Vincular una factura conserva el estado **Usado**.

Los diagramas describen el comportamiento de la aplicación tras las migraciones 12 a 20.

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

Antes de elegir el grifo, el operativo puede seleccionar una **ruta de trabajo asignada por Jefatura** y pulsar **Generar mejor opción**. El servidor compara el combustible solicitado y el desvío vial necesario para abastecerse entre los lugares de trabajo, respetando su orden. Se pueden tener varias rutas vigentes y cada ruta puede incluir varias paradas. La selección se aplica únicamente al pulsar Elegir grifo. Si se registra una ruta, el vale conserva su versión y el origen utilizados; editarlos posteriormente no cambia el documento anterior. El costo del desvío no se suma al importe del vale. [Detalle del flujo de rutas](rutas-trabajo.md).

La localidad de la ficha se propone en la emisión y puede elegirse otra localidad de la misma zonal. El centro habitual se propone desde la ficha y puede sustituirse por otro habilitado para la misma unidad organizativa. Cuando el centro tiene una localidad propia, se muestra por separado.

La unidad móvil es opcional y queda guardada en cada vale. Se muestran primero las unidades de la zonal del vale. Para elegir una de otra zonal, la jefatura de la zonal base debe haberla habilitado para esa zonal, el centro de costo elegido y la fecha de emisión. La zonal base de la unidad se muestra como un dato del catálogo.

## 2. Autorizar vales

```mermaid
flowchart LR
    chief(["Jefatura abre los emitidos de su zonal"]) --> select["Revisa uno o varios vales"]
    select --> allowed{"¿Siguen emitidos y pertenecen a otro emisor?"}
    allowed -->|"Sí"| confirm["Confirma la autorización"]
    confirm --> authorized(["Autorizado"])
    allowed -->|"No"| denied["Se bloquea la autorización"]
```

La bandeja **Pendientes** permite buscar y filtrar por fecha de emisión, grifo y modalidad. Para autorizar uno, abre su detalle y pulsa **Autorizar vale**. Para varios, marca los vales y pulsa **Revisar selección**. La confirmación muestra los galones y el importe de cada vale, el total estimado y los vales que quedaron fuera del filtro. Puedes quitar vales antes de confirmar.

Cada vale registra una sola autorización con el responsable y la fecha. Si un vale cambia de estado mientras Jefatura revisa el lote, se rechaza la operación completa. Jefatura puede retirar ese vale, revisar el total actualizado y confirmar de nuevo.

## 3. Registrar atención

```mermaid
flowchart TD
    start(["Grifo busca por código, lista o QR"]) --> allowed{"¿Autorizado y del grifo y zonal asignados?"}
    allowed -->|"No"| notice["Se muestra el motivo y se bloquea el despacho"]
    allowed -->|"Sí"| identity["Valida el DNI del destinatario indicado en el vale"]
    identity --> consumption["Ingresa la fecha, los galones y el precio"]
    consumption --> valid{"¿Identidad, cantidad y precio válidos?"}
    valid -->|"No"| correct["Corrige los datos"]
    valid -->|"Sí"| confirm["Confirma el despacho y revisa el aviso de cambio de precio si aplica"]
    confirm --> ticket["Genera ticket por grifo y guarda el importe real"]
    ticket --> used(["Usado con resumen de atención"])
```

El grifo verifica el documento original del destinatario. Si el vale se emitió para un tercero, se exige el DNI de ese tercero. En los demás casos se exige el del trabajador asignado. Un DNI válido abre los datos del despacho.

La tarifa de la fecha de consumo sugiere el precio real. Si falta tarifa, un vale con contrato puede usar el precio pactado como respaldo. El consumo no puede superar lo autorizado. Un despacho parcial cierra el vale y libera la diferencia de la reserva cuando corresponde. El ticket identifica el despacho dentro de ese grifo. Si se interrumpe el guardado, la consulta del vale permite recuperar el ticket existente.

## 4. Asociar factura

```mermaid
flowchart TD
    start(["Contabilidad selecciona los vales atendidos sin factura"]) --> factura["Elige una factura del mismo grifo"]
    factura --> tickets{"¿Coinciden todos los tickets de los vales y la factura?"}
    tickets -->|"No"| correct["Revisa los vales seleccionados o la factura"]
    tickets -->|"Sí"| match{"¿La suma coincide con el total de la factura?"}
    match -->|"No"| correct
    match -->|"Sí"| confirm["Contabilidad confirma y asocia los vales"]
    confirm --> expense(["Consumos disponibles en Consultar gastos"])
```

El grifo selecciona sus tickets sin facturar y confirma una factura simulada. El servidor calcula el importe y asigna el siguiente número por grifo y serie dentro de una transacción. Los reintentos de la misma solicitud devuelven la misma factura. Las facturas anteriores de ejemplo conservan sus tickets y se consultan al elegirlas. El botón se habilita cuando coincide el conjunto completo de tickets y el total final a dos decimales. Una factura puede incluir consumos con contrato y S/C cuando contiene los tickets de ambos. La asociación cerrada conserva el vínculo de cada vale.

## 5. Anular vale

```mermaid
flowchart LR
    start(["Operativo elige un vale propio"]) --> check{"¿Emitido o autorizado sin uso?"}
    check -->|"No"| stop["Se bloquea la anulación"]
    check -->|"Sí"| reason["Indica motivo y confirma"]
    reason --> cancel["Registra la anulación y libera la reserva si corresponde"]
    cancel --> done(["Anulado"])
```

El operativo busca un vale propio emitido o autorizado. En el celular toca la tarjeta y en escritorio usa la acción **Anular vale**. Revisa la tarjeta con el motivo y confirma. El vale pasa a **Anulado** y queda disponible para consulta con el responsable, la fecha y el motivo.

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

## 8. Emitir factura simulada desde el grifo

```mermaid
flowchart TD
    start["Grifo consulta sus tickets pendientes"] --> select["Selecciona tickets y fecha de factura"]
    select --> check{"¿Atenciones de su grifo y zonal sin facturar?"}
    check -->|"No"| error["Corrige la selección"]
    check -->|"Sí"| confirm["Confirma la emisión simulada"]
    confirm --> transaction["Servidor bloquea correlativo y vales, calcula total y asigna número"]
    transaction --> issued["Factura con sus tickets disponible para Contabilidad"]
    issued --> reconcile["Contabilidad selecciona vales y concilia tickets e importe"]
```

Una factura puede reunir consumos con contrato y S/C del mismo grifo. También puede emitirse una factura separada por modalidad. Un ticket incluido en una factura emitida no puede facturarse otra vez ni asociarse a un documento distinto. La factura simulada no se envía a SUNAT.

## 9. Apoyos al registro y al control

- La consulta de DNI busca en el catálogo y luego en el proveedor externo si está configurado. El modo demostración identifica los datos ficticios. En atención se conserva la verificación del DNI esperado por el vale.
- La comparación de grifos considera solo opciones habilitadas. El traslado es una estimación de ida y vuelta en línea recta con costo por km indicado.
- El detalle y PDF comparten los datos actuales. El QR público muestra código, grifo, fecha y estado; los demás datos requieren sesión.
