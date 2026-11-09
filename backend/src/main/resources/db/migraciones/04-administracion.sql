BEGIN;
SET LOCAL search_path = vales, pg_catalog;

CREATE TABLE historial_acceso (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor integer NOT NULL REFERENCES usuario,
    cuenta integer NOT NULL REFERENCES usuario,
    accion varchar(20) NOT NULL,
    fecha timestamptz NOT NULL DEFAULT clock_timestamp(),
    detalle jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE FUNCTION contexto_administracion(p_actor integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, vales, pg_temp AS $$
BEGIN
    IF NOT tiene_rol(p_actor, 'ADMIN') THEN
        RAISE EXCEPTION 'Solo Administrador puede gestionar los accesos.' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
        'cuentas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', u.id_usuario, 'login', u.login, 'activo', u.activo,
            'nombre', concat_ws(' ', p.nombre, p.ap_paterno, p.ap_materno),
            'roles', (SELECT coalesce(jsonb_agg(to_jsonb(a) - 'id_usuario' ORDER BY a.codigo_rol), '[]')
                      FROM usuario_rol a WHERE a.id_usuario = u.id_usuario)
        ) ORDER BY u.login), '[]')
        FROM usuario u JOIN trabajador t USING (id_trabajador) JOIN persona p USING (dni)),
        'trabajadores', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', t.id_trabajador, 'nombre', concat_ws(' ', p.nombre, p.ap_paterno, p.ap_materno),
            'dni', p.dni
        ) ORDER BY p.nombre, p.ap_paterno), '[]')
        FROM trabajador t JOIN persona p USING (dni)
        WHERE t.activo AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id_trabajador = t.id_trabajador)),
        'roles', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.descripcion) FROM rol r),
        'zonales', (SELECT jsonb_agg(to_jsonb(z) ORDER BY z.nom_zona) FROM zonal z),
        'tarifas', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.vigente_desde DESC, a.cod_proveedor, a.id_suministro), '[]')
                    FROM tarifa a)
    );
END;
$$;

CREATE FUNCTION bloquear_administracion(p_actor integer)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, vales, pg_temp AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(61549201);
    IF NOT tiene_rol(p_actor, 'ADMIN') THEN
        RAISE EXCEPTION 'Solo Administrador puede gestionar los accesos.' USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE FUNCTION administrar_cuenta(p_actor integer, p_id integer, p_login text,
        p_trabajador integer, p_clave text, p_activo boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
DECLARE
    cuenta integer;
BEGIN
    PERFORM bloquear_administracion(p_actor);
    IF p_activo IS NULL OR (p_id = p_actor AND NOT p_activo) THEN
        RAISE EXCEPTION 'No puedes desactivar tu propia cuenta.' USING ERRCODE = '22023';
    END IF;
    IF p_id IS NULL THEN
        IF p_login IS NULL OR p_login !~ '^[a-zA-Z0-9._-]{3,80}$' OR p_clave IS NULL THEN
            RAISE EXCEPTION 'Indica un usuario válido y una contraseña.' USING ERRCODE = '22023';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM trabajador WHERE id_trabajador = p_trabajador AND activo) THEN
            RAISE EXCEPTION 'Selecciona un trabajador activo.' USING ERRCODE = '22023';
        END IF;
        INSERT INTO usuario (login, id_trabajador, clave_hash, activo)
        VALUES (lower(p_login), p_trabajador, p_clave, p_activo)
        RETURNING id_usuario INTO cuenta;
    ELSE
        UPDATE usuario SET activo = p_activo, clave_hash = coalesce(p_clave, clave_hash)
        WHERE id_usuario = p_id RETURNING id_usuario INTO cuenta;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La cuenta seleccionada ya no está disponible.' USING ERRCODE = '22023';
        END IF;
    END IF;
    INSERT INTO historial_acceso(actor, cuenta, accion, detalle)
    VALUES (p_actor, cuenta, CASE WHEN p_id IS NULL THEN 'ALTA' ELSE 'CAMBIO_CUENTA' END,
            jsonb_build_object('activo', p_activo, 'clave_actualizada', p_clave IS NOT NULL));
    RETURN cuenta;
END;
$$;

CREATE FUNCTION administrar_rol(p_actor integer, p_cuenta integer, p_rol text,
        p_zonal text, p_grifo text, p_otorgar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, vales, pg_temp AS $$
BEGIN
    PERFORM bloquear_administracion(p_actor);
    IF p_rol IS NULL OR NOT EXISTS (SELECT 1 FROM rol WHERE codigo = p_rol) OR p_otorgar IS NULL THEN
        RAISE EXCEPTION 'Selecciona un rol válido.' USING ERRCODE = '22023';
    END IF;
    IF p_otorgar THEN
        IF ((p_rol IN ('OPERATIVO','JEFE','GRIFO')) <> (p_zonal IS NOT NULL))
           OR ((p_rol = 'GRIFO') <> (p_grifo IS NOT NULL)) THEN
            RAISE EXCEPTION 'Completa el ámbito que corresponde al rol.' USING ERRCODE = '22023';
        END IF;
        INSERT INTO usuario_rol (id_usuario, codigo_rol, cod_zonal, cod_proveedor)
        VALUES (p_cuenta, p_rol, p_zonal, p_grifo)
        ON CONFLICT (id_usuario, codigo_rol) DO UPDATE
        SET cod_zonal = excluded.cod_zonal, cod_proveedor = excluded.cod_proveedor;
    ELSE
        IF p_actor = p_cuenta AND p_rol = 'ADMIN' THEN
            RAISE EXCEPTION 'No puedes quitar el rol Administrador de tu propia cuenta.' USING ERRCODE = '22023';
        END IF;
        DELETE FROM usuario_rol WHERE id_usuario = p_cuenta AND codigo_rol = p_rol;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La cuenta no tiene ese rol.' USING ERRCODE = '22023';
        END IF;
    END IF;
    INSERT INTO historial_acceso(actor, cuenta, accion, detalle)
    VALUES (p_actor, p_cuenta, CASE WHEN p_otorgar THEN 'OTORGAR_ROL' ELSE 'QUITAR_ROL' END,
            jsonb_build_object('rol', p_rol, 'zonal', p_zonal, 'grifo', p_grifo));
END;
$$;

REVOKE ALL ON FUNCTION contexto_administracion(integer), bloquear_administracion(integer),
    administrar_cuenta(integer, integer, text, integer, text, boolean),
    administrar_rol(integer, integer, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contexto_administracion(integer),
    administrar_cuenta(integer, integer, text, integer, text, boolean),
    administrar_rol(integer, integer, text, text, text, boolean),
    registrar_tarifa(integer, text, text, date, numeric) TO vales_app;
COMMIT;
