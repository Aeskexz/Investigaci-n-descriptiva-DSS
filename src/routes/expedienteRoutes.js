const express = require('express');
const router = express.Router();
const expedienteController = require('../controllers/expedienteController');
const { verificarToken, requierePasswordActualizada } = require('../middleware/auth');

router.use(verificarToken);
router.use(requierePasswordActualizada);

router.get('/:pacienteId', expedienteController.obtenerExpediente);
router.post('/:pacienteId', expedienteController.agregarEntrada);
router.put('/:pacienteId/:entradaId', expedienteController.editarEntrada);
router.delete('/:pacienteId/:entradaId', expedienteController.eliminarEntrada);

module.exports = router;
