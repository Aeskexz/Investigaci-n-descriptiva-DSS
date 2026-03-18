const express = require('express');
const router = express.Router();
const doctoresController = require('../controllers/doctoresController');

// Ruta pública para ver doctores disponibles
router.get('/', doctoresController.obtenerDoctores);

module.exports = router;
