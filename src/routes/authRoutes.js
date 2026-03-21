const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');


router.post('/registro', authController.registrar);
router.post('/login', authController.login);


router.get('/perfil', verificarToken, authController.obtenerPerfil);
router.get('/ajustes', verificarToken, authController.obtenerAjustesCuenta);
router.put('/ajustes', verificarToken, authController.actualizarAjustesCuenta);
router.put('/cambiar-password', verificarToken, authController.cambiarPasswordCuenta);
router.delete('/cuenta', verificarToken, authController.eliminarMiCuenta);

module.exports = router;
