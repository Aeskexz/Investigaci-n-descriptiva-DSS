const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura';

/**
 * Middleware para verificar token JWT
 */
const verificarToken = async (req, res, next) => {
    try {
        // Obtener token del header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ mensaje: 'Token no proporcionado.' });
        }

        const token = authHeader.split(' ')[1];

        // Verificar token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verificar que el usuario existe
        const [usuarios] = await db.query(
            'SELECT id, email, rol FROM usuarios WHERE id = ?',
            [decoded.id]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: 'Usuario no encontrado.' });
        }

        // Adjuntar información del usuario al request
        req.usuario = usuarios[0];
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ mensaje: 'Token inválido.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ mensaje: 'Token expirado.' });
        }
        console.error('Error al verificar token:', error);
        res.status(500).json({ mensaje: 'Error interno al verificar el token.' });
    }
};

/**
 * Middleware para verificar que el usuario sea admin
 */
const esAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};

/**
 * Middleware para verificar que el usuario sea doctor
 */
const esDoctor = (req, res, next) => {
    if (req.usuario.rol !== 'doctor') {
        return res.status(403).json({ mensaje: 'Acceso denegado. Se requiere rol de doctor.' });
    }
    next();
};

/**
 * Middleware para verificar que el usuario sea paciente
 */
const esPaciente = (req, res, next) => {
    if (req.usuario.rol !== 'paciente') {
        return res.status(403).json({ mensaje: 'Acceso denegado. Se requiere rol de paciente.' });
    }
    next();
};

module.exports = {
    verificarToken,
    esAdmin,
    esDoctor,
    esPaciente
};
