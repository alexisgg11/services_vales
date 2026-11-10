# Base de datos y datos de prueba

## Copia incluida

Una instalación nueva prepara el esquema, carga la [copia de prueba](../backend/src/main/resources/db/datos/copia-prueba.sql) y aplica las migraciones 12 a 14. Cada vale conserva la unidad con la que se emitió.

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

Para una base que ya tiene la migración 11, el propietario ejecuta la [migración 12](../backend/src/main/resources/db/migraciones/12-unidad-movil-por-vale.sql) una sola vez. Se elimina la asignación de la ficha del trabajador y se conservan las unidades guardadas en los vales. La instancia privada de Vales aplica el cambio al arrancar.

La [migración 13](../backend/src/main/resources/db/migraciones/13-unidades-por-zonal.sql) añade la zonal base al catálogo y las habilitaciones por trabajo. Los vales existentes conservan su unidad. Las unidades del catálogo que todavía carecen de zonal base se configuran desde Administración.

La [migración 14](../backend/src/main/resources/db/migraciones/14-conciliacion-tickets-ubicaciones.sql) añade los tickets y su origen a las nuevas conciliaciones. Las asociaciones históricas conservan sus vínculos y carecen de respaldo registrado por este flujo. La migración separa la ubicación explícita del nombre del centro de costo. Si el texto identifica una localidad única del catálogo, guarda su código. Los demás textos explícitos se conservan como referencia. El catálogo guarda la zonal base de la unidad por separado y retira el sufijo de la descripción cuando coincide con esa zonal.

## Dónde se guarda cada dato

- **Identidad y acceso.** `persona` guarda el DNI, `trabajador` guarda la ficha laboral y `usuario` referencia al trabajador. `usuario_rol` asigna el rol y, cuando corresponde, la zonal y el grifo.
- **Operación.** `vales` guarda emisión, responsables, despacho, ticket y factura. `factura_ticket` guarda los tickets de las nuevas conciliaciones. `historial_vale` registra cada cambio.
- **Precios.** `contrato_suministro` guarda el precio pactado por combustible. `tarifa` guarda el precio vigente del grifo. El vale conserva el precio de emisión y el de atención.
- **Organización.** `asignacion_costo` vincula centros de costo con sus unidades organizativas. El centro puede tener una localidad de catálogo. `unidad_maquinaria` guarda la zonal base y `habilitacion_unidad` registra los préstamos por zonal, centro y fechas. El vale conserva el centro y la unidad elegidos.

[Diagrama de relaciones](diagrama-base-datos.md) · [Guía de uso y cuentas](guia-proyecto.md)
