const citasService = require('../services/citasService');
const db = require('../db');

async function generarCodigoCita() {
    let codigo = '';
    let existe = true;

    while (existe) {
        const random = Math.floor(Math.random() * 100000000);
        codigo = `C-${String(random).padStart(8, '0')}`;
        const [rows] = await db.query('SELECT codigo_id FROM citas WHERE codigo_id = ? LIMIT 1', [codigo]);
        existe = rows.length > 0;
    }

    return codigo;
}


exports.obtenerCitas = async (req, res) => {
    const usuario = req.usuario;

    let query;
    let params;

    if (usuario.rol === 'admin') {
        
        query = `
            SELECT c.codigo_id AS id, c.razon, c.fecha, c.hora, c.estado,
                   p.nombre AS paciente_nombre,
                   d.nombre AS doctor_nombre, d.especialidad
            FROM citas c
            JOIN pacientes p ON c.paciente_id = p.codigo_id
            JOIN doctores d ON c.doctor_id = d.codigo_id
            ORDER BY c.fecha, c.hora
        `;
        params = [];
    } else if (usuario.rol === 'paciente') {
        
        query = `
            SELECT c.codigo_id AS id, c.razon, c.fecha, c.hora, c.estado,
                   d.nombre AS doctor_nombre, d.especialidad
            FROM citas c
            JOIN doctores d ON c.doctor_id = d.codigo_id
            WHERE c.paciente_id = ?
            ORDER BY c.fecha, c.hora
        `;
        params = [usuario.id];
    } else if (usuario.rol === 'doctor') {
        
        query = `
            SELECT c.codigo_id AS id, c.razon, c.fecha, c.hora, c.estado,
                   p.codigo_id AS paciente_id, p.nombre AS paciente_nombre,
                   p.username AS paciente_username, p.email AS paciente_email, p.telefono
            FROM citas c
            JOIN pacientes p ON c.paciente_id = p.codigo_id
            WHERE c.doctor_id = ?
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

        
        const pacienteId = usuario.id;

        
        const [doctores] = await db.query('SELECT codigo_id FROM doctores WHERE codigo_id = ?', [doctor_id]);
        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor especificado no existe.' });
        }

        
        const [citasExistentes] = await db.query(
            'SELECT codigo_id FROM citas WHERE doctor_id = ? AND fecha = ? AND hora = ?',
            [doctor_id, fecha, hora]
        );
        if (citasExistentes.length > 0) {
            return res.status(409).json({ mensaje: 'El doctor ya tiene una cita en esa fecha y hora.' });
        }

        
        const citaCodigo = await generarCodigoCita();

        const [resultado] = await db.query(
            'INSERT INTO citas (codigo_id, paciente_id, doctor_id, razon, fecha, hora, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [citaCodigo, pacienteId, doctor_id, razon, fecha, hora, 'pendiente']
        );

        res.status(201).json({
            mensaje: 'Cita creada exitosamente.',
            cita: {
                id: citaCodigo,
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
            const pacienteId = usuario.id;
            
            const [citaExistente] = await db.query(
                'SELECT codigo_id FROM citas WHERE codigo_id = ? AND paciente_id = ?',
                [id, pacienteId]
            );

            if (citaExistente.length === 0) {
                return res.status(404).json({ mensaje: 'Cita no encontrada o no te pertenece.' });
            }
        } else if (usuario.rol === 'admin') {
            
            const [citaExistente] = await db.query('SELECT codigo_id FROM citas WHERE codigo_id = ?', [id]);
            if (citaExistente.length === 0) {
                return res.status(404).json({ mensaje: 'La cita no existe.' });
            }
        } else {
            return res.status(403).json({ mensaje: 'No tienes permiso para cancelar esta cita.' });
        }

        
        await db.query('DELETE FROM citas WHERE codigo_id = ?', [id]);

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

        
        const doctorId = usuario.id;
        
        const [citaExistente] = await db.query(
            'SELECT codigo_id FROM citas WHERE codigo_id = ? AND doctor_id = ?',
            [id, doctorId]
        );

        if (citaExistente.length === 0) {
            return res.status(404).json({ mensaje: 'Cita no encontrada o no te pertenece.' });
        }

        
        await db.query('UPDATE citas SET estado = ? WHERE codigo_id = ?', [estado, id]);

        res.json({ mensaje: 'Estado actualizado exitosamente.', estado });

    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el estado.' });
    }
};
