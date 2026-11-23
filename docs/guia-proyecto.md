# Guía de uso de Vales

## Qué controla el sistema

Cada vale corresponde a una zonal, un grifo y un combustible. El código de diez dígitos se combina con la zonal para identificarlo. El QR usa un identificador propio. Un operativo puede emitir varios vales abiertos. Cada vale conserva el centro de costo elegido y, si corresponde, la unidad móvil. El centro alternativo debe estar habilitado para la unidad organizativa del trabajador.

| Modalidad | Precio de emisión | Cargo al contrato |
| --- | --- | --- |
| Con contrato | Precio pactado para el combustible en el contrato vigente del grifo | Reserva el estimado y lo sustituye por el importe real al atender |
| S/C para tercero | Tarifa vigente del grifo | El consumo se registra aparte. El trabajador interno queda como responsable y el grifo verifica el DNI del tercero |
| S/C por vencimiento | Tarifa vigente del grifo | El consumo se registra aparte. Se usa si el grifo tiene un contrato vencido y ninguno vigente. El grifo verifica el DNI del trabajador |

Un contrato sin saldo suficiente bloquea la emisión con contrato. Para emitir S/C se requiere una tarifa aplicable. Desde **Configuración** en el menú lateral, Administración mantiene precios pactados de contratos existentes, tarifas del grifo, unidades móviles, cuentas y roles. La aplicación concilia facturas ya cargadas y reporta gastos. El pago se gestiona fuera de Vales.

## Cuentas de prueba

Usa la contraseña asignada a tu cuenta. En una base local recién creada, la clave inicial está en `.local/demo.clave`.

| Zonal | Operativo | Jefatura | Grifo | DNI ficticio |
| --- | --- | --- | --- | --- |
| Piura | `demo.operativo.piura` | `demo.jefe.piura` | `demo.grifo.algarrobos` | `90000001` |
| Sullana | `demo.operativo.sullana` | `demo.jefe.sullana` | `demo.grifo.santaelena` | `90000002` |
| Paita | `demo.operativo.paita` | `demo.jefe.paita` | `demo.grifo.paita` | `90000011` |
| Talara | `demo.operativo.talara` | `demo.jefe.talara` | `demo.grifo.talara` | `90000014` |

`demo.contabilidad` asocia facturas y consulta gastos. `demo.admin` gestiona la configuración. Para probar otro grifo de Piura, están `demo.operativo.piura3` (DNI `90000202`) y `demo.grifo.miraflores`.

Para comparar la vista del vale entre perfiles, abre un vale autorizado de **Los Algarrobos** con `demo.grifo.algarrobos` y busca el mismo código en **PDF del vale** con `demo.jefe.piura`.

## Pruebas de punta a punta

1. **Emitir y autorizar.** El operativo de Piura elige **Con contrato**, verifica la fecha, selecciona **Grifo Los Algarrobos (demo)** y registra **2 galones** de un suministro disponible. En **Asignación**, Rosa Gutiérrez conserva su localidad **CASTILLA**, selecciona **POZO LOS ALGARROBOS** y la unidad **DEM-101**, si corresponde. La localidad del trabajador se completa automáticamente y es independiente de la localidad del centro. Jefatura de Piura busca el código y autoriza. El vale pasa de **Emitido** a **Autorizado**.
2. **Atender.** La cuenta de Los Algarrobos busca el vale por código, lista o QR. Verifica el DNI ficticio `90000001`, registra **1.50 galones** y revisa la confirmación. El sistema genera el ticket y cierra el vale como **Usado**. Si se supera lo autorizado, se bloquea el registro. Si se cambia el precio sugerido, la confirmación muestra la diferencia.
3. **Facturar y consultar gastos.** En **Facturas del grifo**, selecciona el ticket que acabas de generar y emite la factura simulada. Entra con `demo.contabilidad`, selecciona el vale usado y elige esa factura. Confirma cuando el ticket y el total coincidan. El gasto aparece en el mes del **consumo**.
4. **Anular y consultar PDF.** El emisor puede anular un vale propio emitido o autorizado, indicando el motivo. El PDF refleja el estado actualizado. Se abre desde el servicio **PDF del vale** o desde la ficha del QR tras iniciar sesión.

