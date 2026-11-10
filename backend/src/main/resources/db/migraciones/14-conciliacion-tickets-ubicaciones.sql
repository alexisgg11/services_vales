BEGIN;

ALTER TABLE vales.centro_costo
    ADD COLUMN cod_localidad varchar(2) REFERENCES vales.localidad (id_localidad),
    ADD COLUMN ubicacion_referencia text;

-- Separar las ubicaciones que el catálogo anterior indicaba explícitamente.
WITH ubicaciones AS (
    SELECT c.cod_centro_costo, partes[1] AS nombre, btrim(partes[2]) AS referencia
    FROM vales.centro_costo c
    CROSS JOIN LATERAL regexp_match(c.descripcion, '^(.*?)\s+UBICAD[OA]\s*:\s*(.+)$', 'i') AS partes
), identificadas AS (
    SELECT u.*, (SELECT min(l.id_localidad) FROM vales.localidad l
                 WHERE upper(l.nom_localidad) = upper(u.referencia) HAVING count(*) = 1) AS localidad
    FROM ubicaciones u
    WHERE btrim(u.nombre) <> '' AND u.referencia <> ''
)
UPDATE vales.centro_costo c
SET descripcion = btrim(i.nombre), cod_localidad = i.localidad,
    ubicacion_referencia = CASE WHEN i.localidad IS NULL THEN i.referencia END
FROM identificadas i WHERE c.cod_centro_costo = i.cod_centro_costo;

-- Retirar el sufijo solo cuando coincide con la zonal base ya registrada.
UPDATE vales.unidad_maquinaria m
SET descripcion = btrim(left(btrim(m.descripcion), length(btrim(m.descripcion)) - length(z.nom_zona) - 1))
FROM vales.zonal z
WHERE z.id_zona = m.cod_zonal
  AND length(btrim(m.descripcion)) > length(z.nom_zona) + 1
  AND right(upper(btrim(m.descripcion)), length(z.nom_zona) + 1) = ' ' || upper(z.nom_zona);

ALTER TABLE vales.factura
    ADD COLUMN origen_tickets varchar(7) CHECK (origen_tickets IN ('FACTURA', 'ANEXO')),
    ADD COLUMN referencia_anexo varchar(150),
    ADD CONSTRAINT factura_respaldo_tickets_check CHECK (
        CASE WHEN origen_tickets = 'ANEXO' THEN nullif(btrim(referencia_anexo), '') IS NOT NULL
             ELSE referencia_anexo IS NULL END
    );

CREATE TABLE vales.factura_ticket (
    codigo_factura bigint,
    cod_proveedor varchar(11) NOT NULL,
    ticket varchar(15),
    PRIMARY KEY (codigo_factura, ticket),
    UNIQUE (cod_proveedor, ticket),
    FOREIGN KEY (codigo_factura, cod_proveedor) REFERENCES vales.factura (codigo_factura, cod_proveedor),
    FOREIGN KEY (cod_proveedor, ticket) REFERENCES vales.vales (cod_proveedor, ticket)
);

CREATE FUNCTION vales.validar_tickets_factura(p_actor integer, p_factura bigint, p_tickets text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    documento factura;
BEGIN
    IF NOT tiene_rol(p_actor, 'CONTABILIDAD') THEN
        RAISE EXCEPTION 'Solo Contabilidad puede validar los tickets de una factura.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO documento FROM factura WHERE codigo_factura = p_factura AND asociado_por IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La factura no existe o su asociación ya está cerrada.' USING ERRCODE = 'P0001';
    END IF;

    IF coalesce(cardinality(p_tickets), 0) = 0 OR EXISTS (
        SELECT 1 FROM unnest(p_tickets) t(numero)
        WHERE numero IS NULL OR length(btrim(numero)) NOT BETWEEN 1 AND 15
    ) THEN
        RAISE EXCEPTION 'Ingresa los números de ticket del respaldo, con un máximo de 15 caracteres por ticket.'
            USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(DISTINCT btrim(numero)) FROM unnest(p_tickets) t(numero)) <> cardinality(p_tickets) THEN
        RAISE EXCEPTION 'La lista del respaldo contiene tickets repetidos.' USING ERRCODE = '22023';
    END IF;

    RETURN (
        WITH detalle AS (
            SELECT t.orden, btrim(t.numero) AS ticket, v.id_vale::text AS id_vale,
                   v.codigo_vale, v.importe, CASE
                       WHEN v.id_vale IS NULL THEN 'NO_ENCONTRADO'
                       WHEN v.codigo_factura IS NOT NULL THEN 'FACTURADO'
                       WHEN v.estado_vale <> 3 THEN 'NO_ATENDIDO'
                       ELSE 'VALIDO'
                   END AS estado
            FROM unnest(p_tickets) WITH ORDINALITY t(numero, orden)
            LEFT JOIN vales v ON v.cod_proveedor = documento.cod_proveedor AND v.ticket = btrim(t.numero)
        ), resumen AS (
            SELECT jsonb_agg(to_jsonb(d) - 'orden' ORDER BY orden) AS tickets,
                   coalesce(sum(importe) FILTER (WHERE estado = 'VALIDO'), 0) AS total,
                   bool_and(estado = 'VALIDO') AS todos_validos
            FROM detalle d
        )
        SELECT jsonb_build_object('tickets', tickets, 'total_vales', total, 'total_factura', documento.total,
            'todos_validos', todos_validos, 'coincide', todos_validos AND total = documento.total)
        FROM resumen
    );
END;
$$;

