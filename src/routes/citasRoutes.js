const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citasController');
const { verificarToken, requierePasswordActualizada } = require('../middleware/auth');


router.use(verificarToken);
router.use(requierePasswordActualizada);

router.get('/disponibilidad', citasController.obtenerDisponibilidadDoctor);
router.get('/', citasController.obtenerCitas);
router.post('/', citasController.crearCita);
router.delete('/:id', citasController.cancelarCita);
router.put('/:id/estado', citasController.actualizarEstado);

module.exports = router;
