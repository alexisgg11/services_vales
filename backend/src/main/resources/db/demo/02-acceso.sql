-- Solo para las cuentas ficticias de una base de desarrollo.
UPDATE vales.usuario
SET clave_hash = current_setting('vales.demo_clave_hash')
WHERE login IN (
    'demo.contabilidad', 'demo.admin', 'demo.operativo.piura', 'demo.operativo.sullana',
    'demo.jefe.piura', 'demo.jefe.piura2', 'demo.jefe.sullana',
    'demo.grifo.algarrobos', 'demo.grifo.santaelena'
)
  AND clave_hash IS NULL;
