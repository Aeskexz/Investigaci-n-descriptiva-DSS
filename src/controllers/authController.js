const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateUniqueUsername, normalizeUsername, usernameExists } = require('../utils/username');
const { generateUniquePublicUserId } = require('../utils/userId');
const {
    emailExists,
    findAccountByIdentifier,
    getAccountByRoleAndId,
    getTableByRole,
} = require('../utils/accountDirectory');
const path = require('path');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura';

exports.registrar = async (req, res) => {
    const { email, username, password, rol, nombre, especialidad, telefono } = req.body;

    try {
        if (!email || !password || !rol) {
            return res.status(400).json({ mensaje: 'Email, contraseña y rol son requeridos.' });
        }

        if (!['paciente', 'doctor'].includes(rol)) {
            return res.status(400).json({ mensaje: 'El rol debe ser "paciente" o "doctor".' });
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
        const publicUserId = await generateUniquePublicUserId(db, rol);

        await db.query('START TRANSACTION');

        if (rol === 'doctor') {
            if (!nombre || !especialidad) {
                await db.query('ROLLBACK');
                return res.status(400).json({ mensaje: 'Nombre y especialidad son requeridos para doctores.' });
            }

            await db.query(
                `INSERT INTO doctores (codigo_id, email, username, password, nombre, especialidad)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [publicUserId, emailLimpio, usernameCandidate, passwordHash, nombre, especialidad]
            );
        }

        if (rol === 'paciente') {
            if (!nombre) {
                await db.query('ROLLBACK');
                return res.status(400).json({ mensaje: 'Nombre es requerido para pacientes.' });
            }

            await db.query(
                `INSERT INTO pacientes (codigo_id, email, username, password, nombre, telefono)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [publicUserId, emailLimpio, usernameCandidate, passwordHash, nombre, telefono || null]
            );
        }

        await db.query('COMMIT');

        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente.',
            usuario: {
                id: publicUserId,
                email: emailLimpio,
                username: usernameCandidate,
                rol,
            },
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ mensaje: 'Error interno al registrar el usuario.' });
    }
};

exports.login = async (req, res) => {
    const { identifier, email, username, password } = req.body;
    const loginIdentifier = String(identifier || email || username || '').trim();

    try {
        if (!loginIdentifier || !password) {
            return res.status(400).json({ mensaje: 'Correo o nombre de usuario y contraseña son requeridos.' });
        }

        const usuario = await findAccountByIdentifier(db, loginIdentifier, normalizeUsername(loginIdentifier));

        if (!usuario) {
            return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
        }

        const passwordValida = await bcrypt.compare(password, usuario.password || '');
        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
        }

        const token = jwt.sign(
            { id: usuario.codigo_id, email: usuario.email, rol: usuario.rol },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            mensaje: 'Login exitoso.',
            token,
            usuario: {
                id: usuario.codigo_id,
                email: usuario.email,
                username: usuario.username,
                rol: usuario.rol,
            },
        });
    } catch (error) {
        console.error('Error al hacer login:', error);
        res.status(500).json({ mensaje: 'Error interno al hacer login.' });
    }
};

