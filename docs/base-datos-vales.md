# Base de datos y datos de prueba

## Copia incluida

Una instalación nueva desde VS Code carga automáticamente la [copia de prueba del 8 de noviembre de 2026](../backend/src/main/resources/db/datos/copia-prueba.sql) después de aplicar las [migraciones](../backend/src/main/resources/db/migraciones). Contiene los registros operativos de la base de Vales en esa fecha.

| Registros | Cantidad |
| --- | ---: |
| Vales | 178 |
| Facturas | 77 |
| Trabajadores | 27 |
| Cuentas de prueba | 25 |
| Movimientos de historial | 526 |

La copia conserva identificadores, correlativos, estados, precios, contratos y asociaciones. Incluye cuentas y DNI ficticios. Las credenciales de PostgreSQL, los archivos de HTTPS y los registros de la publicación remota retirada quedan fuera del repositorio. La copia conserva las fechas originales. Las pruebas de reportes pueden hacerse en noviembre de 2026 y meses anteriores. Las bases existentes conservan sus datos.

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

   El archivo usa el formato `CLAVE=valor`, sin comillas. Una barra invertida literal se escribe como `\\`. Git excluye `.env`. Para usar la instancia privada, se elige `VALES_DB_MODE=local`. Si la instalación anterior guardaba la conexión en `.local/vales-db.properties`, se trasladan los valores de `url`, `usuario` y `clave` a las variables indicadas arriba.

En una base de Vales ya configurada en 5432, el propietario aplica solo las migraciones pendientes. Para habilitar el DNI por QR en una instalación anterior, corresponde [la migración 11](../backend/src/main/resources/db/migraciones/11-dni-documento-qr.sql). El instalador completo se reserva para bases nuevas.

Spring Boot mantiene el grupo de conexiones PostgreSQL mediante HikariCP y lo cierra al detener Vales. Los repositorios usan JDBC para las consultas. Las cuentas `demo.*` y sus hashes son datos de prueba de Vales. La cuenta de conexión PostgreSQL es independiente.

## Dónde se guarda cada dato

- **Identidad y acceso.** `persona` guarda el DNI, `trabajador` guarda la ficha laboral y `usuario` referencia al trabajador. `usuario_rol` asigna el rol y, cuando corresponde, la zonal y el grifo.
- **Operación.** `vales` guarda emisión, responsables, despacho, ticket y factura. `historial_vale` registra cada cambio.
- **Precios.** `contrato_suministro` guarda el precio pactado por combustible. `tarifa` guarda el precio vigente del grifo. El vale conserva el precio de emisión y el de atención.
- **Organización.** `asignacion_costo` vincula centros de costo con sus unidades organizativas. El vale conserva el centro seleccionado.

[Diagrama de relaciones](diagrama-base-datos.md) · [Guía de uso y cuentas](guia-proyecto.md)
