const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citasController');

router.get('/', citasController.obtenerCitas);
router.post('/', citasController.crearCita);
router.put('/:id', citasController.actualizarCita);
router.delete('/:id', citasController.eliminarCita);

module.exports = router;
