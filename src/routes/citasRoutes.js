const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citasController');
const { verificarToken } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(verificarToken);

router.get('/', citasController.obtenerCitas);
router.post('/', citasController.crearCita);
router.delete('/:id', citasController.cancelarCita);
router.put('/:id/estado', citasController.actualizarEstado);

module.exports = router;