CREATE FUNCTION vales.asociar_factura_con_tickets(p_actor integer, p_factura bigint, p_tickets text[],
                                                 p_origen text, p_referencia text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    resultado jsonb;
    documento factura;
    ids bigint[];
    referencia text := nullif(btrim(p_referencia), '');
BEGIN
    IF NOT tiene_rol(p_actor, 'CONTABILIDAD') THEN
        RAISE EXCEPTION 'Solo Contabilidad puede asociar facturas.' USING ERRCODE = '42501';
    END IF;
    IF p_origen IS NULL OR p_origen NOT IN ('FACTURA', 'ANEXO')
       OR (p_origen = 'ANEXO' AND (referencia IS NULL OR length(referencia) > 150)) THEN
        RAISE EXCEPTION 'Indica el origen de los tickets y la referencia si proceden de un anexo.'
            USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM factura WHERE codigo_factura = p_factura AND asociado_por IS NULL FOR UPDATE;
    resultado := validar_tickets_factura(p_actor, p_factura, p_tickets);
    IF NOT (resultado->>'todos_validos')::boolean THEN
        RAISE EXCEPTION 'Hay tickets sin un vale atendido y disponible en este grifo.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT (resultado->>'coincide')::boolean THEN
        RAISE EXCEPTION 'Los importes de los tickets y la factura no coinciden.' USING ERRCODE = 'P0001';
    END IF;

    SELECT array_agg((t->>'id_vale')::bigint) INTO ids FROM jsonb_array_elements(resultado->'tickets') t;
    documento := asociar_factura(p_actor, p_factura, ids);

    UPDATE factura SET origen_tickets = p_origen,
        referencia_anexo = CASE WHEN p_origen = 'ANEXO' THEN referencia END
    WHERE codigo_factura = p_factura;
    INSERT INTO factura_ticket (codigo_factura, cod_proveedor, ticket)
    SELECT p_factura, documento.cod_proveedor, t->>'ticket' FROM jsonb_array_elements(resultado->'tickets') t;

    RETURN p_factura;
END;
$$;

-- La función anterior queda como implementación interna. Las nuevas asociaciones pasan por los tickets.
REVOKE EXECUTE ON FUNCTION vales.asociar_factura(integer, bigint, bigint[]) FROM PUBLIC, vales_app;
REVOKE ALL ON FUNCTION vales.validar_tickets_factura(integer, bigint, text[]),
    vales.asociar_factura_con_tickets(integer, bigint, text[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vales.validar_tickets_factura(integer, bigint, text[]),
    vales.asociar_factura_con_tickets(integer, bigint, text[], text, text) TO vales_app;

CREATE OR REPLACE FUNCTION vales.consultar_pdf_vale(p_actor integer, p_zonal text, p_codigo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    documento jsonb;
BEGIN
    SELECT to_jsonb(v) || jsonb_build_object(
        'estado', e.descripcion,
        'zonal', z.nom_zona, 'localidad', l.nom_localidad, 'grifo', p.razon_social,
        'suministro', s.descripcion, 'unidad_medida', s.unidad_medida,
        'trabajador', concat_ws(' ', pt.nombre, pt.ap_paterno, pt.ap_materno),
        'dni_trabajador', pt.dni,
        'tercero', t.nombre, 'documento_tercero', t.documento,
        'unidad_organizativa', o.descripcion, 'centro_costo', c.descripcion, 'placa', m.placa,
        'localidad_centro', lc.nom_localidad, 'referencia_ubicacion_centro', c.ubicacion_referencia,
        'zonal_base_unidad', zm.nom_zona,
        'qr_habilitable', true,
        'responsables', (
            SELECT jsonb_agg(jsonb_build_object(
                'accion', h.accion, 'nombre', concat_ws(' ', ph.nombre, ph.ap_paterno, ph.ap_materno),
                'cargo', CASE h.accion
                    WHEN 'EMISION' THEN 'Operativo' WHEN 'AUTORIZACION' THEN 'Jefe zonal'
                    WHEN 'ATENCION' THEN 'Atención del grifo' WHEN 'FACTURA' THEN 'Contabilidad'
                    WHEN 'ANULACION' THEN 'Operativo' END,
                'fecha', h.fecha
            ) ORDER BY h.id_evento)
            FROM historial_vale h JOIN usuario u USING (id_usuario)
            JOIN trabajador th ON th.id_trabajador = u.id_trabajador
            JOIN persona ph ON ph.dni = th.dni
            WHERE h.id_vale = v.id_vale
        )
    ) INTO documento
    FROM vales v
    JOIN estado_vale e ON e.codigo = v.estado_vale
    JOIN zonal z ON z.id_zona = v.cod_zonal
    JOIN localidad l ON l.id_localidad = v.cod_localidad
    JOIN proveedor p ON p.cod_proveedor = v.cod_proveedor
    JOIN suministro s ON s.id_suministro = v.id_suministro
    JOIN trabajador tr ON tr.id_trabajador = v.id_trabajador
    JOIN persona pt ON pt.dni = tr.dni
    LEFT JOIN unidad_organizativa o ON o.cod_uni_organizativa = v.cod_uni_organizativa
    LEFT JOIN centro_costo c ON c.cod_centro_costo = v.cod_centrocosto
    LEFT JOIN localidad lc ON lc.id_localidad = c.cod_localidad
    LEFT JOIN unidad_maquinaria m ON m.codigo = v.codigo_unidad_movil
    LEFT JOIN zonal zm ON zm.id_zona = m.cod_zonal
    LEFT JOIN tercero t ON t.codigo_tercero = v.codigo_tercero
    WHERE v.cod_zonal = p_zonal AND v.codigo_vale = p_codigo AND puede_ver_vale(p_actor, v);

    IF documento IS NULL THEN
        RAISE EXCEPTION 'El documento no está disponible para este usuario.' USING ERRCODE = '42501';
    END IF;
    RETURN documento;
END;
$$;

COMMIT;
