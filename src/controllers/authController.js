const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateUniqueUsername, normalizeUsername, usernameExists } = require('../utils/username');
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
            [email, usernameCandidate, passwordHash, rol]
        );

        const usuarioId = resultadoUsuario.insertId;

        
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
                username: usernameCandidate,
                rol
            }
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

        
        const isEmailLogin = loginIdentifier.includes('@');
        const [usuarios] = isEmailLogin
            ? await db.query(
                'SELECT id, email, username, password, rol FROM usuarios WHERE email = ? LIMIT 1',
                [loginIdentifier]
            )
            : await db.query(
                'SELECT id, email, username, password, rol FROM usuarios WHERE username = ? LIMIT 1',
                [normalizeUsername(loginIdentifier)]
            );

        if (usuarios.length === 0) {
            return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
        }

        const usuario = usuarios[0];

        
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Email o contraseña incorrectos.' });
        }

        
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
                username: usuario.username,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error al hacer login:', error);
        res.status(500).json({ mensaje: 'Error interno al hacer login.' });
    }
};


exports.obtenerPerfil = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const [usuarios] = await db.query(
            'SELECT id, email, username, rol, creado_en FROM usuarios WHERE id = ?',
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
                username: usuario.username,
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


exports.obtenerAjustesCuenta = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const [usuarios] = await db.query(
            'SELECT id, email, username, rol FROM usuarios WHERE id = ?',
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const usuario = usuarios[0];
        let nombre = '';
        let telefono = '';
        let foto_perfil = null;

        if (usuario.rol === 'doctor') {
            const [doctores] = await db.query(
                'SELECT nombre, foto_perfil FROM doctores WHERE usuario_id = ?',
                [usuarioId]
            );
            nombre = doctores[0]?.nombre || '';
            foto_perfil = doctores[0]?.foto_perfil || null;
        } else if (usuario.rol === 'paciente') {
            const [pacientes] = await db.query(
                'SELECT nombre, telefono, foto_perfil FROM pacientes WHERE usuario_id = ?',
                [usuarioId]
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
                foto_perfil
            }
        });
    } catch (error) {
        console.error('Error al obtener ajustes de cuenta:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los ajustes de cuenta.' });
    }
};


exports.actualizarAjustesCuenta = async (req, res) => {
    const usuarioId = req.usuario.id;
    const { email, username, nombre, telefono } = req.body;

    try {
        if (!email || !String(email).trim()) {
            return res.status(400).json({ mensaje: 'El correo electrónico es requerido.' });
        }

        const emailLimpio = String(email).trim();

        const [usuarios] = await db.query(
            'SELECT id, email, username, rol FROM usuarios WHERE id = ?',
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const usuario = usuarios[0];

        const [emailDuplicado] = await db.query(
            'SELECT id FROM usuarios WHERE email = ? AND id <> ?',
            [emailLimpio, usuarioId]
        );

        if (emailDuplicado.length > 0) {
            return res.status(409).json({ mensaje: 'Este correo ya está registrado por otro usuario.' });
        }

        const usernameLimpio = username && String(username).trim()
            ? normalizeUsername(username)
            : usuario.username;

        const usernameDuplicado = await usernameExists(db, usernameLimpio, usuarioId);
        if (usernameDuplicado) {
            return res.status(409).json({ mensaje: 'Este nombre de usuario ya está registrado por otro usuario.' });
        }

        await db.query('START TRANSACTION');

        await db.query('UPDATE usuarios SET email = ?, username = ? WHERE id = ?', [emailLimpio, usernameLimpio, usuarioId]);

        let nombreFinal = '';
        let telefonoFinal = '';

        if (usuario.rol === 'doctor') {
            const [doctores] = await db.query(
                'SELECT nombre FROM doctores WHERE usuario_id = ?',
                [usuarioId]
            );

            if (doctores.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ mensaje: 'Perfil de doctor no encontrado.' });
            }

            nombreFinal = (typeof nombre === 'string' && nombre.trim()) ? nombre.trim() : doctores[0].nombre;

            await db.query(
                'UPDATE doctores SET nombre = ? WHERE usuario_id = ?',
                [nombreFinal, usuarioId]
            );
        } else if (usuario.rol === 'paciente') {
            const [pacientes] = await db.query(
                'SELECT nombre, telefono FROM pacientes WHERE usuario_id = ?',
                [usuarioId]
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
                'UPDATE pacientes SET nombre = ?, telefono = ? WHERE usuario_id = ?',
                [nombreFinal, telefonoFinal, usuarioId]
            );
        }

        await db.query('COMMIT');

        res.json({
            mensaje: 'Ajustes de cuenta actualizados exitosamente.',
            usuario: {
                id: usuarioId,
                email: emailLimpio,
                username: usernameLimpio,
                rol: usuario.rol,
                nombre: nombreFinal,
                telefono: telefonoFinal || ''
            }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al actualizar ajustes de cuenta:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar los ajustes de cuenta.' });
    }
};


exports.cambiarPasswordCuenta = async (req, res) => {
    const usuarioId = req.usuario.id;
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

        const [usuarios] = await db.query(
            'SELECT id, password FROM usuarios WHERE id = ?',
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        const passwordValida = await bcrypt.compare(passwordActual, usuarios[0].password);
        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'La contraseña actual es incorrecta.' });
        }

        const passwordHash = await bcrypt.hash(String(nuevaPassword), 10);

        await db.query('UPDATE usuarios SET password = ? WHERE id = ?', [passwordHash, usuarioId]);

        res.json({ mensaje: 'Contraseña actualizada exitosamente.' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ mensaje: 'Error interno al cambiar la contraseña.' });
    }
};


