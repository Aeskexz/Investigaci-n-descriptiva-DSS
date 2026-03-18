const citasService = require('../services/citasService');
const db = require('../db');

// Obtener citas (cada usuario ve las suyas)
exports.obtenerCitas = async (req, res) => {
    const usuario = req.usuario;

    let query;
    let params;

    if (usuario.rol === 'admin') {
        // Admin ve todas las citas
        query = `
            SELECT c.id, c.razon, c.fecha, c.hora, c.estado,
                   p.nombre AS paciente_nombre,
                   d.nombre AS doctor_nombre, d.especialidad
            FROM citas c
            JOIN pacientes p ON c.paciente_id = p.id
            JOIN doctores d ON c.doctor_id = d.id
            ORDER BY c.fecha, c.hora
        `;
        params = [];
    } else if (usuario.rol === 'paciente') {
        // Paciente ve solo sus citas
        query = `
            SELECT c.id, c.razon, c.fecha, c.hora, c.estado,
                   d.nombre AS doctor_nombre, d.especialidad
            FROM citas c
            JOIN doctores d ON c.doctor_id = d.id
            WHERE c.paciente_id = (SELECT id FROM pacientes WHERE usuario_id = ?)
            ORDER BY c.fecha, c.hora
        `;
        params = [usuario.id];
    } else if (usuario.rol === 'doctor') {
        // Doctor ve solo sus citas
        query = `
            SELECT c.id, c.razon, c.fecha, c.hora, c.estado,
                   p.nombre AS paciente_nombre, p.telefono
            FROM citas c
            JOIN pacientes p ON c.paciente_id = p.id
            WHERE c.doctor_id = (SELECT id FROM doctores WHERE usuario_id = ?)
            ORDER BY c.fecha, c.hora
        `;
        params = [usuario.id];
    }

    const [citas] = await db.query(query, params);
    res.json(citas);
};

// Función para validar que el nombre solo contenga letras
const esNombreValido = (nombre) => {
    const carPermitidos = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    return carPermitidos.test(nombre);
};

// Crear cita (solo pacientes)
exports.crearCita = async (req, res) => {
    const usuario = req.usuario;
    const { doctor_id, razon, fecha, hora } = req.body;

    try {
        // Solo pacientes pueden crear citas
        if (usuario.rol !== 'paciente') {
            return res.status(403).json({ mensaje: 'Solo los pacientes pueden crear citas.' });
        }

        // Validar campos requeridos
        if (!doctor_id || !razon || !fecha || !hora) {
            return res.status(400).json({ mensaje: 'Todos los campos son requeridos.' });
        }

        // Obtener paciente_id del usuario
        const [pacientes] = await db.query(
            'SELECT id FROM pacientes WHERE usuario_id = ?',
            [usuario.id]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'Perfil de paciente no encontrado.' });
        }

        const pacienteId = pacientes[0].id;

        // Verificar que el doctor existe
        const [doctores] = await db.query('SELECT id FROM doctores WHERE id = ?', [doctor_id]);
        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor especificado no existe.' });
        }

        // Verificar disponibilidad
        const [citasExistentes] = await db.query(
            'SELECT id FROM citas WHERE doctor_id = ? AND fecha = ? AND hora = ?',
            [doctor_id, fecha, hora]
        );
        if (citasExistentes.length > 0) {
            return res.status(409).json({ mensaje: 'El doctor ya tiene una cita en esa fecha y hora.' });
        }

        // Insertar la cita
        const [resultado] = await db.query(
            'INSERT INTO citas (paciente_id, doctor_id, razon, fecha, hora, estado) VALUES (?, ?, ?, ?, ?, ?)',
            [pacienteId, doctor_id, razon, fecha, hora, 'pendiente']
        );

        res.status(201).json({
            mensaje: 'Cita creada exitosamente.',
            cita: {
                id: resultado.insertId,
                doctor_id,
                razon,
                fecha,
                hora,
                estado: 'pendiente'
            }
        });

    } catch (error) {
        console.error('Error al crear cita:', error);
        res.status(500).json({ mensaje: 'Error interno al crear la cita.' });
    }
};

// Cancelar cita (paciente puede cancelar las suyas)
exports.cancelarCita = async (req, res) => {
    const { id } = req.params;
    const usuario = req.usuario;

    try {
        if (usuario.rol === 'paciente') {
            // Verificar que la cita pertenece al paciente
            const pacienteId = (await db.query('SELECT id FROM pacientes WHERE usuario_id = ?', [usuario.id]))[0][0]?.id;
            
            const [citaExistente] = await db.query(
                'SELECT id FROM citas WHERE id = ? AND paciente_id = ?',
                [id, pacienteId]
            );

            if (citaExistente.length === 0) {
                return res.status(404).json({ mensaje: 'Cita no encontrada o no te pertenece.' });
            }
        } else if (usuario.rol === 'admin') {
            // Admin puede cancelar cualquier cita
            const [citaExistente] = await db.query('SELECT id FROM citas WHERE id = ?', [id]);
            if (citaExistente.length === 0) {
                return res.status(404).json({ mensaje: 'La cita no existe.' });
            }
        } else {
            return res.status(403).json({ mensaje: 'No tienes permiso para cancelar esta cita.' });
        }

        // Eliminar la cita
        await db.query('DELETE FROM citas WHERE id = ?', [id]);

        res.json({ mensaje: 'Cita cancelada exitosamente.' });

    } catch (error) {
        console.error('Error al cancelar cita:', error);
        res.status(500).json({ mensaje: 'Error interno al cancelar la cita.' });
    }
};

// Actualizar estado de la cita (solo doctor)
exports.actualizarEstado = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const usuario = req.usuario;

    try {
        // Solo doctores pueden actualizar el estado
        if (usuario.rol !== 'doctor') {
            return res.status(403).json({ mensaje: 'Solo los doctores pueden actualizar el estado.' });
        }

        // Validar estado
        const estadosValidos = ['pendiente', 'confirmada', 'cancelada', 'completada'];
        if (!estado || !estadosValidos.includes(estado)) {
            return res.status(400).json({ mensaje: 'Estado no válido.' });
        }

        // Verificar que la cita pertenece al doctor
        const doctorId = (await db.query('SELECT id FROM doctores WHERE usuario_id = ?', [usuario.id]))[0][0]?.id;
        
        const [citaExistente] = await db.query(
            'SELECT id FROM citas WHERE id = ? AND doctor_id = ?',
            [id, doctorId]
        );

        if (citaExistente.length === 0) {
            return res.status(404).json({ mensaje: 'Cita no encontrada o no te pertenece.' });
        }

        // Actualizar estado
        await db.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);

        res.json({ mensaje: 'Estado actualizado exitosamente.', estado });

    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el estado.' });
    }
};
