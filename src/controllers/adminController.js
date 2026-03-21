const db = require('../db');
const bcrypt = require('bcrypt');
const { generateUniqueUsername, normalizeUsername, usernameExists } = require('../utils/username');


exports.obtenerUsuarios = async (req, res) => {
    try {
        const [usuarios] = await db.query(`
            SELECT u.id, u.email, u.username, u.rol, u.creado_en,
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


exports.obtenerDoctores = async (req, res) => {
    try {
        const [doctores] = await db.query(`
            SELECT d.id, d.nombre, d.especialidad, u.email, u.username, u.creado_en
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


exports.crearDoctor = async (req, res) => {
    const { email, username, password, nombre, especialidad } = req.body;

    try {
        
        if (!email || !password || !nombre || !especialidad) {
            return res.status(400).json({ mensaje: 'Todos los campos son requeridos.' });
        }

        
        const [usuariosExistentes] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (usuariosExistentes.length > 0) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado.' });
        }

        const usernameCandidate = username && String(username).trim()
            ? normalizeUsername(username)
            : await generateUniqueUsername(db, String(email).split('@')[0]);

        if (await usernameExists(db, usernameCandidate)) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado.' });
        }

        
        const passwordHash = await bcrypt.hash(password, 10);

        
        await db.query('START TRANSACTION');

        
        const [resultadoUsuario] = await db.query(
            'INSERT INTO usuarios (email, username, password, rol) VALUES (?, ?, ?, ?)',
            [email, usernameCandidate, passwordHash, 'doctor']
        );

        const usuarioId = resultadoUsuario.insertId;

        
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
                email,
                username: usernameCandidate
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al crear doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al crear el doctor.' });
    }
};


exports.editarDoctor = async (req, res) => {
    const { id } = req.params;
    const { email, username, nombre, especialidad } = req.body;

    try {
        if (!email || !nombre || !especialidad) {
            return res.status(400).json({ mensaje: 'Email, nombre y especialidad son requeridos.' });
        }

        const [doctores] = await db.query(
            `SELECT d.id, d.usuario_id, u.email, u.username
             FROM doctores d
             JOIN usuarios u ON d.usuario_id = u.id
             WHERE d.id = ?`,
            [id]
        );

        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const doctor = doctores[0];

        const [emailDuplicado] = await db.query(
            'SELECT id FROM usuarios WHERE email = ? AND id <> ?',
            [email, doctor.usuario_id]
        );

        if (emailDuplicado.length > 0) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado por otro usuario.' });
        }

        const usernameLimpio = username && String(username).trim()
            ? normalizeUsername(username)
            : doctor.username;

        const usernameDuplicado = await usernameExists(db, usernameLimpio, doctor.usuario_id);
        if (usernameDuplicado) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado por otro usuario.' });
        }

        await db.query('START TRANSACTION');

        await db.query('UPDATE usuarios SET email = ?, username = ? WHERE id = ?', [email, usernameLimpio, doctor.usuario_id]);

        await db.query(
            'UPDATE doctores SET nombre = ?, especialidad = ? WHERE id = ?',
            [nombre, especialidad, id]
        );

        await db.query('COMMIT');

        res.json({
            mensaje: 'Doctor actualizado exitosamente.',
            doctor: {
                id: Number(id),
                email,
                username: usernameLimpio,
                nombre,
                especialidad
            }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al editar doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al editar el doctor.' });
    }
};


exports.restaurarPasswordDoctor = async (req, res) => {
    const { id } = req.params;
    const { nuevaPassword } = req.body || {};

    try {
        const passwordFinal = (nuevaPassword && String(nuevaPassword).trim()) || 'doctor123';

        if (passwordFinal.length < 6) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const [doctores] = await db.query('SELECT usuario_id FROM doctores WHERE id = ?', [id]);

        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const passwordHash = await bcrypt.hash(passwordFinal, 10);

        await db.query('UPDATE usuarios SET password = ? WHERE id = ?', [passwordHash, doctores[0].usuario_id]);

        res.json({
            mensaje: 'Contraseña restaurada exitosamente.',
            passwordTemporal: passwordFinal
        });
    } catch (error) {
        console.error('Error al restaurar contraseña del doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al restaurar la contraseña.' });
    }
};


