# Spring Boot

## Variables de ejecución

| Variable opcional | Uso |
| --- | --- |
| `VALES_PG_BIN` | Carpeta `bin` de PostgreSQL si la instalación está en otra ruta. |
| `VALES_LOCAL_DIR` | Directorio de datos locales alternativo. |
| `VALES_DEMO_PASSWORD` | Clave inicial de las cuentas de prueba. En modo local, Vales genera `demo.clave` si se omite. |
| `VALES_PORT` | Puerto HTTP fijo. Si se omite, se prefiere 8080 y se usa otro disponible si está ocupado. |
| `VALES_BIND_ADDRESS` | Dirección de escucha HTTP. En local, el valor inicial es `127.0.0.1`. |
| `VALES_PUBLIC_BASE_URL` | Origen HTTP o HTTPS que se escribe en los QR. En local usa el puerto del servidor. |

## Pruebas SQL

El archivo [reglas.sql](src/test/sql/reglas.sql) verifica los servicios y revierte sus cambios. Se ejecuta como propietario en una base de pruebas preparada con `instalar-demo.sql`. [Instalación de la base de demostración](../docs/base-datos-vales.md#instalar-una-base-de-demostración-en-postgresql-5432)

[Instalación local](../README.md#instalación-local-en-windows)
