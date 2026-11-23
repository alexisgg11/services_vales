\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=vales,pg_catalog;
DO $$
DECLARE grifero integer; contador integer; operativo integer; jefe integer; id bigint; reservado bigint;
        documento jsonb; repetido jsonb;
        solicitud uuid:=gen_random_uuid(); anterior bigint; falsa bigint; hoy date:=(now() AT TIME ZONE 'America/Lima')::date;
BEGIN
    SELECT id_usuario INTO STRICT grifero FROM usuario WHERE login='demo.grifo.algarrobos';
    SELECT id_usuario INTO STRICT contador FROM usuario WHERE login='demo.contabilidad';
    SELECT id_usuario INTO STRICT operativo FROM usuario WHERE login='demo.operativo.piura';
    SELECT id_usuario INTO STRICT jefe FROM usuario WHERE login='demo.jefe.piura';
    SELECT v.id_vale INTO STRICT reservado
    FROM vales v JOIN factura_ticket t USING (cod_proveedor,ticket)
    JOIN factura f ON f.codigo_factura = t.codigo_factura
    WHERE v.cod_proveedor='20000000001' AND v.cod_zonal='01' AND f.asociado_por IS NULL
    ORDER BY v.id_vale LIMIT 1;
    ASSERT NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(facturacion_grifo(grifero)->'pendientes') t WHERE t->>'id'=reservado::text
    );
    BEGIN
        PERFORM emitir_factura_grifo(grifero,ARRAY[reservado],gen_random_uuid(),hoy);
        RAISE EXCEPTION 'Se permitió facturar un ticket respaldado por una factura pendiente de asociación';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;

    id := (registrar_vale(operativo,'90000001','20000000001','REGULAR',1)).id_vale;
    PERFORM autorizar_vales(jefe,ARRAY[id]);
    PERFORM registrar_atencion(grifero,id,hoy,1,p_dni_presentado => '90000001',p_identidad_verificada => true);
    ASSERT EXISTS (
        SELECT 1 FROM jsonb_array_elements(facturacion_grifo(grifero)->'pendientes') t WHERE t->>'id'=id::text
    );
    SELECT coalesce(ultimo,0) INTO anterior FROM correlativo_factura WHERE cod_proveedor='20000000001' AND serie='F001';
    documento:=emitir_factura_grifo(grifero,ARRAY[id],solicitud,hoy);
    IF (documento->>'numero')::bigint<>anterior+1 THEN RAISE EXCEPTION 'Correlativo incorrecto'; END IF;
    repetido:=emitir_factura_grifo(grifero,ARRAY[id],solicitud,hoy);
    IF repetido->>'codigo_factura'<>documento->>'codigo_factura' THEN RAISE EXCEPTION 'Reintento duplicó factura'; END IF;
    BEGIN
        PERFORM emitir_factura_grifo(grifero,ARRAY[id],gen_random_uuid(),hoy);
        RAISE EXCEPTION 'Se permitió refacturar el ticket';
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
    BEGIN
        PERFORM emitir_factura_grifo(contador,ARRAY[id],gen_random_uuid(),hoy);
        RAISE EXCEPTION 'Se permitió facturar a Contabilidad';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    INSERT INTO factura(cod_proveedor,serie,numero,fecha_emision,total)
    VALUES('20000000001','QATEST','00000001',hoy,(documento->>'total')::numeric) RETURNING codigo_factura INTO falsa;
    INSERT INTO factura_ticket SELECT falsa,cod_proveedor,ticket FROM vales WHERE id_vale=id;
    BEGIN
        PERFORM asociar_factura_desde_vales(contador,falsa,ARRAY[id]);
        RAISE EXCEPTION 'Se permitió asociar un ticket emitido a otra factura' USING ERRCODE='XX000';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF position('otra factura' IN SQLERRM)=0 THEN RAISE; END IF;
    END;
    PERFORM asociar_factura_desde_vales(contador,(documento->>'codigo_factura')::bigint,ARRAY[id]);
    IF NOT EXISTS(SELECT 1 FROM vales WHERE id_vale=id AND codigo_factura=(documento->>'codigo_factura')::bigint) THEN
        RAISE EXCEPTION 'No se guardó la factura correcta'; END IF;
    PERFORM identidad_local(operativo,'99000001');
    BEGIN
        PERFORM identidad_local(contador,'99000001');
        RAISE EXCEPTION 'Contabilidad accedió a la consulta de DNI';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    RAISE NOTICE 'Verificados correlativo, idempotencia, reserva de tickets, conciliación e identidad.';
END;
$$;
ROLLBACK;