exports.obtenerPerfil = async (req, res) => {
    try {
        const usuario = await getAccountByRoleAndId(db, req.usuario.rol, req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        let perfil = null;

        if (usuario.rol === 'doctor') {
            const [doctores] = await db.query(
                'SELECT codigo_id AS id, nombre, especialidad FROM doctores WHERE codigo_id = ?',
                [usuario.codigo_id]
            );
            perfil = doctores[0] || null;
        }

        if (usuario.rol === 'paciente') {
            const [pacientes] = await db.query(
                'SELECT codigo_id AS id, nombre, telefono FROM pacientes WHERE codigo_id = ?',
                [usuario.codigo_id]
            );
            perfil = pacientes[0] || null;
        }

        res.json({
            usuario: {
                id: usuario.codigo_id,
                email: usuario.email,
                username: usuario.username,
                rol: usuario.rol,
                creado_en: usuario.creado_en,
            },
            perfil,
        });
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener el perfil.' });
    }
};

exports.obtenerAjustesCuenta = async (req, res) => {
    try {
        const usuario = await getAccountByRoleAndId(db, req.usuario.rol, req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        let nombre = '';
        let telefono = '';
        let foto_perfil = null;

        if (usuario.rol === 'doctor') {
            const [doctores] = await db.query(
                'SELECT nombre, foto_perfil FROM doctores WHERE codigo_id = ?',
                [usuario.codigo_id]
            );
            nombre = doctores[0]?.nombre || '';
            foto_perfil = doctores[0]?.foto_perfil || null;
        }

        if (usuario.rol === 'paciente') {
            const [pacientes] = await db.query(
                'SELECT nombre, telefono, foto_perfil FROM pacientes WHERE codigo_id = ?',
                [usuario.codigo_id]
            );
            nombre = pacientes[0]?.nombre || '';
            telefono = pacientes[0]?.telefono || '';
            foto_perfil = pacientes[0]?.foto_perfil || null;
        }

        res.json({
            ajustes: {
                email: usuario.email,
                username: usuario.username,
                rol: usuario.rol,
                nombre,
                telefono,
                foto_perfil,
            },
        });
    } catch (error) {
        console.error('Error al obtener ajustes de cuenta:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los ajustes de cuenta.' });
    }
};

exports.actualizarAjustesCuenta = async (req, res) => {
    const { email, username, nombre, telefono } = req.body;

    try {
        if (!email || !String(email).trim()) {
            return res.status(400).json({ mensaje: 'El correo electrónico es requerido.' });
        }

        const usuario = await getAccountByRoleAndId(db, req.usuario.rol, req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const emailLimpio = String(email).trim();

        if (await emailExists(db, emailLimpio, { rol: usuario.rol, id: usuario.codigo_id })) {
            return res.status(409).json({ mensaje: 'Este correo ya está registrado por otro usuario.' });
        }

        const usernameLimpio = username && String(username).trim()
            ? normalizeUsername(username)
            : usuario.username;

        if (await usernameExists(db, usernameLimpio, { rol: usuario.rol, id: usuario.codigo_id })) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado por otro usuario.' });
        }

        await db.query('START TRANSACTION');

        let nombreFinal = '';
        let telefonoFinal = '';

        if (usuario.rol === 'doctor') {
            const [doctores] = await db.query(
                'SELECT nombre FROM doctores WHERE codigo_id = ?',
                [usuario.codigo_id]
            );

            if (doctores.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ mensaje: 'Perfil de doctor no encontrado.' });
            }

            nombreFinal = (typeof nombre === 'string' && nombre.trim()) ? nombre.trim() : doctores[0].nombre;

            await db.query(
                'UPDATE doctores SET email = ?, username = ?, nombre = ? WHERE codigo_id = ?',
                [emailLimpio, usernameLimpio, nombreFinal, usuario.codigo_id]
            );
        }

        if (usuario.rol === 'paciente') {
            const [pacientes] = await db.query(
                'SELECT nombre, telefono FROM pacientes WHERE codigo_id = ?',
                [usuario.codigo_id]
            );

            if (pacientes.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ mensaje: 'Perfil de paciente no encontrado.' });
            }

            nombreFinal = (typeof nombre === 'string' && nombre.trim()) ? nombre.trim() : pacientes[0].nombre;
            telefonoFinal = typeof telefono === 'string'
                ? (telefono.trim() || null)
                : (pacientes[0].telefono || null);

            await db.query(
                'UPDATE pacientes SET email = ?, username = ?, nombre = ?, telefono = ? WHERE codigo_id = ?',
                [emailLimpio, usernameLimpio, nombreFinal, telefonoFinal, usuario.codigo_id]
            );
        }

        if (usuario.rol === 'admin') {
            await db.query(
                'UPDATE admins SET email = ?, username = ? WHERE codigo_id = ?',
                [emailLimpio, usernameLimpio, usuario.codigo_id]
            );
        }

        await db.query('COMMIT');

        res.json({
            mensaje: 'Ajustes de cuenta actualizados exitosamente.',
            usuario: {
                id: usuario.codigo_id,
                email: emailLimpio,
                username: usernameLimpio,
                rol: usuario.rol,
                nombre: nombreFinal,
                telefono: telefonoFinal || '',
            },
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al actualizar ajustes de cuenta:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar los ajustes de cuenta.' });
    }
};

exports.cambiarPasswordCuenta = async (req, res) => {
    const { passwordActual, nuevaPassword, confirmarPassword } = req.body;

    try {
        if (!passwordActual || !nuevaPassword || !confirmarPassword) {
            return res.status(400).json({ mensaje: 'La contraseña actual, la nueva contraseña y su confirmación son requeridas.' });
        }

        if (String(nuevaPassword).length < 6) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }

        if (String(nuevaPassword) !== String(confirmarPassword)) {
            return res.status(400).json({ mensaje: 'La nueva contraseña y su confirmación no coinciden.' });
        }

        const usuario = await getAccountByRoleAndId(db, req.usuario.rol, req.usuario.id, true);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const passwordValida = await bcrypt.compare(passwordActual, usuario.password || '');
        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'La contraseña actual es incorrecta.' });
        }

        const passwordHash = await bcrypt.hash(String(nuevaPassword), 10);
        const tabla = getTableByRole(usuario.rol);

        await db.query(`UPDATE ${tabla} SET password = ? WHERE codigo_id = ?`, [passwordHash, usuario.codigo_id]);

        res.json({ mensaje: 'Contraseña actualizada exitosamente.' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ mensaje: 'Error interno al cambiar la contraseña.' });
    }
};

