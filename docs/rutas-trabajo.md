# Rutas de trabajo y recomendación de grifos

## Funcionamiento

Jefatura registra los recorridos de su zonal desde **Configuración → Rutas de trabajo**. Una ruta representa un trabajo o recorrido con fechas de vigencia y de 1 a 15 paradas en orden de visita, además del punto de partida. Puede asignarse a varios operativos de esa zonal. Un operativo puede tener varias rutas vigentes y elige la correspondiente a su trabajo al registrar el vale.

Cada ruta tiene un punto de partida compartido. El sistema propone la referencia de la localidad del primer operativo asignado. Jefatura puede elegir otra localidad o marcar un punto en el mapa. Cuando la partida y todas las paradas están ubicadas, el mapa dibuja automáticamente el recorrido por calles. La casa indica la partida, los números indican el orden de visita y la bandera indica la llegada.

Los lugares pueden vincularse a un centro de costo o registrarse como otro punto de trabajo. Si el centro tiene dirección y coordenadas en el catálogo, se ubica automáticamente al elegirlo. Los pozos y otros centros físicos de ejemplo tienen referencias ficticias. La ruta guarda las coordenadas elegidas para cada parada junto con su centro y su nombre.

Jefatura puede editar fechas, asignaciones, paradas y estado. Cada edición incrementa la versión; una versión desactualizada se rechaza para evitar sobrescribir cambios de otro usuario. Los vales ya registrados conservan su copia de la ruta y del origen utilizado.

## Registrar y probar

1. Entrar con `demo.jefe.piura` y la clave de la base de demostración. Abrir **Configuración → Rutas de trabajo**. Pulsar **Nueva ruta** o el lápiz de una fila para abrir el editor.
2. En **Datos**, escribir un nombre y fechas que incluyan el día de prueba. En **Operativos**, abrir el selector y marcar la casilla de **Rosa Gutiérrez**.
3. En **Paradas**, tocar la casa para ajustar la partida o pulsar **Elegir partida** si está por definir. Elegir una localidad o marcar el mapa y pulsar **Usar partida**. Pulsar **Añadir parada** y elegir **POZO PACHITEA — PIURA** en **Centro de costo**. La parada pasa a **Ubicada** y muestra su dirección de referencia y el pin. **Ubicar centro** y **Ajustar centro** conservan el vínculo con el centro de costo. **Marcar punto libre** lo retira al confirmar con **Usar punto**.
4. Añadir los demás lugares. Tocar una parada en la lista o su pin para editarla. Arrastrar su número para cambiar el orden. Con teclado, pulsar **Espacio**, mover con las flechas y pulsar **Espacio** para soltar. **Expandir mapa** amplía el recorrido en el editor. Con dos o más paradas ubicadas, pulsar la varita para optimizar y pulsarla de nuevo para restaurar el orden anterior. Revisar el trazado y pulsar **Guardar ruta**.
5. Entrar como `demo.operativo.piura`. En **Registrar vale**, elegir modalidad, suministro y galones. El grifo puede quedar sin seleccionar mientras se genera la recomendación.
6. Pulsar la varita junto al campo **Grifo** para abrir **Comparar grifos** y elegir la ruta. Si solo hay una vigente se propone automáticamente. El vale propone la partida guardada por Jefatura. Las rutas anteriores sin partida guardada proponen la localidad del operativo. Usar **Cambiar** para ajustar el origen de ese vale.
7. Pulsar **Generar mejor opción** para abrir el mapa del recorrido con el grifo recomendado. Pasar el puntero, enfocar o tocar los pines para consultar el origen, las paradas y los datos de cada grifo.
8. Pulsar **Elegir grifo** para aplicar la recomendación al vale. Para elegir otro proveedor, usar **Grifo** en **Datos de emisión**. Completar la asignación y confirmar el registro. La ruta guardada aparece en el detalle compartido del vale.

Para un tercero, Jefatura asigna al operativo emisor la ruta correspondiente al encargo; el emisor elige el origen adecuado. El beneficiario y el motivo se mantienen en los campos habituales del vale.

## Optimización del orden de visita

