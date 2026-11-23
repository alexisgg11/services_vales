BEGIN;

-- Las facturas de prueba pueden presentar el mismo ticket con totales distintos.
-- El vale solo puede quedar asociado una vez, mediante asociar_factura.
ALTER TABLE vales.factura_ticket DROP CONSTRAINT factura_ticket_cod_proveedor_ticket_key;

WITH ejemplos(proveedor, serie, numeros, observaciones) AS (
    VALUES
        ('20000000001', 'F001', ARRAY['000100','000101'],
            ARRAY['Demo: atención de 15 galones','Demo: precio corregido y redondeo']),
        ('20000000002', 'F002', ARRAY['000100'], ARRAY['Demo: usado de otro grifo']),
        ('20000000001', 'V001', ARRAY['000001','000002'], ARRAY['Ejemplo Algarrobos: usado sin factura']),
        ('20000000006', 'V002', ARRAY['000001','000002'], ARRAY['Ejemplo Miraflores: usado sin factura']),
        ('20000000006', 'V003', ARRAY['000001','000002'], ARRAY['Ejemplo Miraflores con Rosa: usado sin factura']),
        ('20000000002', 'V004', ARRAY['000001','000002'], ARRAY['Ejemplo Santa Elena: usado sin factura']),
        ('20000000004', 'V005', ARRAY['000001','000002'], ARRAY['Ejemplo Puerto Paita: usado sin factura']),
        ('20000000005', 'V006', ARRAY['000001','000002'], ARRAY['Ejemplo Costa Talara: usado sin factura'])
), historicos(proveedor, serie, zona) AS (
    VALUES ('20000000001','H001','piura'), ('20000000002','H002','sullana'),
           ('20000000004','H003','paita'), ('20000000005','H004','talara')
), respaldo AS (
    SELECT f.codigo_factura, f.cod_proveedor, v.ticket
    FROM ejemplos e
    JOIN vales.factura f ON f.cod_proveedor = e.proveedor AND f.serie = e.serie AND f.numero = ANY(e.numeros)
    JOIN vales.vales v ON v.cod_proveedor = e.proveedor AND v.observacion = ANY(e.observaciones)
    WHERE f.asociado_por IS NULL AND v.ticket IS NOT NULL
    UNION ALL
    SELECT f.codigo_factura, f.cod_proveedor, v.ticket
    FROM historicos h
    JOIN vales.factura f ON f.cod_proveedor = h.proveedor AND f.serie = h.serie AND f.numero ~ '^[0-9]{6}0[23]$'
    JOIN vales.vales v ON v.cod_proveedor = h.proveedor AND v.observacion =
        format('Historial %s-%s %s: Apoyo a cuadrilla', left(f.numero, 4), substring(f.numero, 5, 2), h.zona)
    WHERE f.asociado_por IS NULL AND v.ticket IS NOT NULL
)
INSERT INTO vales.factura_ticket (codigo_factura, cod_proveedor, ticket)
SELECT r.codigo_factura, r.cod_proveedor, r.ticket
FROM respaldo r
WHERE NOT EXISTS (SELECT 1 FROM vales.factura_ticket t WHERE t.codigo_factura = r.codigo_factura);

DROP FUNCTION vales.asociar_factura_con_tickets(integer, bigint, text[], text, text);
DROP FUNCTION vales.validar_tickets_factura(integer, bigint, text[]);

CREATE FUNCTION vales.asociar_factura_desde_vales(p_actor integer, p_factura bigint, p_ids bigint[])
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    documento factura;
    tickets_factura varchar[];
    tickets_vales varchar[];
BEGIN
    IF NOT tiene_rol(p_actor, 'CONTABILIDAD') THEN
        RAISE EXCEPTION 'Solo Contabilidad puede asociar facturas.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO documento FROM factura WHERE codigo_factura = p_factura AND asociado_por IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La factura no existe o su asociación ya está cerrada.' USING ERRCODE = 'P0001';
    END IF;

    SELECT array_agg(t.ticket ORDER BY t.ticket) INTO tickets_factura
    FROM factura_ticket t WHERE t.codigo_factura = p_factura;
    IF tickets_factura IS NULL THEN
        RAISE EXCEPTION 'La factura todavía no tiene tickets registrados por el grifo.' USING ERRCODE = 'P0001';
    END IF;

    SELECT array_agg(v.ticket ORDER BY v.ticket) INTO tickets_vales
    FROM bloquear_vales(p_ids) v;
    IF tickets_factura IS DISTINCT FROM tickets_vales THEN
        RAISE EXCEPTION 'Los tickets de los vales seleccionados no coinciden con los de la factura.' USING ERRCODE = 'P0001';
    END IF;

    RETURN (asociar_factura(p_actor, p_factura, p_ids)).codigo_factura;
