# Services Vales

Aplicación para gestionar vales de combustible, con siete APIs por módulos en una aplicación Spring Boot y una interfaz React adaptada a teléfonos.

## Instalar y ejecutar

1. Instalar **JDK 17 o superior**, **PostgreSQL 18** con sus herramientas de línea de comandos y **VS Code** con **Extension Pack for Java**.
2. Abrir la carpeta raíz en VS Code y habilitar la confianza del espacio de trabajo.
3. En **Ejecutar y depurar**, seleccionar **Ejecutar Services Vales** y pulsar **▶**.
4. Esperar la compilación y la apertura del navegador. El primer arranque crea `.env`, prepara una instancia privada de PostgreSQL y carga los datos de prueba. Maven descarga Node.js, npm y las dependencias de React.
5. Ingresar con **demo.operativo.piura** y la clave de la base de demostración. En una instalación local nueva, la clave inicial está en `.local/demo.clave`. Para detener Vales, pulsar **Shift + F5**.

Dirección predeterminada [http://127.0.0.1:8080](http://127.0.0.1:8080). El primer arranque requiere Internet. Si PostgreSQL está instalado en otra ruta, la variable de entorno `VALES_PG_BIN` debe apuntar a su carpeta `bin`.

El modo predeterminado `VALES_DB_MODE=local` conserva sus archivos en `.local/` y aplica migraciones pendientes al arrancar. No modifica el servidor del puerto 5432.

### Usar PostgreSQL en el puerto 5432

1. Crear una base **vacía** llamada `services_vales` desde pgAdmin.
2. Ejecutar el instalador como propietario y proporcionar `VALES_DEMO_PASSWORD` en el entorno de PowerShell. [Instalación de datos de prueba](docs/base-datos-vales.md#instalar-una-base-de-demostración-en-postgresql-5432).

3. Copiar `.env.example` a `.env`, si todavía no existe, y completar:

   ```properties
   VALES_DB_MODE=externa
   VALES_DB_URL=jdbc:postgresql://127.0.0.1:5432/services_vales
   VALES_DB_USER=postgres
   VALES_DB_PASSWORD=contraseña_de_su_PostgreSQL
   ```

4. Ejecutar el perfil de VS Code. Para consultar DNI nuevos, configurar [el proveedor de DNI](#consulta-de-dni).

Las credenciales de `.env` corresponden al PostgreSQL de esa PC. Las cuentas `demo.*` se utilizan en la pantalla de ingreso de Vales. El instalador solo admite bases vacías. Para actualizar una base con registros, se respalda y se aplican únicamente sus migraciones pendientes como propietario. Una cuenta de conexión limitada puede recibir el rol `vales_app`; `postgres` facilita la instalación de desarrollo.

## Desplegar en Railway

El [Dockerfile](Dockerfile) compila React y lo empaqueta con Spring Boot. En Railway se usa un proyecto con dos servicios, Vales y PostgreSQL. El servicio Vales se construye desde la rama `main` de GitHub y desde la raíz del repositorio, ya que Maven usa `backend/` y `frontend/`.

1. Sube el código, las migraciones de `backend/src/main/resources/db/`, `frontend/package-lock.json`, el Maven Wrapper, los archivos Docker y `.env.example`. Mantén `.env`, `.local/`, las fuentes privadas y las carpetas generadas fuera del repositorio.
2. Prepara el esquema de PostgreSQL antes de publicar Vales. Para conservar los registros de una instalación, restaura su respaldo en privado y prepara un usuario de conexión con los permisos de `vales_app`. Consulta la [guía de base de datos](docs/base-datos-vales.md).
   - En una base existente, respalda los datos y aplica las migraciones pendientes como propietario antes de desplegar. La [migración 22](backend/src/main/resources/db/migraciones/22-ubicaciones-centros-costo.sql) carga las referencias geográficas de los centros de costo. El modo externo requiere ejecutar estas migraciones por separado.
3. Genera un dominio público para Vales y configura estas variables en su servicio. Cambia `Postgres` si el servicio de base de datos tiene otro nombre.

   ```dotenv
   VALES_DB_MODE=externa
   VALES_DB_URL=jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
   VALES_DB_USER=vales_conexion
   VALES_DB_PASSWORD=contraseña_del_usuario_de_conexión
   VALES_PUBLIC_BASE_URL=https://tu-dominio.up.railway.app
   VALES_SECURE_COOKIES=true
   VALES_HTTPS_ENABLED=false
   SERVER_FORWARD_HEADERS_STRATEGY=framework
   ```

4. Configura la [consulta de DNI](#consulta-de-dni) en **Vales → Variables** y revisa que el despliegue de `main` quede activo.

Vales toma el puerto de `PORT` en Railway, salvo que se defina `VALES_PORT`. Railway termina HTTPS en su proxy y el navegador puede usar la cámara para escanear. El dominio público se usa en los QR y los enlaces de reportes. [Guía de despliegue](https://docs.railway.com/quick-start) y [conexión privada a PostgreSQL](https://docs.railway.com/databases/postgresql).

## Probar el flujo completo

| Perfil | Cuenta | Acción |
| --- | --- | --- |
| Operativo | `demo.operativo.piura` | Registrar un vale para Los Algarrobos con 2 galones y un vehículo habilitado. |
| Jefatura | `demo.jefe.piura` | Seleccionar el vale y confirmar su autorización. |
| Atención | `demo.grifo.algarrobos` | Consultar el vale, verificar DNI `90000001`, registrar 1.50 galones y confirmar. |
| Grifo | `demo.grifo.algarrobos` | Seleccionar el ticket en Facturas del grifo y emitir la factura simulada. El número y total se generan automáticamente. |
| Contabilidad | `demo.contabilidad` | Seleccionar el vale usado, elegir la factura y asociar cuando coincidan tickets e importe. Consultar el gasto en el mes del consumo. |
| Administrador | `demo.admin` | Configurar cuentas, roles, tarifas, precios faltantes de contrato y zonales base de vehículos. |

Todas estas cuentas usan la clave inicial de su base de demostración. El emisor puede anular vales propios antes del despacho. PDF del vale muestra el documento y el historial actualizado.

Jefatura programa los lugares de trabajo desde **Configuración → Rutas de trabajo**. En **Paradas**, al elegir un centro con dirección y coordenadas en PostgreSQL, como **POZO PACHITEA — PIURA**, el mapa lo ubica en el acto. Las ubicaciones precargadas son ficticias. Jefatura puede ajustar el punto de una parada.

Un operativo puede tener varias rutas asignadas. La varita junto al campo **Grifo** abre el comparador, donde elige la ruta, revisa el origen y pulsa **Generar mejor opción** para comparar combustible y desvío vial. La ruta utilizada queda guardada con el vale. Consulta el [ejemplo y la configuración del motor vial](docs/rutas-trabajo.md).

## Stack y conexión

```mermaid
flowchart LR
    phone["Teléfono o navegador"] --> web["React y TypeScript<br/>shadcn/ui y Tailwind"]
    web -->|"JSON y sesión con CSRF"| api["Spring Boot<br/>Siete APIs por módulos"]
    api -->|"Spring JDBC"| db[("PostgreSQL")]
    api -.->|"DNI nuevo y token configurado"| dni["APIs Perú"]
    api -.->|"Distancias y recorridos viales"| osrm["OSRM"]
    web -.->|"Mapa de grifos"| map["Leaflet y OpenStreetMap"]
    tools["VS Code y Maven Wrapper"] -->|"Vite compila y Maven empaqueta"| api
    dns["DuckDNS y lego<br/>Certificado de Let's Encrypt"] -.->|"HTTPS local opcional"| api
```

Spring Boot 4 sobre Java 17 sirve React 19 y las APIs desde el mismo origen. Spring Security administra la sesión y CSRF. PostgreSQL conserva las relaciones, los permisos por perfil y ámbito, los correlativos y las validaciones transaccionales. Los siete módulos se ejecutan en un proceso y utilizan una base de datos.

| Bloque | Carpeta o herramienta | Función |
| --- | --- | --- |
| Frontend | `frontend/src/app/` | Inicio de React, navegación, proveedores y estilos compartidos. |
| Frontend | `frontend/src/features/` | Pantallas de cada servicio, acceso, consulta pública y administración. |
| Frontend | shadcn/ui, Radix UI y Tailwind CSS 4 | Formularios, diálogos y controles compartidos en `frontend/src/components/`. |
| Frontend | `frontend/src/lib/` | Cliente HTTP con CSRF, tipos TypeScript, importes, QR y PDF comparativo. |
| Frontend | TanStack Query | Consultas y actualización de datos después de cada operación. |
| Frontend | Leaflet, OpenStreetMap y PDF.js | Mapas de recorridos y vista previa del PDF en el navegador. |
| Backend | `modulos/<servicio>/api/` | Controladores y DTO de las solicitudes y respuestas HTTP. |
| Backend | `modulos/<servicio>/aplicacion/` | Casos de uso y transacciones. |
| Backend | `modulos/<servicio>/dominio/` | Modelos propios cuando el caso de uso los requiere. |
| Backend | `modulos/<servicio>/infraestructura/` | Consultas parametrizadas a PostgreSQL. Los módulos colaboran mediante servicios y no acceden a repositorios ajenos. |
| Backend | `modulos/identidad/` y `modulos/administracion/` | Sesión, DNI y configuración compartida. |
| Backend | `ServicesValesApplication.java`, `config/` y `local/` | Punto de entrada, configuración del arranque y ciclo de vida de PostgreSQL local. |
| Base de datos | `backend/src/main/resources/db/` | Migraciones numeradas, instalador y datos de prueba. |
| Compilación | TypeScript 5, Vite 7, Node.js 24 y Maven Wrapper | Generación del frontend e incorporación al JAR de Spring Boot. |
| Despliegue | Docker y Railway | Aplicación con HTTPS público y PostgreSQL en la red privada del proyecto. |
| HTTPS local | DuckDNS, lego y Let's Encrypt | Subdominio, validación DNS y certificado para usar la cámara del teléfono. |

Las rutas Java parten de `backend/src/main/java/com/servicesvales/`.

### Siete APIs

| Módulo | Ruta principal | Función |
| --- | --- | --- |
| `emision` | `POST /api/v1/emision/vales` | Registrar modalidad, precio aplicable, centro y vehículo. |
| `autorizacion` | `POST /api/v1/autorizacion/vales` | Autorizar un lote de la zonal de Jefatura. |
| `atencion` | `POST /api/v1/atencion/vales/{uuid}/atencion` | Verificar DNI, registrar el despacho y generar ticket. |
| `facturacion` | `POST /api/v1/facturacion/grifo` y `/api/v1/facturacion/facturas/{id}/vales` | Emitir la factura simulada y conciliarla desde Contabilidad. |
| `anulacion` | `POST /api/v1/anulacion/vales/{id}` | Anular un vale propio sin atención. |
| `documentos` | `GET /api/v1/documentos/{uuid}` | Consultar datos actuales del detalle, QR y PDF. |
| `gastos` | `GET /api/v1/gastos?mes=AAAA-MM-01` | Consultar consumos facturados por mes. |

Se conservan las rutas anteriores para compatibilidad.

## Funciones de apoyo

- **Comparar grifos.** Pulsa la varita junto a **Grifo**, elige la ruta y ajusta el origen si hace falta. **Generar mejor opción** usa OSRM Table para comparar distancias viales y OSRM Route para dibujar el recorrido por el grifo recomendado. **Elegir grifo** aplica la recomendación al formulario. El servidor de OSRM se configura con `VALES_ROUTING_URL`.
- **Conciliación asistida.** Sugiere vales por tickets y exige el conjunto exacto y el total a dos decimales.
- **QR con estado actualizado.** La verificación pública consulta `GET /api/publico/vales/{uuid}` cada 3 segundos mientras la página está visible y el vale está emitido o autorizado. Al atenderlo, muestra **Usado** sin volver a escanearlo.
- **Reportes.** Gastos filtra por período y combustible y exporta el resultado en Excel y PDF.
- El navegador recuerda el menú y la vista del comparativo de gastos en `localStorage`. `sessionStorage` conserva los campos del borrador de emisión durante la sesión. El borrador excluye el DNI, el destino y las observaciones.
- TanStack Query reutiliza temporalmente las lecturas en memoria. Los cambios guardados actualizan las consultas afectadas y PostgreSQL valida cada operación. **Actualizar datos** fuerza una consulta nueva.
- En el teléfono se abre Vales en el navegador. La cámara del lector QR requiere HTTPS o localhost.

### Consulta de DNI

En **Sin contrato para tercero**, **Consultar** busca el DNI en el catálogo. Para un DNI nuevo, APIs Perú devuelve el nombre y los apellidos. Al confirmar el vale, Vales guarda el DNI y el nombre completo del tercero y los vincula con la emisión. En atención se verifica el DNI contra el tercero del vale.

Configura estas variables en el `.env` privado para ejecución local o en **Vales → Variables** del entorno de Railway. Spring Boot envía la consulta a APIs Perú con el token de tu cuenta y devuelve el nombre al formulario. Aplica la configuración con el despliegue de la versión que incluye la integración.

```properties
VALES_DNI_PROVIDER=apisperu
VALES_DNI_URL=https://dniruc.apisperu.com/api/v1
VALES_DNI_TOKEN=token_de_tu_cuenta
```

[Documentación de APIs Perú](https://dniruc.apisperu.com/doc) y [variables de Railway](https://docs.railway.com/variables).

Para pruebas aisladas, `VALES_DNI_PROVIDER=demo` habilita los DNI ficticios 99000001 y 99000002. Para usar Decolecta, configurar `VALES_DNI_PROVIDER=decolecta`, `VALES_DNI_URL=https://api.decolecta.com/v1/reniec` y el token de esa cuenta. [Documentación de Decolecta](https://decolecta.gitbook.io/docs/servicios/integrations-2)

## Comprobaciones

```powershell
# Compilar frontend y backend juntos
.\mvnw.cmd -f backend/pom.xml package

# Verificar límites entre módulos
node backend/src/test/arquitectura.mjs

# Probar frontend, con Node.js 24 instalado
cd frontend
npm ci
npm test
```

Las pruebas SQL están en `backend/src/test/sql/`. Para `reglas.sql` y la prueba HTTP, prepara una base nueva de pruebas con `instalar-demo.sql` o con el modo local. Inicia Vales en el puerto de pruebas `18085` con `VALES_DNI_PROVIDER=demo` y ejecuta `backend/src/test/api/flujo.mjs` con `VALES_DEMO_PASSWORD` en el entorno de la prueba.

## Guías

- [Uso y cuentas de prueba](docs/guia-proyecto.md)
- [Flujos de los servicios](docs/flujos-vales.md)
- [Base y datos de prueba](docs/base-datos-vales.md)
- [Relaciones de la base](docs/diagrama-base-datos.md)
