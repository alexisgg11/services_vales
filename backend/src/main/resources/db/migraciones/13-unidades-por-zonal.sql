BEGIN;

ALTER TABLE vales.unidad_maquinaria
    ADD COLUMN cod_zonal varchar(2) REFERENCES vales.zonal (id_zona);

-- Identificar únicamente las unidades conocidas de los datos de demostración.
UPDATE vales.unidad_maquinaria m SET cod_zonal = demo.zonal
FROM (VALUES ('DEM-101', '01'), ('DEM-105', '01'), ('DEM-106', '01'),
             ('DEM-202', '04'), ('DEM-303', '03'), ('DEM-404', '05')) AS demo(placa, zonal)
JOIN vales.zonal z ON z.id_zona = demo.zonal
WHERE m.placa = demo.placa;

CREATE TABLE vales.habilitacion_unidad (
    codigo_unidad integer REFERENCES vales.unidad_maquinaria (codigo),
    cod_zonal varchar(2) REFERENCES vales.zonal (id_zona),
    cod_centro_costo varchar(15) REFERENCES vales.centro_costo (cod_centro_costo),
    desde date,
    hasta date NOT NULL,
    habilitado_por integer NOT NULL REFERENCES vales.usuario (id_usuario),
    PRIMARY KEY (codigo_unidad, cod_zonal, cod_centro_costo, desde),
    CHECK (isfinite(desde) AND isfinite(hasta) AND desde <= hasta)
);

CREATE FUNCTION vales.validar_unidad_emision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    zonal_base text;
BEGIN
    SELECT cod_zonal INTO zonal_base FROM unidad_maquinaria
    WHERE codigo = NEW.codigo_unidad_movil FOR SHARE;
    IF zonal_base = NEW.cod_zonal THEN
        RETURN NEW;
    END IF;
    IF zonal_base IS NOT NULL THEN
        PERFORM 1 FROM habilitacion_unidad h
        WHERE h.codigo_unidad = NEW.codigo_unidad_movil AND h.cod_zonal = NEW.cod_zonal
          AND h.cod_centro_costo = NEW.cod_centrocosto AND NEW.fecha_emision BETWEEN h.desde AND h.hasta
        FOR SHARE;
        IF FOUND THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'La unidad móvil no está habilitada para la zonal, centro de costo y fecha de este vale.'
        USING ERRCODE = '22023';
END;
$$;

CREATE TRIGGER validar_unidad_emision
BEFORE INSERT ON vales.vales FOR EACH ROW
WHEN (NEW.codigo_unidad_movil IS NOT NULL)
EXECUTE FUNCTION vales.validar_unidad_emision();

CREATE FUNCTION vales.catalogo_unidades_emision(p_actor integer)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = pg_catalog, vales, pg_temp AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'codigo', m.codigo, 'placa', m.placa, 'descripcion', m.descripcion, 'cod_zonal', m.cod_zonal,
        'habilitaciones', h.lista
    ) ORDER BY m.placa), '[]'::jsonb)
    FROM usuario_rol r
    JOIN unidad_maquinaria m ON m.cod_zonal IS NOT NULL
    CROSS JOIN LATERAL (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'zonal', a.cod_zonal, 'centro', a.cod_centro_costo, 'desde', a.desde, 'hasta', a.hasta
        )), '[]'::jsonb) AS lista
        FROM habilitacion_unidad a
        WHERE a.codigo_unidad = m.codigo AND a.cod_zonal = r.cod_zonal
    ) h
    WHERE r.id_usuario = p_actor AND r.codigo_rol = 'OPERATIVO'
      AND (m.cod_zonal = r.cod_zonal OR h.lista <> '[]'::jsonb);
$$;

CREATE FUNCTION vales.unidades_administracion(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
BEGIN
    IF NOT tiene_rol(p_actor, 'ADMIN') THEN
        RAISE EXCEPTION 'Solo Administrador puede consultar la configuración de unidades.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
        'unidades', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.placa), '[]') FROM unidad_maquinaria m),
        'centros', (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.descripcion), '[]') FROM centro_costo c),
        'habilitaciones', (SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.desde DESC, h.codigo_unidad), '[]')
                           FROM habilitacion_unidad h)
    );
END;
$$;

CREATE FUNCTION vales.asignar_zonal_unidad(p_actor integer, p_unidad integer, p_zonal text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
BEGIN
    PERFORM bloquear_administracion(p_actor);
    IF NOT EXISTS (SELECT 1 FROM zonal WHERE id_zona = p_zonal) THEN
        RAISE EXCEPTION 'Selecciona una zonal base válida.' USING ERRCODE = '22023';
    END IF;
    UPDATE unidad_maquinaria SET cod_zonal = p_zonal WHERE codigo = p_unidad;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selecciona una unidad móvil válida.' USING ERRCODE = '22023';
    END IF;
END;
$$;

CREATE FUNCTION vales.habilitar_unidad(p_actor integer, p_unidad integer, p_zonal text,
                                      p_centro text, p_desde date, p_hasta date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
BEGIN
    PERFORM bloquear_administracion(p_actor);
    IF NOT EXISTS (SELECT 1 FROM unidad_maquinaria WHERE codigo = p_unidad AND cod_zonal <> p_zonal)
       OR NOT EXISTS (SELECT 1 FROM zonal WHERE id_zona = p_zonal)
       OR NOT EXISTS (SELECT 1 FROM centro_costo WHERE cod_centro_costo = p_centro) THEN
        RAISE EXCEPTION 'Selecciona una unidad con zonal base, otra zonal y un centro de costo válido.'
            USING ERRCODE = '22023';
    END IF;
    IF p_desde IS NULL OR p_hasta IS NULL OR NOT isfinite(p_desde) OR NOT isfinite(p_hasta) OR p_desde > p_hasta THEN
        RAISE EXCEPTION 'Indica un rango de fechas válido para la habilitación.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO habilitacion_unidad (codigo_unidad, cod_zonal, cod_centro_costo, desde, hasta, habilitado_por)
    VALUES (p_unidad, p_zonal, p_centro, p_desde, p_hasta, p_actor)
    ON CONFLICT (codigo_unidad, cod_zonal, cod_centro_costo, desde) DO UPDATE
    SET hasta = excluded.hasta, habilitado_por = excluded.habilitado_por;
END;
$$;

REVOKE ALL ON FUNCTION vales.validar_unidad_emision(), vales.catalogo_unidades_emision(integer),
    vales.unidades_administracion(integer), vales.asignar_zonal_unidad(integer, integer, text),
    vales.habilitar_unidad(integer, integer, text, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.unidades_administracion(integer), vales.asignar_zonal_unidad(integer, integer, text),
    vales.habilitar_unidad(integer, integer, text, text, date, date) TO vales_app;

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
            SELECT jsonb_agg(to_jsonb(f) || jsonb_build_object('codigo_factura', f.codigo_factura::text)
                             ORDER BY f.fecha_emision DESC, f.codigo_factura)
            FROM proveedor g CROSS JOIN LATERAL listar_facturas_disponibles(p_actor, g.cod_proveedor) f
        ) END
    )
    FROM usuario u JOIN trabajador t USING (id_trabajador) JOIN persona p ON p.dni = t.dni
    WHERE u.id_usuario = p_actor AND u.activo;
$$;

COMMIT;
