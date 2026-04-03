-- Elimina la tabla historial_cambios solo si existe
-- Ejecuta este script en la base de datos investigacion_descriptiva

USE investigacion_descriptiva;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS historial_cambios;
SET FOREIGN_KEY_CHECKS = 1;
