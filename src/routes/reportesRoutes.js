const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { verificarToken, requierePasswordActualizada } = require('../middleware/auth');

router.use(verificarToken);
router.use(requierePasswordActualizada);

router.get('/pacientes/:pacienteId/historial-medico.pdf', reportesController.generarPdfHistorialPaciente);

module.exports = router;