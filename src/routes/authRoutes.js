const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken, esPaciente, esDoctor } = require('../middleware/auth');
const upload = require('../middleware/upload');


router.post('/registro', authController.registrar);
router.post('/login', authController.login);


router.get('/perfil', verificarToken, authController.obtenerPerfil);
router.get('/ajustes', verificarToken, authController.obtenerAjustesCuenta);
router.put('/ajustes', verificarToken, authController.actualizarAjustesCuenta);
router.put('/ajustes/foto', verificarToken, upload.single('foto'), authController.cambiarFotoPerfil);
router.put('/cambiar-password', verificarToken, authController.cambiarPasswordCuenta);
router.delete('/cuenta', verificarToken, authController.eliminarMiCuenta);


router.put('/perfil/paciente', verificarToken, esPaciente, authController.actualizarPerfilPaciente);
router.put('/perfil/foto', verificarToken, upload.single('foto'), authController.cambiarFotoPerfil);

module.exports = router;
