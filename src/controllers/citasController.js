const citasService = require('../services/citasService');
const db = require('../db');


exports.obtenerCitas = async (req, res) => {
    const usuario = req.usuario;

    let query;
    let params;

    if (usuario.rol === 'admin') {
        
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


const esNombreValido = (nombre) => {
    const carPermitidos = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    return carPermitidos.test(nombre);
};


exports.crearCita = async (req, res) => {
    const usuario = req.usuario;
    const { doctor_id, razon, fecha, hora } = req.body;

    try {
        
        if (usuario.rol !== 'paciente') {
            return res.status(403).json({ mensaje: 'Solo los pacientes pueden crear citas.' });
        }

        
        if (!doctor_id || !razon || !fecha || !hora) {
            return res.status(400).json({ mensaje: 'Todos los campos son requeridos.' });
        }

        
        const [pacientes] = await db.query(
            'SELECT id FROM pacientes WHERE usuario_id = ?',
            [usuario.id]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'Perfil de paciente no encontrado.' });
        }

        const pacienteId = pacientes[0].id;

        
        const [doctores] = await db.query('SELECT id FROM doctores WHERE id = ?', [doctor_id]);
        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor especificado no existe.' });
        }

        
        const [citasExistentes] = await db.query(
            'SELECT id FROM citas WHERE doctor_id = ? AND fecha = ? AND hora = ?',
            [doctor_id, fecha, hora]
        );
        if (citasExistentes.length > 0) {
            return res.status(409).json({ mensaje: 'El doctor ya tiene una cita en esa fecha y hora.' });
        }

        
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


exports.cancelarCita = async (req, res) => {
    const { id } = req.params;
    const usuario = req.usuario;

    try {
        if (usuario.rol === 'paciente') {
            
            const pacienteId = (await db.query('SELECT id FROM pacientes WHERE usuario_id = ?', [usuario.id]))[0][0]?.id;
            
            const [citaExistente] = await db.query(
                'SELECT id FROM citas WHERE id = ? AND paciente_id = ?',
                [id, pacienteId]
            );

            if (citaExistente.length === 0) {
                return res.status(404).json({ mensaje: 'Cita no encontrada o no te pertenece.' });
            }
        } else if (usuario.rol === 'admin') {
            
            const [citaExistente] = await db.query('SELECT id FROM citas WHERE id = ?', [id]);
            if (citaExistente.length === 0) {
                return res.status(404).json({ mensaje: 'La cita no existe.' });
            }
        } else {
            return res.status(403).json({ mensaje: 'No tienes permiso para cancelar esta cita.' });
        }

        
        await db.query('DELETE FROM citas WHERE id = ?', [id]);

        res.json({ mensaje: 'Cita cancelada exitosamente.' });

    } catch (error) {
        console.error('Error al cancelar cita:', error);
        res.status(500).json({ mensaje: 'Error interno al cancelar la cita.' });
    }
};


exports.actualizarEstado = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const usuario = req.usuario;

    try {
        
        if (usuario.rol !== 'doctor') {
            return res.status(403).json({ mensaje: 'Solo los doctores pueden actualizar el estado.' });
        }

        
        const estadosValidos = ['pendiente', 'confirmada', 'cancelada', 'completada'];
        if (!estado || !estadosValidos.includes(estado)) {
            return res.status(400).json({ mensaje: 'Estado no válido.' });
        }

        
        const doctorId = (await db.query('SELECT id FROM doctores WHERE usuario_id = ?', [usuario.id]))[0][0]?.id;
        
        const [citaExistente] = await db.query(
            'SELECT id FROM citas WHERE id = ? AND doctor_id = ?',
            [id, doctorId]
        );

        if (citaExistente.length === 0) {
            return res.status(404).json({ mensaje: 'Cita no encontrada o no te pertenece.' });
        }

        
        await db.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);

        res.json({ mensaje: 'Estado actualizado exitosamente.', estado });

    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el estado.' });
    }
};