Si una factura de S/ 380 incluye un ticket de S/ 300 con contrato y otro de S/ 80 S/C, Contabilidad selecciona los dos vales. [Flujo de asociación](flujos-vales.md#4-asociar-factura)

Para probar **S/C por vencimiento**, el operativo de Sullana elige **Grifo Contrato Vencido (demo)** y **Diésel B5** si la fecha de emisión cumple la regla de vencimiento. Jefatura de Sullana autoriza y `demo.grifo.vencido` atiende con el DNI `90000002`. Para probar **S/C para tercero**, se puede usar **Estación Santa Elena (demo)** y el DNI ficticio `90000003`. El grifo verifica ese documento aunque el vale figure a nombre del trabajador interno responsable.

### Probar una unidad de otra zonal

1. Entrar como `demo.operativo.piura`. En **Registrar vale → Asignación**, comprobar que **DEM-101** aparece entre las unidades de Piura.
2. Entrar como `demo.jefe.sullana`. En **Configuración → Préstamos de unidades**, seleccionar **DEM-202**. Seleccionar **Piura**, el centro **Pozo Pachitea** y un período que incluya la fecha de emisión.
3. Volver a entrar como el operativo de Piura. Al elegir **Pozo Pachitea**, **DEM-202** aparece bajo **Habilitadas de otra zonal**. Al cambiar de centro o usar una fecha fuera del período, desaparece. Si se registra el vale con esa unidad, su placa queda visible en el detalle.

## HTTPS en la red local

1. Crear un subdominio propio en [DuckDNS](https://www.duckdns.org/). Obtener con `ipconfig` la IPv4 privada de la PC que comparte Wi-Fi con el celular.
2. Abrir el archivo privado `.env` en la raíz del proyecto y completar los campos de HTTPS. Se indica `VALES_HTTPS_ACCEPT_TERMS=true` tras aceptar los términos de Let's Encrypt.

   ```properties
   VALES_HTTPS_ENABLED=true
   VALES_HTTPS_DOMAIN=mi-subdominio.duckdns.org
   VALES_HTTPS_IPV4=192.168.1.50
   VALES_DUCKDNS_TOKEN=
   VALES_HTTPS_ACCEPT_TERMS=false
   ```

3. Reiniciar **Ejecutar Services Vales**. En Windows x64, Vales prepara lego, valida el dominio mediante DuckDNS y obtiene un certificado de Let's Encrypt. El token queda en `.env` y los certificados se guardan en `.local/https/`.
4. Abrir en el celular la dirección HTTPS que anuncia Vales. Ir a **Registrar atención → Escanear QR** y conceder el permiso. Los PDF descargados con otra dirección se generan nuevamente para actualizar el enlace impreso. Si cambia la IP privada de la PC, se actualiza `VALES_HTTPS_IPV4` y se reinicia.

Para probar con un QR guardado, usar **Leer QR desde una imagen** en el escáner.

El QR abre una ficha pública con código, grifo, fecha de emisión y estado. Si mantienes abierta la verificación, el estado se actualiza automáticamente hasta que el vale quede **Usado** o **Anulado**. Para ver el PDF o realizar operaciones se requiere sesión y permiso. Los accesos de la ficha llevan al servicio correspondiente. El PDF muestra el DNI del trabajador a las cuentas habilitadas para verlo. Al grifo le indica que debe verificarlo con el documento presentado.

## Nuevas pruebas

1. **DNI de tercero.** Operativo elige Sin contrato para tercero, escribe el DNI y pulsa Consultar. Vales muestra el nombre del catálogo o del proveedor configurado. Debe completar destino o motivo antes de registrar. En una prueba aislada con `VALES_DNI_PROVIDER=demo`, el DNI 99000001 muestra a Ana Torres Rojas.
2. **Facturación automática.** Después de atender un vale, el grifo abre Facturas del grifo, selecciona el ticket y confirma Emitir factura. Se muestra la serie y número generado. Contabilidad lo elige en Asociar factura y verifica el conjunto de tickets y el total.
3. **Generar mejor opción.** Jefatura programa rutas y asigna operativos desde **Configuración → Rutas de trabajo**. Al emitir el vale, el operativo completa modalidad, suministro y galones y pulsa la varita junto a **Grifo**. En la modal **Comparar grifos** elige su ruta y puede cambiar el origen. **Generar mejor opción** muestra el recorrido por el grifo que minimiza la suma de combustible y desvío vial, respetando el orden de las paradas. Se pueden consultar los pines del origen, las paradas y los grifos. **Elegir grifo** aplica la recomendación y vuelve al formulario. El importe del vale corresponde al combustible. El registro guarda la versión de la ruta y el origen sin modificar la localidad administrativa. [Ejemplo paso a paso, permisos y configuración](rutas-trabajo.md).
5. **Móvil.** En el menú del navegador se puede instalar Vales cuando esté disponible. El lector con cámara requiere localhost o HTTPS. Las operaciones de registro necesitan conexión.
6. **PDF separado.** La acción Ver PDF de la lista o del pie del detalle abre una ventana independiente. Descargar e Imprimir utilizan ese mismo documento. Cerrar PDF vuelve a la lista o al detalle sin perder la selección de vales.
