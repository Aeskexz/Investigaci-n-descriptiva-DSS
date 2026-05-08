const db = require('../db');
const bcrypt = require('bcrypt');
const { generateUniqueUsername, normalizeUsername, usernameExists } = require('../utils/username');
const { generateUniquePublicUserId } = require('../utils/userId');
const { emailExists } = require('../utils/accountDirectory');
const { registrarCambio } = require('../utils/historialCambios');
const {
    deleteStoredProfilePath,
    buildProfilePublicPath,
    deleteProfilePhotosByUserId,
} = require('../utils/profilePhotos');

exports.obtenerHistorialCambios = async (req, res) => {
    try {
        const [historial] = await db.query(`
            SELECT id, tipo, descripcion, creado_en
            FROM historial_cambios
            ORDER BY creado_en DESC, id DESC
            LIMIT 500
        `);

        res.json(historial);
    } catch (error) {
        console.error('Error al obtener historial de cambios:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener el historial de cambios.' });
    }
};

exports.obtenerResumenDashboard = async (req, res) => {
    try {
        const [resumenRows] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM pacientes) AS total_pacientes,
                (SELECT COUNT(*) FROM doctores) AS total_doctores,
                (SELECT COUNT(*) FROM citas WHERE fecha = CURDATE() AND estado <> 'cancelada') AS total_citas_hoy
        `);

        const resumen = resumenRows[0] || {};

        res.json({
            pacientes: Number(resumen.total_pacientes || 0),
            doctores: Number(resumen.total_doctores || 0),
            citas_hoy: Number(resumen.total_citas_hoy || 0),
        });
    } catch (error) {
        console.error('Error al obtener resumen del dashboard de admin:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener el resumen del dashboard.' });
    }
};

exports.obtenerAsuetos = async (req, res) => {
    try {
        const [asuetos] = await db.query(`
            SELECT id, fecha, tipo, motivo, creado_en
            FROM dias_asueto
            ORDER BY fecha DESC, id DESC
        `);

        res.json(asuetos);
    } catch (error) {
        console.error('Error al obtener dias de asueto:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los dias de asueto.' });
    }
};

exports.crearAsueto = async (req, res) => {
    const { fecha, tipo, motivo } = req.body || {};

    try {
        const fechaLimpia = String(fecha || '').trim();
        const tipoLimpio = String(tipo || 'asueto').trim().toLowerCase();
        const motivoLimpio = String(motivo || '').trim();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) {
            return res.status(400).json({ mensaje: 'Fecha no valida. Usa el formato YYYY-MM-DD.' });
        }

        const tiposPermitidos = ['asueto', 'vacaciones'];
        if (!tiposPermitidos.includes(tipoLimpio)) {
            return res.status(400).json({ mensaje: 'Tipo no valido. Debe ser asueto o vacaciones.' });
        }

        await db.query(
            'INSERT INTO dias_asueto (fecha, tipo, motivo) VALUES (?, ?, ?)',
            [fechaLimpia, tipoLimpio, motivoLimpio || null]
        );

        res.status(201).json({
            mensaje: 'Dia no laborable registrado exitosamente.',
            asueto: {
                fecha: fechaLimpia,
                tipo: tipoLimpio,
                motivo: motivoLimpio || null,
            },
        });
    } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ mensaje: 'Ya existe un asueto/vacaciones registrado para esa fecha.' });
        }

        console.error('Error al crear dia de asueto:', error);
        res.status(500).json({ mensaje: 'Error interno al crear el dia no laborable.' });
    }
};

exports.eliminarAsueto = async (req, res) => {
    const { id } = req.params;

    try {
        const [resultado] = await db.query('DELETE FROM dias_asueto WHERE id = ?', [id]);

        if (!resultado || resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'El dia no laborable no existe.' });
        }

        res.json({ mensaje: 'Dia no laborable eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar dia de asueto:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el dia no laborable.' });
    }
};

exports.obtenerUsuarios = async (req, res) => {
    try {
        const [usuarios] = await db.query(`
            SELECT codigo_id AS id, email, username, 'doctor' AS rol, creado_en,
                   nombre AS doctor_nombre, especialidad,
                   NULL AS paciente_nombre, NULL AS telefono
            FROM doctores
            UNION ALL
            SELECT codigo_id AS id, email, username, 'paciente' AS rol, creado_en,
                   NULL AS doctor_nombre, NULL AS especialidad,
                   nombre AS paciente_nombre, telefono
            FROM pacientes
            UNION ALL
            SELECT codigo_id AS id, email, username, 'admin' AS rol, creado_en,
                   NULL AS doctor_nombre, NULL AS especialidad,
                   NULL AS paciente_nombre, NULL AS telefono
            FROM admins
            ORDER BY creado_en DESC
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
            SELECT codigo_id AS id, codigo_id AS usuario_id, nombre, especialidad, foto_perfil, email, username, creado_en
            FROM doctores
            ORDER BY nombre
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

        const emailLimpio = String(email).trim();

        if (await emailExists(db, emailLimpio)) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado.' });
        }

        const usernameCandidate = username && String(username).trim()
            ? normalizeUsername(username)
            : await generateUniqueUsername(db, String(emailLimpio).split('@')[0]);

        if (await usernameExists(db, usernameCandidate)) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const publicUserId = await generateUniquePublicUserId(db, 'doctor');

        const [resultadoDoctor] = await db.query(
            `INSERT INTO doctores (codigo_id, email, username, password, nombre, especialidad)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [publicUserId, emailLimpio, usernameCandidate, passwordHash, nombre, especialidad]
        );

        await registrarCambio({
            tipo: 'CREACION',
            descripcion: `El administrador ${req.usuario.email} ha creado la cuenta ${publicUserId} (@${usernameCandidate}).`,
        });

        res.status(201).json({
            mensaje: 'Doctor creado exitosamente.',
            doctor: {
                id: publicUserId,
                nombre,
                especialidad,
                email: emailLimpio,
                username: usernameCandidate,
            },
        });
    } catch (error) {
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
            'SELECT codigo_id, email, username FROM doctores WHERE codigo_id = ?',
            [id]
        );

        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const doctor = doctores[0];
        const emailLimpio = String(email).trim();

        if (await emailExists(db, emailLimpio, { rol: 'doctor', id: doctor.codigo_id })) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado por otro usuario.' });
        }

        const usernameLimpio = username && String(username).trim()
            ? normalizeUsername(username)
            : doctor.username;

        if (await usernameExists(db, usernameLimpio, { rol: 'doctor', id: doctor.codigo_id })) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado por otro usuario.' });
        }

        await db.query(
            'UPDATE doctores SET email = ?, username = ?, nombre = ?, especialidad = ? WHERE codigo_id = ?',
            [emailLimpio, usernameLimpio, nombre, especialidad, id]
        );

        res.json({
            mensaje: 'Doctor actualizado exitosamente.',
            doctor: {
                id: doctor.codigo_id,
                email: emailLimpio,
                username: usernameLimpio,
                nombre,
                especialidad,
            },
        });
    } catch (error) {
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

        const [doctores] = await db.query('SELECT codigo_id FROM doctores WHERE codigo_id = ?', [id]);

        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const passwordHash = await bcrypt.hash(passwordFinal, 10);

        await db.query(
            'UPDATE doctores SET password = ?, requiere_cambio_password = 1 WHERE codigo_id = ?',
            [passwordHash, id]
        );

        res.json({
            mensaje: 'Contraseña restaurada exitosamente.',
            passwordTemporal: passwordFinal,
        });
    } catch (error) {
        console.error('Error al restaurar contraseña del doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al restaurar la contraseña.' });
    }
};

exports.eliminarDoctor = async (req, res) => {
    const { id } = req.params;

    try {
        const [doctorExistente] = await db.query('SELECT codigo_id, foto_perfil FROM doctores WHERE codigo_id = ?', [id]);
        if (doctorExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        await db.query('DELETE FROM doctores WHERE codigo_id = ?', [id]);

        if (doctorExistente[0].foto_perfil) {
            deleteStoredProfilePath(doctorExistente[0].foto_perfil);
        }
        deleteProfilePhotosByUserId(id);

        await registrarCambio({
            tipo: 'ELIMINACION',
            descripcion: `El administrador ${req.usuario.email} ha borrado la cuenta ${id}.`,
        });

        res.json({ mensaje: 'Doctor eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el doctor.' });
    }
};

exports.obtenerPacientes = async (req, res) => {
    try {
        const [pacientes] = await db.query(`
            SELECT codigo_id AS id, codigo_id AS usuario_id, nombre, telefono, email, username, creado_en, foto_perfil
            FROM pacientes
            ORDER BY nombre
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
            'SELECT codigo_id, email, username FROM pacientes WHERE codigo_id = ?',
            [id]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'El paciente no existe.' });
        }

        const paciente = pacientes[0];
        const emailLimpio = String(email).trim();

        if (await emailExists(db, emailLimpio, { rol: 'paciente', id: paciente.codigo_id })) {
            return res.status(409).json({ mensaje: 'Este email ya está registrado por otro usuario.' });
        }

        const usernameLimpio = username && String(username).trim()
            ? normalizeUsername(username)
            : paciente.username;

        if (await usernameExists(db, usernameLimpio, { rol: 'paciente', id: paciente.codigo_id })) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado por otro usuario.' });
        }

        await db.query(
            'UPDATE pacientes SET email = ?, username = ?, nombre = ?, telefono = ? WHERE codigo_id = ?',
            [emailLimpio, usernameLimpio, nombre, telefono || null, id]
        );

        res.json({
            mensaje: 'Paciente actualizado exitosamente.',
            paciente: {
                id: paciente.codigo_id,
                email: emailLimpio,
                username: usernameLimpio,
                nombre,
                telefono: telefono || null,
            },
        });
    } catch (error) {
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

        const [pacientes] = await db.query('SELECT codigo_id FROM pacientes WHERE codigo_id = ?', [id]);

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'El paciente no existe.' });
        }

        const passwordHash = await bcrypt.hash(passwordFinal, 10);

        await db.query(
            'UPDATE pacientes SET password = ?, requiere_cambio_password = 1 WHERE codigo_id = ?',
            [passwordHash, id]
        );

        res.json({
            mensaje: 'Contraseña restaurada exitosamente.',
            passwordTemporal: passwordFinal,
        });
    } catch (error) {
        console.error('Error al restaurar contraseña del paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al restaurar la contraseña.' });
    }
};

