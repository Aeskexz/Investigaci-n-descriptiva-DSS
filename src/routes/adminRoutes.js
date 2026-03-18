const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verificarToken, esAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación y rol de admin
router.use(verificarToken);
router.use(esAdmin);

// Rutas de administración
router.get('/usuarios', adminController.obtenerUsuarios);
router.get('/doctores', adminController.obtenerDoctores);
router.post('/doctores', adminController.crearDoctor);
router.delete('/doctores/:id', adminController.eliminarDoctor);

router.get('/pacientes', adminController.obtenerPacientes);
router.delete('/pacientes/:id', adminController.eliminarPaciente);

router.delete('/citas/:id', adminController.eliminarCita);

module.exports = router;
