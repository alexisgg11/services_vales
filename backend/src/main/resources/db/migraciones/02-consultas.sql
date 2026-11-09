-- Aplicar después del esquema consolidado y sus actualizaciones.
BEGIN;

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
            'unidad', t.cod_uni_organizativa, 'centro', t.cod_centro_costo,
            'maquinaria', t.codigo_unidad_movil
        ),
        'zonales', (SELECT jsonb_agg(to_jsonb(z) ORDER BY z.nom_zona) FROM zonal z),
        'localidades', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.nom_localidad) FROM localidad l),
        'proveedores', (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.razon_social) FROM proveedor g),
        'suministros', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.descripcion) FROM suministro s),
        'maquinaria', (
            SELECT jsonb_agg(to_jsonb(m) ORDER BY m.placa)
            FROM unidad_maquinaria m WHERE m.codigo = t.codigo_unidad_movil OR EXISTS (
                SELECT 1 FROM usuario_rol ur WHERE ur.id_usuario = p_actor AND ur.codigo_rol = 'OPERATIVO'
            )
        ),
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
                'fin', c.fecha_fin, 'saldo', c.monto_disponible, 'precios', (
                    SELECT jsonb_object_agg(s.id_suministro, s.precio_pactado)
                    FROM contrato_suministro s WHERE s.cod_contrato = c.cod_contrato
                )
            ) ORDER BY c.fecha_inicio, c.cod_contrato)
            FROM contrato_vale c WHERE c.activo
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
            SELECT jsonb_agg(to_jsonb(f) || jsonb_build_object('codigo_factura', f.codigo_factura::text)
                             ORDER BY f.fecha_emision DESC, f.codigo_factura)
            FROM proveedor g CROSS JOIN LATERAL listar_facturas_disponibles(p_actor, g.cod_proveedor) f
        ) END
    )
    FROM usuario u JOIN trabajador t USING (id_trabajador) JOIN persona p ON p.dni = t.dni
    WHERE u.id_usuario = p_actor AND u.activo;
$$;

CREATE OR REPLACE FUNCTION vales.listar_documentos_aplicacion(p_actor integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT coalesce(jsonb_agg(
        (consultar_pdf_vale(p_actor, v.cod_zonal, v.codigo_vale) -
            CASE WHEN tiene_rol(p_actor, 'GRIFO', v.cod_zonal, v.cod_proveedor)
                 THEN 'dni_trabajador' ELSE '' END) ||
        jsonb_build_object(
            'id_vale', v.id_vale::text, 'codigo_factura', v.codigo_factura::text,
            'factura_numero', CASE WHEN f.codigo_factura IS NOT NULL THEN f.serie || '-' || f.numero END
        )
        ORDER BY v.fecha_emision DESC, v.id_vale DESC
    ), '[]'::jsonb)
    FROM listar_vales(p_actor) v
    LEFT JOIN factura f USING (codigo_factura);
$$;

CREATE OR REPLACE FUNCTION vales.tercero_aplicacion(p_actor integer, p_documento text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT t.codigo_tercero FROM tercero t
    WHERE t.documento = btrim(p_documento)
      AND EXISTS (
          SELECT 1 FROM usuario_rol ur
          WHERE ur.id_usuario = p_actor AND ur.codigo_rol = 'OPERATIVO'
            AND tiene_rol(p_actor, 'OPERATIVO', ur.cod_zonal)
      );
$$;

REVOKE ALL ON FUNCTION vales.contexto_aplicacion(integer),
    vales.listar_documentos_aplicacion(integer), vales.tercero_aplicacion(integer, text) FROM PUBLIC;
COMMIT;