exports.eliminarMiCuenta = async (req, res) => {
    try {
        const tabla = getTableByRole(req.usuario.rol);
        const [resultado] = await db.query(`DELETE FROM ${tabla} WHERE codigo_id = ?`, [req.usuario.id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        res.json({ mensaje: 'Cuenta eliminada exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar cuenta:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar la cuenta.' });
    }
};

exports.actualizarPerfilPaciente = async (req, res) => {
    const { nombre, email } = req.body;

    try {
        if (req.usuario.rol !== 'paciente') {
            return res.status(403).json({ mensaje: 'Solo los pacientes pueden actualizar este perfil.' });
        }

        const [pacientes] = await db.query(
            'SELECT codigo_id, email, nombre, telefono FROM pacientes WHERE codigo_id = ?',
            [req.usuario.id]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'Paciente no encontrado.' });
        }

        const paciente = pacientes[0];
        const emailLimpio = email && String(email).trim() ? String(email).trim() : paciente.email;

        if (await emailExists(db, emailLimpio, { rol: 'paciente', id: paciente.codigo_id })) {
            return res.status(409).json({ mensaje: 'Este correo ya está registrado por otro usuario.' });
        }

        const nombreFinal = nombre && String(nombre).trim() ? String(nombre).trim() : paciente.nombre;
        const telefonoFinal = paciente.telefono;

        await db.query(
            'UPDATE pacientes SET email = ?, nombre = ?, telefono = ? WHERE codigo_id = ?',
            [emailLimpio, nombreFinal, telefonoFinal, paciente.codigo_id]
        );

        res.json({
            mensaje: 'Perfil actualizado exitosamente.',
            paciente: {
                id: paciente.codigo_id,
                nombre: nombreFinal,
                email: emailLimpio,
                telefono: telefonoFinal || '',
            },
        });
    } catch (error) {
        console.error('Error al actualizar perfil de paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el perfil.' });
    }
};

exports.cambiarFotoPerfil = async (req, res) => {
    const rol = req.usuario.rol;

    try {
        if (!req.file) {
            return res.status(400).json({ mensaje: 'No se proporcionó ninguna imagen.' });
        }

        const tabla = getTableByRole(rol);
        const fotoPerfil = `/uploads/perfiles/${req.file.filename}`;
        const [perfil] = await db.query(`SELECT codigo_id, foto_perfil FROM ${tabla} WHERE codigo_id = ?`, [req.usuario.id]);

        if (perfil.length === 0) {
            if (req.file) {
                fs.unlink(path.join(__dirname, '../../uploads/perfiles', req.file.filename), (err) => {
                    if (err) console.error('Error al eliminar archivo:', err);
                });
            }
            return res.status(404).json({ mensaje: `Perfil de ${rol} no encontrado.` });
        }

        if (perfil[0].foto_perfil) {
            const fotoAnterior = perfil[0].foto_perfil.replace('/uploads/perfiles/', '');
            const rutaAnterior = path.join(__dirname, '../../uploads/perfiles', fotoAnterior);
            if (fs.existsSync(rutaAnterior)) {
                fs.unlinkSync(rutaAnterior);
            }
        }

        await db.query(`UPDATE ${tabla} SET foto_perfil = ? WHERE codigo_id = ?`, [fotoPerfil, req.usuario.id]);

        res.json({
            mensaje: 'Foto de perfil actualizada exitosamente.',
            foto_perfil: fotoPerfil,
        });
    } catch (error) {
        if (req.file) {
            fs.unlink(path.join(__dirname, '../../uploads/perfiles', req.file.filename), (err) => {
                if (err) console.error('Error al eliminar archivo:', err);
            });
        }
        console.error('Error al cambiar foto de perfil:', error);
        res.status(500).json({ mensaje: 'Error interno al cambiar la foto de perfil.' });
    }
};

exports.cambiarFotoPerfilDoctorAdmin = async (req, res) => {
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
                fs.unlink(path.join(__dirname, '../../uploads/perfiles', req.file.filename), (err) => {
                    if (err) console.error('Error al eliminar archivo:', err);
                });
            }
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        const fotoPerfil = `/uploads/perfiles/${req.file.filename}`;

        if (doctores[0].foto_perfil) {
            const fotoAnterior = doctores[0].foto_perfil.replace('/uploads/perfiles/', '');
            const rutaAnterior = path.join(__dirname, '../../uploads/perfiles', fotoAnterior);
            if (fs.existsSync(rutaAnterior)) {
                fs.unlinkSync(rutaAnterior);
            }
        }

        await db.query('UPDATE doctores SET foto_perfil = ? WHERE codigo_id = ?', [fotoPerfil, doctorId]);

        res.json({
            mensaje: 'Foto de perfil del doctor actualizada exitosamente.',
            foto_perfil: fotoPerfil,
        });
    } catch (error) {
        if (req.file) {
            fs.unlink(path.join(__dirname, '../../uploads/perfiles', req.file.filename), (err) => {
                if (err) console.error('Error al eliminar archivo:', err);
            });
        }
        console.error('Error al cambiar foto de perfil del doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al cambiar la foto de perfil.' });
    }
};
