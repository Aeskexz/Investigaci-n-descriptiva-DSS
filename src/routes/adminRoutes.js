const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verificarToken, esAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');


router.use(verificarToken);
router.use(esAdmin);


router.get('/usuarios', adminController.obtenerUsuarios);
router.get('/historial-cambios', adminController.obtenerHistorialCambios);
router.get('/doctores', adminController.obtenerDoctores);
router.post('/doctores', adminController.crearDoctor);
router.put('/doctores/:id', adminController.editarDoctor);
router.put('/doctores/:id/restaurar-password', adminController.restaurarPasswordDoctor);
router.put('/doctores/:id/foto-perfil', upload.single('foto'), adminController.cambiarFotoPerfilDoctor);
router.delete('/doctores/:id', adminController.eliminarDoctor);

router.get('/pacientes', adminController.obtenerPacientes);
router.put('/pacientes/:id', adminController.editarPaciente);
router.put('/pacientes/:id/restaurar-password', adminController.restaurarPasswordPaciente);
router.delete('/pacientes/:id', adminController.eliminarPaciente);

router.delete('/citas/:id', adminController.eliminarCita);

module.exports = router;
