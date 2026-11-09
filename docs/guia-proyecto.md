# Guía de uso de Vales

## Qué controla el sistema

Cada vale corresponde a una zonal, un grifo y un combustible. El código de diez dígitos se combina con la zonal para identificarlo. El QR usa un identificador propio. El centro de costo indica dónde se imputa el gasto. La emisión propone el de la ficha del trabajador y admite otro de su misma unidad organizativa.

| Modalidad | Precio de emisión | Cargo al contrato |
| --- | --- | --- |
| Con contrato | Precio pactado para el combustible en el contrato vigente del grifo | Reserva el estimado y lo sustituye por el importe real al atender |
| S/C para tercero | Tarifa vigente del grifo | El consumo se registra aparte. El trabajador interno queda como responsable y el grifo verifica el DNI del tercero |
| S/C por vencimiento | Tarifa vigente del grifo | El consumo se registra aparte. Se usa si el grifo tiene un contrato vencido y ninguno vigente. El grifo verifica el DNI del trabajador |

Un contrato sin saldo suficiente bloquea la emisión con contrato. Para emitir S/C se requiere una tarifa aplicable. Desde **Avatar → Configuración**, Administración mantiene precios pactados de contratos existentes, tarifas del grifo, cuentas y roles. La aplicación concilia facturas ya cargadas y reporta gastos. El pago se gestiona fuera de Vales.

## Cuentas de prueba

La contraseña de las cuentas de ejemplo es `demo`.

| Zonal | Operativo | Jefatura | Grifo | DNI ficticio |
| --- | --- | --- | --- | --- |
| Piura | `demo.operativo.piura` | `demo.jefe.piura` | `demo.grifo.algarrobos` | `90000001` |
| Sullana | `demo.operativo.sullana` | `demo.jefe.sullana` | `demo.grifo.santaelena` | `90000002` |
| Paita | `demo.operativo.paita` | `demo.jefe.paita` | `demo.grifo.paita` | `90000011` |
| Talara | `demo.operativo.talara` | `demo.jefe.talara` | `demo.grifo.talara` | `90000014` |

`demo.contabilidad` asocia facturas y consulta gastos. `demo.admin` gestiona la configuración. Para probar otro grifo de Piura, están `demo.operativo.piura3` (DNI `90000202`) y `demo.grifo.miraflores`.

En una copia recién instalada, el vale autorizado **2026110044 de Piura** permite comparar el PDF de `demo.jefe.piura` con el de `demo.grifo.algarrobos`. El DNI ficticio de Mateo Salazar es `90000201`.

## Pruebas de punta a punta

1. **Emitir y autorizar.** El operativo de Piura elige **Estación Los Algarrobos (demo)**, un suministro disponible y **2 galones**. Revisa la asignación y confirma. Jefatura de Piura busca el código y autoriza. El vale pasa de **Emitido** a **Autorizado**.
2. **Atender.** La cuenta de Los Algarrobos busca el vale por código, lista o QR. Verifica el DNI ficticio `90000001`, registra **1.50 galones** y revisa la confirmación. El sistema genera el ticket y cierra el vale como **Usado**. Si se supera lo autorizado, se bloquea el registro. Si se cambia el precio sugerido, la confirmación muestra la diferencia.
3. **Facturar y consultar gastos.** Contabilidad elige vales usados y sin factura de un mismo grifo. Selecciona un documento que corresponda a esos consumos. Los ejemplos históricos incluyen facturas que cuadran y otras con un céntimo de diferencia. Después de confirmar, el gasto aparece en el mes del **consumo**, aunque la factura sea de otro mes.
4. **Anular y consultar PDF.** El emisor puede anular un vale propio emitido o autorizado, indicando el motivo. El PDF refleja el estado actualizado. Se abre desde el servicio **PDF del vale** o desde la ficha del QR tras iniciar sesión.

En **Asociar factura**, dos vales de un mismo grifo por S/ 300 con contrato y S/ 80 S/C pueden asociarse a una factura de S/ 380 que cubra ambos. [Flujo de asociación](flujos-vales.md#4-asociar-factura)

Para probar **S/C por vencimiento**, el operativo de Sullana elige **Grifo Contrato Vencido (demo)** y **Diésel B5** si la fecha de emisión cumple la regla de vencimiento. Jefatura de Sullana autoriza y `demo.grifo.vencido` atiende con el DNI `90000002`. Para probar **S/C para tercero**, se puede usar **Estación Santa Elena (demo)** y el DNI ficticio `90000003`. El grifo verifica ese documento aunque el vale figure a nombre del trabajador interno responsable.

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
4. Abrir en el celular la dirección HTTPS que anuncia Vales. Ir a **Registrar atención → Escanear QR → Activar cámara** y conceder el permiso. Los PDF descargados con otra dirección se generan nuevamente para actualizar el enlace impreso. Si cambia la IP privada de la PC, se actualiza `VALES_HTTPS_IPV4` y se reinicia.

Para probar con un QR guardado, usar **Leer imagen** en el escáner.

El QR abre una ficha pública dentro de la red local con código, grifo, fecha de emisión y estado. Para ver el PDF o realizar operaciones se requiere sesión y permiso. Los accesos de la ficha llevan al servicio correspondiente. El PDF muestra el DNI del trabajador a las cuentas habilitadas para verlo. Al grifo le indica que debe verificarlo con el documento presentado.