La varita de Jefatura consulta a OSRM por las distancias viales entre la partida y las paradas en ambos sentidos. Con 2 a 15 paradas, Java usa programación dinámica para reutilizar el mejor recorrido parcial de cada conjunto de paradas visitadas y su última parada. Elige la secuencia de menor distancia acumulada en esa matriz. La partida queda fija y el recorrido termina en la última parada del orden sugerido.

Con un costo constante por kilómetro, este criterio reduce el costo estimado de traslado. La matriz usa la distancia de los trayectos más rápidos del perfil vial de OSRM. La interfaz muestra los kilómetros estimados antes y después del cambio. La lista y los pines se actualizan en el borrador y el nuevo orden se registra al pulsar **Guardar ruta**.

`Route` dibuja el orden actual antes de optimizar y vuelve a trazarlo cuando el orden o un punto confirmado cambia. Muestra la distancia y el tiempo estimado de conducción del trazado. La ayuda **Accesos a la vía** señala los puntos a 100 m o más de su acceso vehicular, respetando las coordenadas elegidas para cada parada. Si el cálculo falla, el mapa permite revisar los pines y reintentar.

## Criterio de recomendación

1. El servidor valida que la ruta esté asignada al usuario y vigente en la fecha de emisión.
2. Filtra los grifos por modalidad, suministro, precio y saldo contractual suficiente.
3. OSRM obtiene una matriz vial entre origen, paradas y grifos. Se calcula el recorrido de trabajo sin abastecimiento.
4. Para cada grifo se prueba su inserción antes de cada parada, conservando el orden de los trabajos. Se elige la inserción con menor distancia vial y, en empate, menor duración.
5. El desvío adicional es la diferencia entre ese recorrido y el recorrido de trabajo original, con mínimo cero. No se supone un retorno al origen.
6. El total comparativo es **importe del combustible solicitado + kilómetros adicionales × S/ 0.50**. Se ordena por ese total, luego por desvío y código de proveedor.
7. El mapa dibuja el recorrido por el grifo recomendado. Una casa marca el origen, los números identifican las paradas intermedias y una bandera a cuadros indica la meta. Los grifos aparecen como surtidores.

El importe del vale sigue siendo solamente el combustible. La comparación es una estimación, no una garantía de ahorro. Las distancias y duraciones corresponden a recorridos del perfil de conducción de OSRM; no consideran tráfico en tiempo real ni disponibilidad del vehículo para completar el recorrido. El sistema conserva la secuencia asignada por Jefatura y no reordena los trabajos.

Si faltan rutas o el motor vial no responde, se puede seleccionar el grifo en **Datos de emisión**.

## Persistencia y permisos

| Tabla | Responsabilidad |
| --- | --- |
| `vales.ruta_trabajo` | Nombre, zonal responsable, período, estado, versión, creador y punto de partida. |
| `vales.centro_costo` | Catálogo de centros, localidad, dirección y coordenadas opcionales. |
| `vales.ruta_parada` | Lugares de trabajo, centro de costo opcional, coordenadas y orden. |
| `vales.ruta_asignacion` | Relación de varios operativos con varias rutas. |
| `vales.vale_ruta` | Ruta, versión, copia de las paradas y origen utilizados en un vale. |

La migración [18-rutas-trabajo.sql](../backend/src/main/resources/db/migraciones/18-rutas-trabajo.sql) añade las tablas y funciones de rutas. La [19-punto-partida-ruta.sql](../backend/src/main/resources/db/migraciones/19-punto-partida-ruta.sql) añade la partida guardada y su vínculo con el vale. El modo local aplica las migraciones pendientes al arrancar. En una base externa con registros, hacer un respaldo y aplicar solo las migraciones pendientes en orden con la cuenta propietaria.

La [migración 22](../backend/src/main/resources/db/migraciones/22-ubicaciones-centros-costo.sql) carga los puntos y direcciones de referencia del catálogo.

La [migración 23](../backend/src/main/resources/db/migraciones/23-rutas-quince-paradas.sql) habilita hasta 15 paradas por ruta. Aplícala antes de desplegar la versión que amplía el límite.