exports.eliminarDoctor = async (req, res) => {
    const { id } = req.params;

    try {
        
        const [doctorExistente] = await db.query('SELECT usuario_id FROM doctores WHERE id = ?', [id]);
        if (doctorExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const usuarioId = doctorExistente[0].usuario_id;

        
        await db.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);

        res.json({ mensaje: 'Doctor eliminado exitosamente.' });

    } catch (error) {
        console.error('Error al eliminar doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el doctor.' });
    }
};


exports.obtenerPacientes = async (req, res) => {
    try {
        const [pacientes] = await db.query(`
            SELECT p.id, p.nombre, p.telefono, u.email, u.username, u.creado_en
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


exports.editarPaciente = async (req, res) => {
    const { id } = req.params;
    const { email, username, nombre, telefono } = req.body;

    try {
        if (!email || !nombre) {
            return res.status(400).json({ mensaje: 'Email y nombre son requeridos.' });
        }

        const [pacientes] = await db.query(
            `SELECT p.id, p.usuario_id, u.email, u.username
             FROM pacientes p
             JOIN usuarios u ON p.usuario_id = u.id
             WHERE p.id = ?`,
            [id]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'El paciente no existe.' });
        }

        const paciente = pacientes[0];

        const [emailDuplicado] = await db.query(
            'SELECT id FROM usuarios WHERE email = ? AND id <> ?',
            [email, paciente.usuario_id]
        );

        if (emailDuplicado.length > 0) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado por otro usuario.' });
        }

        const usernameLimpio = username && String(username).trim()
            ? normalizeUsername(username)
            : paciente.username;

        const usernameDuplicado = await usernameExists(db, usernameLimpio, paciente.usuario_id);
        if (usernameDuplicado) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado por otro usuario.' });
        }

        await db.query('START TRANSACTION');

        await db.query('UPDATE usuarios SET email = ?, username = ? WHERE id = ?', [email, usernameLimpio, paciente.usuario_id]);

        await db.query(
            'UPDATE pacientes SET nombre = ?, telefono = ? WHERE id = ?',
            [nombre, telefono || null, id]
        );

        await db.query('COMMIT');

        res.json({
            mensaje: 'Paciente actualizado exitosamente.',
            paciente: {
                id: Number(id),
                email,
                username: usernameLimpio,
                nombre,
                telefono: telefono || null
            }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al editar paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al editar el paciente.' });
    }
};


exports.restaurarPasswordPaciente = async (req, res) => {
    const { id } = req.params;
    const { nuevaPassword } = req.body || {};

    try {
        const passwordFinal = (nuevaPassword && String(nuevaPassword).trim()) || 'paciente123';

        if (passwordFinal.length < 6) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const [pacientes] = await db.query('SELECT usuario_id FROM pacientes WHERE id = ?', [id]);

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'El paciente no existe.' });
        }

        const passwordHash = await bcrypt.hash(passwordFinal, 10);

        await db.query('UPDATE usuarios SET password = ? WHERE id = ?', [passwordHash, pacientes[0].usuario_id]);

        res.json({
            mensaje: 'Contraseña restaurada exitosamente.',
            passwordTemporal: passwordFinal
        });
    } catch (error) {
        console.error('Error al restaurar contraseña del paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al restaurar la contraseña.' });
    }
};


exports.eliminarPaciente = async (req, res) => {
    const { id } = req.params;

    try {
        
        const [pacienteExistente] = await db.query('SELECT usuario_id FROM pacientes WHERE id = ?', [id]);
        if (pacienteExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El paciente no existe.' });
        }

        const usuarioId = pacienteExistente[0].usuario_id;

        
        await db.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);

        res.json({ mensaje: 'Paciente eliminado exitosamente.' });

    } catch (error) {
        console.error('Error al eliminar paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el paciente.' });
    }
};


exports.eliminarCita = async (req, res) => {
    const { id } = req.params;

    try {
        
        const [citaExistente] = await db.query('SELECT id FROM citas WHERE id = ?', [id]);
        if (citaExistente.length === 0) {
            return res.status(404).json({ mensaje: 'La cita no existe.' });
        }

        
        await db.query('DELETE FROM citas WHERE id = ?', [id]);

        res.json({ mensaje: 'Cita eliminada exitosamente.' });

    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar la cita.' });
    }
};
