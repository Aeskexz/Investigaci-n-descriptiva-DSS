const express = require('express');
const router = express.Router();
const doctoresController = require('../controllers/doctoresController');

router.get('/', doctoresController.obtenerDoctores);
router.post('/', doctoresController.crearDoctor);
router.put('/:id', doctoresController.actualizarDoctor);
router.delete('/:id', doctoresController.eliminarDoctor);

module.exports = router;
