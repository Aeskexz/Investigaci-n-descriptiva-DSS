const jwt = require('jsonwebtoken');
const db = require('../db');
const { getAccountByRoleAndId } = require('../utils/accountDirectory');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura';


const verificarToken = async (req, res, next) => {
    try {
        
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ mensaje: 'Token no proporcionado.' });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, JWT_SECRET);

       
        const usuario = await getAccountByRoleAndId(db, decoded.rol, decoded.id);

        if (!usuario) {
            return res.status(401).json({ mensaje: 'Usuario no encontrado.' });
        }

        req.usuario = {
            id: usuario.codigo_id,
            codigo_id: usuario.codigo_id,
            email: usuario.email,
            username: usuario.username,
            rol: decoded.rol,
        };
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



const esAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};


const esDoctor = (req, res, next) => {
    if (req.usuario.rol !== 'doctor') {
        return res.status(403).json({ mensaje: 'Acceso denegado. Se requiere rol de doctor.' });
    }
    next();
};


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
