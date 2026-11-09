-- Solo para las cuentas ficticias de una base de desarrollo.
-- Contraseña de prueba: demo.
UPDATE vales.usuario
SET clave_hash = '{bcrypt}$2a$10$gXpzPqhp/pe.F41HIXEI/eifcbu8wanEmnjGdgXzdPUhTTPCwOrXe'
WHERE login IN (
    'demo.contabilidad', 'demo.admin', 'demo.operativo.piura', 'demo.operativo.sullana',
    'demo.jefe.piura', 'demo.jefe.piura2', 'demo.jefe.sullana',
    'demo.grifo.algarrobos', 'demo.grifo.santaelena'
)
  AND clave_hash IS NULL;