exports.eliminarPaciente = async (req, res) => {
    const { id } = req.params;

    try {
        const [pacienteExistente] = await db.query('SELECT codigo_id, foto_perfil FROM pacientes WHERE codigo_id = ?', [id]);
        if (pacienteExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El paciente no existe.' });
        }

        await db.query('DELETE FROM pacientes WHERE codigo_id = ?', [id]);

        if (pacienteExistente[0].foto_perfil) {
            deleteStoredProfilePath(pacienteExistente[0].foto_perfil);
        }
        deleteProfilePhotosByUserId(id);

        await registrarCambio({
            tipo: 'ELIMINACION',
            descripcion: `El administrador ${req.usuario.email} ha borrado la cuenta ${id}.`,
        });

        res.json({ mensaje: 'Paciente eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el paciente.' });
    }
};

exports.eliminarCita = async (req, res) => {
    const { id } = req.params;

    try {
        const [citaExistente] = await db.query('SELECT codigo_id FROM citas WHERE codigo_id = ?', [id]);
        if (citaExistente.length === 0) {
            return res.status(404).json({ mensaje: 'La cita no existe.' });
        }

        await db.query('DELETE FROM citas WHERE codigo_id = ?', [id]);

        res.json({ mensaje: 'Cita eliminada exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar la cita.' });
    }
};

exports.cambiarFotoPerfilDoctor = async (req, res) => {
    const { doctorId } = req.params;

    try {
        if (!req.file) {
            return res.status(400).json({ mensaje: 'No se proporcionó ninguna imagen.' });
        }

        const [doctores] = await db.query(
            'SELECT codigo_id, foto_perfil FROM doctores WHERE codigo_id = ?',
            [doctorId]
        );

        if (doctores.length === 0) {
            if (req.file) {
                deleteStoredProfilePath(buildProfilePublicPath(req.file.filename));
            }
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const fotoPerfil = buildProfilePublicPath(req.file.filename);

        await db.query('UPDATE doctores SET foto_perfil = ? WHERE codigo_id = ?', [fotoPerfil, doctorId]);

        res.json({
            mensaje: 'Foto de perfil del doctor actualizada exitosamente.',
            foto_perfil: fotoPerfil,
        });
    } catch (error) {
        if (req.file) {
            deleteStoredProfilePath(buildProfilePublicPath(req.file.filename));
        }
        console.error('Error al cambiar foto de perfil del doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al cambiar la foto de perfil.' });
    }
};
