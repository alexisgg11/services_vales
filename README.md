# Services Vales

## Instalación local en Windows

1. Instalar **JDK 17 o superior**, **PostgreSQL 18** y **VS Code** con la extensión **Extension Pack for Java**. PostgreSQL debe incluir sus herramientas de línea de comandos.
2. Clonar o descargar el repositorio y abrir su carpeta raíz en VS Code. Si aparece **Modo restringido**, habilitar la confianza del espacio de trabajo.
3. En **Ejecutar y depurar**, seleccionar **Ejecutar Services Vales** y pulsar **▶**. En el primer arranque, VS Code crea `.env` desde `.env.example` y Vales carga los datos de prueba. Maven necesita Internet para descargar las dependencias.
4. En el navegador, abrir [Vales en la PC](http://127.0.0.1:8080) o usar la dirección que muestra VS Code. Para probar, iniciar sesión con `demo.operativo.piura` y la contraseña `demo`. Para detener Vales, pulsar **Shift + F5**.

Si PostgreSQL está instalado en otra ruta, `VALES_PG_BIN` debe apuntar a su carpeta `bin`. Si el puerto web 8080 está ocupado, se puede cambiar `VALES_PORT` en `.vscode/launch.json`.

Vales gestiona la emisión, autorización, atención y facturación de vales de combustible. Usa Java con Spring Boot, PostgreSQL y un frontend en HTML, CSS y JavaScript.

## Guías

- [Guía de uso, cuentas y casos de prueba](docs/guia-proyecto.md)
- [Diagramas de los siete servicios](docs/flujos-vales.md)
- [Datos de prueba y configuración de PostgreSQL](docs/base-datos-vales.md)
- [Escaneo QR desde el celular](docs/guia-proyecto.md#https-en-la-red-local)
- [Diagrama de la base de datos](docs/diagrama-base-datos.md)
