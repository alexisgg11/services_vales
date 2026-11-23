\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = vales, pg_catalog;

SELECT e.descripcion AS estado, count(v.id_vale) AS vales
FROM estado_vale e LEFT JOIN vales v ON v.estado_vale = e.codigo
GROUP BY e.codigo, e.descripcion ORDER BY e.codigo;

WITH saldo_por_contrato AS (
    SELECT nrocontrato, sum(CASE estado_vale
        WHEN 0 THEN importe_estimado WHEN 1 THEN importe_estimado WHEN 3 THEN importe ELSE 0
    END) AS comprometido
    FROM vales WHERE nrocontrato IS NOT NULL GROUP BY nrocontrato
), vales_por_factura AS (
    SELECT codigo_factura, count(*) AS cantidad, sum(importe) AS total,
           max(registrado_atencion_en) AS ultima_atencion
    FROM vales WHERE codigo_factura IS NOT NULL GROUP BY codigo_factura
), respaldo_por_factura AS (
    SELECT t.codigo_factura, count(*) AS cantidad, sum(v.importe) AS total,
           count(*) FILTER (WHERE v.codigo_factura IS DISTINCT FROM t.codigo_factura) AS sin_asociar,
           count(*) FILTER (WHERE v.codigo_factura <> t.codigo_factura) AS asociados_a_otra
    FROM factura_ticket t JOIN vales v USING (cod_proveedor, ticket)
    GROUP BY t.codigo_factura
), historial_esperado AS (
    SELECT id_vale, 'EMISION' AS accion, registrado_por AS id_usuario, registrado_en AS fecha FROM vales
    UNION ALL
    SELECT id_vale, 'AUTORIZACION', autorizado_por, fecha_autorizacion FROM vales WHERE autorizado_por IS NOT NULL
    UNION ALL
    SELECT id_vale, 'ATENCION', atendido_por, registrado_atencion_en FROM vales WHERE estado_vale = 3
    UNION ALL
    SELECT v.id_vale, 'FACTURA', f.asociado_por, f.fecha_asociacion FROM vales v JOIN factura f USING (codigo_factura)
    UNION ALL
    SELECT id_vale, 'ANULACION', anulado_por, fecha_anulacion FROM vales WHERE estado_vale = 4
)
SELECT
    (SELECT count(*) FROM vales) AS vales,
    (SELECT count(*) FROM factura) AS facturas,
    (SELECT count(*) FROM historial_vale) AS eventos,
    (SELECT count(*) FROM historial_esperado e FULL JOIN historial_vale h USING (id_vale, accion)
        WHERE (e.id_usuario, e.fecha) IS DISTINCT FROM (h.id_usuario, h.fecha)) AS diferencias_historial,
    (SELECT count(*) FROM vales WHERE fecha_autorizacion < registrado_en
        OR registrado_atencion_en < fecha_autorizacion
        OR fecha_anulacion < coalesce(fecha_autorizacion, registrado_en)) AS diferencias_orden,
    (SELECT count(*) FROM vales WHERE cantidad_consumida > cantidad_emitida) AS consumos_excedidos,
    (SELECT count(*) FROM contrato_vale c LEFT JOIN saldo_por_contrato s ON s.nrocontrato = c.cod_contrato
        WHERE c.monto_comprometido <> coalesce(s.comprometido, 0)) AS diferencias_contrato,
    (SELECT count(*) FROM factura f LEFT JOIN vales_por_factura v USING (codigo_factura)
        WHERE (f.asociado_por IS NOT NULL AND (f.total IS DISTINCT FROM v.total OR f.fecha_asociacion < v.ultima_atencion))
           OR (f.asociado_por IS NULL AND v.cantidad > 0)) AS diferencias_asociacion,
    (SELECT count(*) FROM factura f JOIN respaldo_por_factura r USING (codigo_factura)
        JOIN vales_por_factura v USING (codigo_factura)
        WHERE f.asociado_por IS NOT NULL AND (r.sin_asociar > 0 OR r.cantidad <> v.cantidad)) AS diferencias_respaldo,
    (SELECT count(*) FROM factura f LEFT JOIN respaldo_por_factura r USING (codigo_factura)
        WHERE f.asociado_por IS NULL AND (r.total IS DISTINCT FROM f.total OR r.asociados_a_otra > 0)) AS pendientes_por_revisar;

ROLLBACK;
