# Services Vales

## Instalación local en Windows

1. Instalar **JDK 17 o superior**, **PostgreSQL 18** y **VS Code** con la extensión **Extension Pack for Java**. PostgreSQL debe incluir sus herramientas de línea de comandos.
2. Clonar o descargar el repositorio y abrir su carpeta raíz en VS Code. Si aparece **Modo restringido**, habilitar la confianza del espacio de trabajo.
3. En **Ejecutar y depurar**, seleccionar **Ejecutar Services Vales** y pulsar **▶**. En un clon nuevo, VS Code crea el archivo obligatorio `.env` desde `.env.example`. La primera ejecución necesita Internet para resolver las dependencias de Maven. Vales prepara su propia base de datos local automáticamente.
4. En el navegador, abrir [Vales en la PC](http://127.0.0.1:8080) o usar la dirección que muestra VS Code. Para probar, iniciar sesión con `demo.operativo.piura` y la contraseña `demo`. Para detener Vales, pulsar **Shift + F5**.

Si PostgreSQL está instalado en otra ruta, `VALES_PG_BIN` debe apuntar a su carpeta `bin`. Si el puerto web 8080 está ocupado, se puede cambiar `VALES_PORT` en `.vscode/launch.json`.

**Base de datos.** `.env` define el modo de conexión. En modo `local`, una instalación nueva carga 178 vales, 77 facturas y las cuentas de prueba. En modo `externa`, Vales usa la instancia PostgreSQL configurada. Los cambios se conservan entre arranques. [Datos incluidos, pgAdmin y configuración de conexión](docs/base-datos-vales.md)

Git excluye el `.env` privado, los archivos de ejecución de `.local/`, el material original de clase y las notas internas. El repositorio incluye `.env.example` y la copia SQL de prueba.

**Celular.** La consulta por QR y el escaneo con cámara funcionan desde la misma red Wi-Fi que la PC, mientras Vales está en ejecución. Para habilitar la cámara se configura HTTPS una sola vez. [Configuración de HTTPS en la red local](docs/guia-proyecto.md#https-en-la-red-local)

## Qué hace Vales

Vales gestiona el combustible que la empresa solicita a sus grifos proveedores. El operativo emite el vale, Jefatura autoriza, el grifo registra el despacho y Contabilidad concilia la factura y consulta los gastos.

| Servicio | Perfil que lo usa |
| --- | --- |
| Registrar vale y Anular vale | Operativo |
| Autorizar vales | Jefatura de la zonal |
| Registrar atención | Cuenta del grifo y zonal asignados |
| Asociar factura y Consultar gastos | Contabilidad |
| PDF del vale | Cuentas con permiso sobre el vale |

**Stack.** Spring Boot y Spring Security sirven el frontend HTML, CSS y JavaScript y controlan la sesión. JDBC conecta PostgreSQL, donde se guardan los registros y se aplican las reglas de negocio. Maven Wrapper empaqueta ambas partes. El visor y el escáner usan las bibliotecas incluidas en el proyecto.

- [Guía de uso, cuentas y casos de prueba](docs/guia-proyecto.md)
- [Diagramas de los siete servicios](docs/flujos-vales.md)
- [Diagrama de la base de datos](docs/diagrama-base-datos.md)