Las funciones de PostgreSQL validan rol, zonal, vigencia y asignación. La cuenta de aplicación solo ejecuta esas funciones y no recibe permisos de escritura directa sobre las tablas nuevas. La vinculación de la ruta y el registro del vale se confirman en la misma transacción; si la versión cambió, se revierte el vale.

## APIs e integración vial

La gestión se mantiene dentro de Autorización y la recomendación dentro de Emisión. Emisión consulta las rutas mediante el servicio de aplicación de Autorización, sin acceder a su repositorio.

| Endpoint | Uso |
| --- | --- |
| `GET /api/v1/autorizacion/rutas` | Rutas y operativos de la zonal de Jefatura. |
| `POST /api/v1/autorizacion/rutas` | Crear ruta y asignaciones. |
| `POST /api/v1/autorizacion/rutas/{id}` | Editar con control de versión. |
| `POST /api/v1/autorizacion/rutas/optimizar` | Sugerir el orden de menor distancia estimada para un borrador de la zonal de Jefatura. |
| `POST /api/v1/autorizacion/rutas/trazado` | Obtener la geometría, distancia, duración y accesos viales del orden actual del borrador. |
| `GET /api/v1/emision/rutas?fecha=AAAA-MM-DD` | Rutas asignadas y vigentes del operativo. |
| `POST /api/v1/emision/recomendaciones/ruta` | Comparar grifos sobre la ruta y obtener el trazado recomendado. |
| `GET /api/v1/emision/vales/{id}/ruta` | Copia de la ruta guardada con acceso según permisos del vale. |

El adaptador `OsrmRutas` implementa `MotorRutas`. Usa **Table** para distancias y duraciones y **Route** para la geometría del recorrido. El cliente limita las consultas a un intervalo mínimo de un segundo, conserva respuestas cinco minutos, limita la caché y rechaza un segundo cálculo simultáneo del mismo operativo. Admite hasta veinte grifos candidatos por cálculo. Solo envía coordenadas al motor, sin nombres ni documentos.

Jefatura y Emisión trazan los puntos en el orden calculado con `continue_straight=false`. De esta forma OSRM puede reiniciar la marcha al detenerse en cada punto, con las maniobras que admite su red vial, tal como al medir los tramos de forma independiente en Table.

| Servicio de OSRM | Aplicación en Vales |
| --- | --- |
| **Route** | Dibuja por calles el orden actual y estima la distancia y el tiempo de conducción. Sus accesos viales permiten advertir si un pin está lejos de la carretera en la misma consulta. |
| **Table** | Calcula los tramos dirigidos para elegir el orden de paradas y comparar desvíos a grifos. |
| **Nearest** | Puede ofrecer accesos alternativos al editar un punto aislado. |
| **Match** | Puede reconstruir un viaje real a partir de una traza GPS registrada. |
| **Trip** | Sirve para recorridos circulares o con destino fijo. Table permite conservar la partida y elegir la última parada con el criterio de kilometraje de Vales. |
| **Tile** | Permite inspeccionar qué calles y pesos utiliza la red de enrutamiento. |

La URL predeterminada es el servidor público de demostración de OSRM. No requiere token para la prueba local y sí conexión a Internet. Para despliegue estable debe configurarse un servidor compatible con capacidad y condiciones de uso adecuadas:

```properties
VALES_ROUTING_URL=https://router.project-osrm.org
```

Esta variable es opcional y no modifica las credenciales existentes de `.env`. Referencia técnica: [API oficial de OSRM](https://project-osrm.org/docs/v5.24.0/api/).

## Verificaciones realizadas

- Creación de varias rutas para un operativo y conservación del orden de las paradas.
- Bloqueo de creación por Operativo y edición desde otra zonal.
- Exclusión de rutas inactivas y fuera de fecha.
- Recomendación por precio y desvío, sin elegir únicamente el grifo más cercano al origen.
- Rechazo de trayectos sin acceso vial y de versiones desactualizadas.
- Registro del vale con copia de la ruta; una edición posterior no cambia esa copia.
- Reversión completa de la emisión si falla la vinculación de la ruta.
- Migración con comprobación de conservación de las tablas existentes.
