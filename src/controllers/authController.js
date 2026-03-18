const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Clave secreta para JWT (debería estar en .env en producción)
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura';

/**
 * Registro de usuario (paciente o doctor)
 */
exports.registrar = async (req, res) => {
    const { email, password, rol, nombre, especialidad, telefono } = req.body;

    try {
        // Validaciones básicas
        if (!email || !password || !rol) {
            return res.status(400).json({ mensaje: 'Email, contraseña y rol son requeridos.' });
        }

        if (!['paciente', 'doctor'].includes(rol)) {
            return res.status(400).json({ mensaje: 'El rol debe ser "paciente" o "doctor".' });
        }

        // Validar que el email no exista ya
        const [usuariosExistentes] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (usuariosExistentes.length > 0) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado.' });
        }

        // Encriptar contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        // Iniciar transacción
        await db.query('START TRANSACTION');

        // Crear usuario
        const [resultadoUsuario] = await db.query(
            'INSERT INTO usuarios (email, password, rol) VALUES (?, ?, ?)',
            [email, passwordHash, rol]
        );

        const usuarioId = resultadoUsuario.insertId;

        // Crear perfil según el rol
        if (rol === 'doctor') {
            if (!nombre || !especialidad) {
                await db.query('ROLLBACK');
                return res.status(400).json({ mensaje: 'Nombre y especialidad son requeridos para doctores.' });
            }
            await db.query(
                'INSERT INTO doctores (usuario_id, nombre, especialidad) VALUES (?, ?, ?)',
                [usuarioId, nombre, especialidad]
            );
        } else if (rol === 'paciente') {
            if (!nombre) {
                await db.query('ROLLBACK');
                return res.status(400).json({ mensaje: 'Nombre es requerido para pacientes.' });
            }
            await db.query(
                'INSERT INTO pacientes (usuario_id, nombre, telefono) VALUES (?, ?, ?)',
                [usuarioId, nombre, telefono || null]
            );
        }

        await db.query('COMMIT');

        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente.',
            usuario: {
                id: usuarioId,
                email,
                rol
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ mensaje: 'Error interno al registrar el usuario.' });
    }
};

/**
 * Login de usuario
 */
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validaciones básicas
        if (!email || !password) {
            return res.status(400).json({ mensaje: 'Email y contraseña son requeridos.' });
        }

        // Buscar usuario por email
        const [usuarios] = await db.query(
            'SELECT id, email, password, rol FROM usuarios WHERE email = ?',
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
        }

        const usuario = usuarios[0];

        // Verificar contraseña
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
        }

        // Generar token JWT
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            mensaje: 'Login exitoso.',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error al hacer login:', error);
        res.status(500).json({ mensaje: 'Error interno al hacer login.' });
    }
};

/**
 * Obtener perfil del usuario autenticado
 */
exports.obtenerPerfil = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const [usuarios] = await db.query(
            'SELECT id, email, rol, creado_en FROM usuarios WHERE id = ?',
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const usuario = usuarios[0];
        let perfil = null;

        if (usuario.rol === 'doctor') {
            const [doctores] = await db.query(
                'SELECT id, nombre, especialidad FROM doctores WHERE usuario_id = ?',
                [usuarioId]
            );
            perfil = doctores[0];
        } else if (usuario.rol === 'paciente') {
            const [pacientes] = await db.query(
                'SELECT id, nombre, telefono FROM pacientes WHERE usuario_id = ?',
                [usuarioId]
            );
            perfil = pacientes[0];
        }

        res.json({
            usuario: {
                id: usuario.id,
                email: usuario.email,
                rol: usuario.rol,
                creado_en: usuario.creado_en
            },
            perfil
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener el perfil.' });
    }
};