END;
$$;

REVOKE ALL ON FUNCTION vales.asociar_factura_desde_vales(integer, bigint, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.asociar_factura_desde_vales(integer, bigint, bigint[]) TO vales_app;

CREATE OR REPLACE FUNCTION vales.contexto_aplicacion(p_actor integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT jsonb_build_object(
        'actor', u.id_usuario,
        'nombre', concat_ws(' ', p.nombre, p.ap_paterno, p.ap_materno),
        'roles', coalesce((
            SELECT jsonb_agg(to_jsonb(ur) - 'id_usuario' ORDER BY ur.codigo_rol)
            FROM usuario_rol ur WHERE ur.id_usuario = u.id_usuario
        ), '[]'::jsonb),
        'trabajador', jsonb_build_object(
            'dni', p.dni, 'zonal', t.cod_zonal, 'localidad', t.cod_localidad,
            'unidad', t.cod_uni_organizativa, 'centro', t.cod_centro_costo
        ),
        'zonales', (SELECT jsonb_agg(to_jsonb(z) ORDER BY z.nom_zona) FROM zonal z),
        'localidades', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.nom_localidad) FROM localidad l),
        'proveedores', (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.razon_social) FROM proveedor g),
        'suministros', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.descripcion) FROM suministro s),
        'maquinaria', catalogo_unidades_emision(p_actor),
        'unidad', (SELECT descripcion FROM unidad_organizativa WHERE cod_uni_organizativa = t.cod_uni_organizativa),
        'centros', (
            SELECT jsonb_agg(to_jsonb(c) ORDER BY c.descripcion)
            FROM asignacion_costo a JOIN centro_costo c USING (cod_centro_costo)
            WHERE a.cod_uni_organizativa = t.cod_uni_organizativa
        ),
        'contratos', CASE WHEN EXISTS (SELECT 1 FROM usuario_rol ur
            WHERE ur.id_usuario = p_actor AND ur.codigo_rol = 'OPERATIVO') THEN (
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.cod_contrato, 'proveedor', c.ruc, 'inicio', c.fecha_inicio,
                'fin', c.fecha_fin, 'activo', c.activo, 'saldo', c.monto_disponible, 'precios', (
                    SELECT jsonb_object_agg(s.id_suministro, s.precio_pactado)
                    FROM contrato_suministro s WHERE s.cod_contrato = c.cod_contrato
                )
            ) ORDER BY c.fecha_inicio, c.cod_contrato)
            FROM contrato_vale c
        ) END,
        'tarifas', CASE WHEN EXISTS (SELECT 1 FROM usuario_rol ur
            WHERE ur.id_usuario = p_actor AND ur.codigo_rol = 'OPERATIVO') THEN (
            SELECT jsonb_agg(jsonb_build_object(
                'proveedor', a.cod_proveedor, 'suministro', a.id_suministro,
                'inicio', a.vigente_desde, 'precio', a.precio
            ) ORDER BY a.vigente_desde)
            FROM tarifa a
        ) END,
        'facturas', CASE WHEN tiene_rol(p_actor, 'CONTABILIDAD') THEN (
            SELECT jsonb_agg(to_jsonb(f) || jsonb_build_object(
                'codigo_factura', f.codigo_factura::text,
                'tickets', coalesce((SELECT jsonb_agg(t.ticket ORDER BY t.ticket)
                                     FROM factura_ticket t WHERE t.codigo_factura = f.codigo_factura), '[]')
            ) ORDER BY f.fecha_emision DESC, f.codigo_factura)
            FROM proveedor g CROSS JOIN LATERAL listar_facturas_disponibles(p_actor, g.cod_proveedor) f
        ) END
    )
    FROM usuario u JOIN trabajador t USING (id_trabajador) JOIN persona p ON p.dni = t.dni
    WHERE u.id_usuario = p_actor AND u.activo;
$$;

COMMIT;
