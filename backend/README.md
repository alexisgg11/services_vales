# Spring Boot

El perfil **Ejecutar Services Vales** de VS Code compila con Maven Wrapper, ejecuta Spring Boot en modo normal y abre la dirección que anuncia el servidor. [Instalación local](../README.md#instalación-local-en-windows)

## Arranque local

El arranque lee el archivo obligatorio `.env` desde la raíz. Con `VALES_DB_MODE=local`, la aplicación detecta PostgreSQL, arranca un clúster privado y carga las migraciones y los datos de prueba en una base nueva. El clúster usa un puerto local, credenciales aleatorias y un rol con permisos limitados. Los datos quedan en `.local/postgres`.

| Variable opcional | Uso |
| --- | --- |
| `VALES_PG_BIN` | Carpeta `bin` de PostgreSQL si la instalación está en otra ruta. |
| `VALES_LOCAL_DIR` | Directorio de datos locales alternativo. |
| `VALES_PORT` | Puerto HTTP fijo. Si se omite, se prefiere 8080 y se usa otro disponible si está ocupado. |
| `VALES_BIND_ADDRESS` | Dirección de escucha HTTP. En local, el valor inicial es `127.0.0.1`. |
| `VALES_PUBLIC_BASE_URL` | Origen HTTP o HTTPS que se escribe en los QR. En local usa el puerto del servidor. |

Con `VALES_HTTPS_ENABLED=true` en `.env`, `HttpsRedLocal` lee la IPv4 privada, obtiene el certificado mediante DNS y configura Spring Boot para escuchar en esa interfaz. Los PDF y el inicio automático de VS Code usan el subdominio HTTPS. [Activar HTTPS en la red local](../docs/guia-proyecto.md#https-en-la-red-local)

Dentro de la red local, la ficha del QR tiene un endpoint separado que entrega los datos básicos sin sesión. El documento y las operaciones requieren una cuenta con los permisos correspondientes.

Con `VALES_DB_MODE=externa`, Vales toma la conexión de `VALES_DB_URL`, `VALES_DB_USER` y `VALES_DB_PASSWORD` en `.env`. Spring Boot abre y cierra el grupo de conexiones JDBC. [Guía para PostgreSQL 5432](../docs/base-datos-vales.md#cargar-la-copia-en-postgresql-5432)

## Pruebas y QR

Las cuentas ficticias permiten repetir el flujo por zonal. Para probar desde la misma PC, se carga una imagen del QR del PDF en **Registrar atención → Escanear QR → Leer imagen**. [Cuentas de prueba](../docs/guia-proyecto.md#cuentas-de-prueba)

El perfil de VS Code abre Vales en la PC por defecto. Tras activar HTTPS, también se puede abrir desde un celular de la misma red. **Leer imagen** permite usar una foto guardada. La vista en vivo se ofrece cuando el navegador permite acceder a la cámara.

El archivo [reglas.sql](src/test/sql/reglas.sql) verifica los servicios y revierte sus cambios. Se ejecuta como propietario en una base preparada con `instalar-demo.sql -v datos_relativos=1`. [Carga de ejemplos con fechas relativas](../docs/base-datos-vales.md#cargar-la-copia-en-postgresql-5432)
