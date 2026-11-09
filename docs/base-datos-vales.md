# Base de datos y datos de prueba

## Copia incluida

Una instalación nueva carga la [copia de prueba](../backend/src/main/resources/db/datos/copia-prueba.sql) después de aplicar las [migraciones](../backend/src/main/resources/db/migraciones).

| Registros | Cantidad |
| --- | ---: |
| Vales | 178 |
| Facturas | 77 |
| Trabajadores | 27 |
| Cuentas de prueba | 25 |
| Movimientos de historial | 526 |

Para probar los reportes, seleccionar noviembre de 2026 o un mes anterior.

## Ver la instancia privada en pgAdmin

1. Iniciar Vales desde VS Code y mantenerlo abierto.
2. Desde la raíz del proyecto, obtener el puerto de PostgreSQL de esa ejecución.

   ```powershell
   Get-Content .local/postgres/postmaster.pid -TotalCount 4 | Select-Object -Last 1
   ```

3. En pgAdmin, registrar un servidor con **Host** `127.0.0.1`, **Port** igual al puerto obtenido, **Maintenance database** `services_vales` y **Username** `vales_owner`. La contraseña se lee en `.local/propietario.clave`.
4. Abrir **Databases → services_vales → Schemas → vales → Tables**. Si el puerto cambia tras reiniciar, se actualiza en la conexión de pgAdmin.

## Cargar la copia en PostgreSQL 5432

1. Crear una base nueva. Ejecutar el instalador con una cuenta que pueda crear el rol `vales_app` si aún no existe. Ejemplo en PowerShell desde la raíz del proyecto.

   ```powershell
   $pg = 'C:\Program Files\PostgreSQL\18\bin'
   & "$pg\createdb.exe" -h 127.0.0.1 -p 5432 -U postgres services_vales
   & "$pg\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d services_vales -f backend/src/main/resources/db/instalar-demo.sql
   ```

   Para generar ejemplos con fechas relativas al día de instalación se agrega `-v datos_relativos=1` al comando de `psql`.

2. Desde Query Tool, crear una cuenta de conexión que herede `vales_app` y asignarle una contraseña propia desde pgAdmin.

   ```sql
   CREATE ROLE vales_conexion LOGIN IN ROLE vales_app;
   ```

3. Abrir `.env` en la raíz. Si todavía no se ha generado, copiar [`.env.example`](../.env.example) como `.env`. Completar la conexión con la contraseña asignada y reiniciar **Ejecutar Services Vales**.

   ```properties
   VALES_DB_MODE=externa
   VALES_DB_URL=jdbc:postgresql://127.0.0.1:5432/services_vales
   VALES_DB_USER=vales_conexion
   VALES_DB_PASSWORD=
   ```

   El archivo usa el formato `CLAVE=valor`, sin comillas. Una barra invertida literal se escribe como `\\`. Para volver a la instancia privada, se elige `VALES_DB_MODE=local`.

## Actualizar una instalación existente

El propietario de la base aplica solo las [migraciones pendientes](../backend/src/main/resources/db/migraciones), en orden. Si la conexión estaba en `.local/vales-db.properties`, se trasladan `url`, `usuario` y `clave` a las variables de `.env` del paso anterior.

## Dónde se guarda cada dato

- **Identidad y acceso.** `persona` guarda el DNI, `trabajador` guarda la ficha laboral y `usuario` referencia al trabajador. `usuario_rol` asigna el rol y, cuando corresponde, la zonal y el grifo.
- **Operación.** `vales` guarda emisión, responsables, despacho, ticket y factura. `historial_vale` registra cada cambio.
- **Precios.** `contrato_suministro` guarda el precio pactado por combustible. `tarifa` guarda el precio vigente del grifo. El vale conserva el precio de emisión y el de atención.
- **Organización.** `asignacion_costo` vincula centros de costo con sus unidades organizativas. El vale conserva el centro seleccionado.

[Diagrama de relaciones](diagrama-base-datos.md) · [Guía de uso y cuentas](guia-proyecto.md)
