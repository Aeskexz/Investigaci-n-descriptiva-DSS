const db = require('../db');
const bcrypt = require('bcrypt');

/**
 * Obtener todos los usuarios (solo admin)
 */
exports.obtenerUsuarios = async (req, res) => {
    try {
        const [usuarios] = await db.query(`
            SELECT u.id, u.email, u.rol, u.creado_en,
                   d.nombre AS doctor_nombre, d.especialidad,
                   p.nombre AS paciente_nombre, p.telefono
            FROM usuarios u
            LEFT JOIN doctores d ON u.id = d.usuario_id
            LEFT JOIN pacientes p ON u.id = p.usuario_id
            ORDER BY u.creado_en DESC
        `);

        res.json(usuarios);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los usuarios.' });
    }
};

/**
 * Obtener todos los doctores (solo admin)
 */
exports.obtenerDoctores = async (req, res) => {
    try {
        const [doctores] = await db.query(`
            SELECT d.id, d.nombre, d.especialidad, u.email, u.creado_en
            FROM doctores d
            JOIN usuarios u ON d.usuario_id = u.id
            ORDER BY d.nombre
        `);

        res.json(doctores);
    } catch (error) {
        console.error('Error al obtener doctores:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los doctores.' });
    }
};

/**
 * Crear un doctor (solo admin)
 */
exports.crearDoctor = async (req, res) => {
    const { email, password, nombre, especialidad } = req.body;

    try {
        // Validaciones
        if (!email || !password || !nombre || !especialidad) {
            return res.status(400).json({ mensaje: 'Todos los campos son requeridos.' });
        }

        // Verificar que el email no exista
        const [usuariosExistentes] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (usuariosExistentes.length > 0) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado.' });
        }

        // Encriptar contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        // Iniciar transacción
        await db.query('START TRANSACTION');

        // Crear usuario con rol doctor
        const [resultadoUsuario] = await db.query(
            'INSERT INTO usuarios (email, password, rol) VALUES (?, ?, ?)',
            [email, passwordHash, 'doctor']
        );

        const usuarioId = resultadoUsuario.insertId;

        // Crear perfil del doctor
        await db.query(
            'INSERT INTO doctores (usuario_id, nombre, especialidad) VALUES (?, ?, ?)',
            [usuarioId, nombre, especialidad]
        );

        await db.query('COMMIT');

        res.status(201).json({
            mensaje: 'Doctor creado exitosamente.',
            doctor: {
                id: resultadoUsuario.insertId,
                nombre,
                especialidad,
                email
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al crear doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al crear el doctor.' });
    }
};

/**
 * Eliminar un doctor (solo admin)
 */
exports.eliminarDoctor = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar que el doctor existe
        const [doctorExistente] = await db.query('SELECT usuario_id FROM doctores WHERE id = ?', [id]);
        if (doctorExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const usuarioId = doctorExistente[0].usuario_id;

        // Eliminar el usuario (cascade eliminará el doctor)
        await db.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);

        res.json({ mensaje: 'Doctor eliminado exitosamente.' });

    } catch (error) {
        console.error('Error al eliminar doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el doctor.' });
    }
};

/**
 * Obtener todos los pacientes (solo admin)
 */
exports.obtenerPacientes = async (req, res) => {
    try {
        const [pacientes] = await db.query(`
            SELECT p.id, p.nombre, p.telefono, u.email, u.creado_en
            FROM pacientes p
            JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.nombre
        `);

        res.json(pacientes);
    } catch (error) {
        console.error('Error al obtener pacientes:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los pacientes.' });
    }
};

/**
 * Eliminar un paciente (solo admin)
 */
exports.eliminarPaciente = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar que el paciente existe
        const [pacienteExistente] = await db.query('SELECT usuario_id FROM pacientes WHERE id = ?', [id]);
        if (pacienteExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El paciente no existe.' });
        }

        const usuarioId = pacienteExistente[0].usuario_id;

        // Eliminar el usuario (cascade eliminará el paciente y sus citas)
        await db.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);

        res.json({ mensaje: 'Paciente eliminado exitosamente.' });

    } catch (error) {
        console.error('Error al eliminar paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el paciente.' });
    }
};

/**
 * Eliminar una cita (solo admin)
 */
exports.eliminarCita = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar que la cita existe
        const [citaExistente] = await db.query('SELECT id FROM citas WHERE id = ?', [id]);
        if (citaExistente.length === 0) {
            return res.status(404).json({ mensaje: 'La cita no existe.' });
        }

        // Eliminar la cita
        await db.query('DELETE FROM citas WHERE id = ?', [id]);

        res.json({ mensaje: 'Cita eliminada exitosamente.' });

    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar la cita.' });
    }
};
