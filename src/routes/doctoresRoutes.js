const express = require('express');
const router = express.Router();
const doctoresController = require('../controllers/doctoresController');

router.get('/', doctoresController.obtenerDoctores);

module.exports = router;
