-- Ejecutar como propietario del esquema. Crear antes el rol de conexión vales_app.
BEGIN;
GRANT USAGE ON SCHEMA vales TO vales_app;
GRANT SELECT (id_usuario, login, clave_hash, activo) ON vales.usuario TO vales_app;
GRANT EXECUTE ON FUNCTION
    vales.contexto_aplicacion(integer),
    vales.listar_documentos_aplicacion(integer),
    vales.tercero_aplicacion(integer, text),
    vales.listar_vales(integer, text, text, integer),
    vales.consultar_vale_qr(integer, uuid),
    vales.registrar_vale(integer, text, text, text, numeric, text, integer, text, date, text, integer, text),
    vales.autorizar_vales(integer, bigint[]),
    vales.sugerir_precio_atencion(integer, bigint, date),
    vales.registrar_atencion(integer, bigint, date, numeric, numeric, numeric, text, boolean),
    vales.asociar_factura(integer, bigint, bigint[]),
    vales.anular_vale(integer, bigint, text),
    vales.consultar_gastos(integer, date)
TO vales_app;
COMMIT;