exports.eliminarMiCuenta = async (req, res) => {
    const usuarioId = req.usuario.id;

    try {
        const [resultado] = await db.query('DELETE FROM usuarios WHERE id = ?', [usuarioId]);

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
    const usuarioId = req.usuario.id;
    const { nombre, email } = req.body;

    try {
        const [usuarios] = await db.query(
            'SELECT id, email, username, rol FROM usuarios WHERE id = ?',
            [usuarioId]
        );

        if (usuarios.length === 0 || usuarios[0].rol !== 'paciente') {
            return res.status(404).json({ mensaje: 'Paciente no encontrado.' });
        }

        const emailLimpio = email && String(email).trim() ? String(email).trim() : usuarios[0].email;

        const [emailDuplicado] = await db.query(
            'SELECT id FROM usuarios WHERE email = ? AND id <> ?',
            [emailLimpio, usuarioId]
        );

        if (emailDuplicado.length > 0) {
            return res.status(409).json({ mensaje: 'Este correo ya está registrado por otro usuario.' });
        }

        const [pacientes] = await db.query(
            'SELECT id, nombre, telefono FROM pacientes WHERE usuario_id = ?',
            [usuarioId]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'Perfil de paciente no encontrado.' });
        }

        const nombreFinal = nombre && String(nombre).trim() ? String(nombre).trim() : pacientes[0].nombre;
        const telefonoFinal = pacientes[0].telefono;

        await db.query('START TRANSACTION');

        await db.query('UPDATE usuarios SET email = ? WHERE id = ?', [emailLimpio, usuarioId]);

        await db.query(
            'UPDATE pacientes SET nombre = ?, telefono = ? WHERE usuario_id = ?',
            [nombreFinal, telefonoFinal, usuarioId]
        );

        await db.query('COMMIT');

        res.json({
            mensaje: 'Perfil actualizado exitosamente.',
            paciente: {
                id: pacientes[0].id,
                nombre: nombreFinal,
                email: emailLimpio,
                telefono: telefonoFinal || ''
            }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error al actualizar perfil de paciente:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el perfil.' });
    }
};


exports.cambiarFotoPerfil = async (req, res) => {
    const usuarioId = req.usuario.id;
    const rol = req.usuario.rol;

    try {
        if (!req.file) {
            return res.status(400).json({ mensaje: 'No se proporcionó ninguna imagen.' });
        }

        const fotoPerfil = `/uploads/perfiles/${req.file.filename}`;

        const tabla = rol === 'doctor' ? 'doctores' : 'pacientes';
        const [perfil] = await db.query(`SELECT id, foto_perfil FROM ${tabla} WHERE usuario_id = ?`, [usuarioId]);

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

        await db.query(`UPDATE ${tabla} SET foto_perfil = ? WHERE usuario_id = ?`, [fotoPerfil, usuarioId]);

        res.json({
            mensaje: 'Foto de perfil actualizada exitosamente.',
            foto_perfil: fotoPerfil
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
            'SELECT id, usuario_id, foto_perfil FROM doctores WHERE id = ?',
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

        await db.query('UPDATE doctores SET foto_perfil = ? WHERE id = ?', [fotoPerfil, doctorId]);

        res.json({
            mensaje: 'Foto de perfil del doctor actualizada exitosamente.',
            foto_perfil: fotoPerfil
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
