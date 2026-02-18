const citasService = require('../services/citasService');
const db = require('../db');

exports.obtenerCitas = async (req, res) => {
    const [citas] = await db.query(`
        SELECT c.id, c.paciente, c.razon, c.fecha, c.hora,
               d.nombre AS doctor, d.especialidad
        FROM citas c
        JOIN doctores d ON c.doctor_id = d.id
        ORDER BY c.fecha, c.hora
    `);
    res.json(citas);
};

exports.crearCita = async (req, res) => {
    const datosCita = req.body;

    // Validar disponibilidad (día y horario)
    const resultado = citasService.validarDisponibilidad(datosCita);
    if (!resultado.disponible) {
        return res.status(400).json({ mensaje: resultado.mensaje });
    }

    const { paciente, razon, fecha, hora, doctor_id } = datosCita;

    // Verificar que el doctor existe
    const [doctores] = await db.query('SELECT id FROM doctores WHERE id = ?', [doctor_id]);
    if (doctores.length === 0) {
        return res.status(404).json({ mensaje: 'El doctor especificado no existe.' });
    }

    // Verificar que el doctor no tenga ya una cita en esa fecha y hora
    const [citasExistentes] = await db.query(
        'SELECT id FROM citas WHERE doctor_id = ? AND fecha = ? AND hora = ?',
        [doctor_id, fecha, hora]
    );
    if (citasExistentes.length > 0) {
        return res.status(409).json({ mensaje: 'El doctor ya tiene una cita en esa fecha y hora.' });
    }

    // Insertar la cita en la base de datos
    const [resultado_insert] = await db.query(
        'INSERT INTO citas (paciente, razon, fecha, hora, doctor_id) VALUES (?, ?, ?, ?, ?)',
        [paciente, razon, fecha, hora, doctor_id]
    );

    res.status(201).json({
        mensaje: '✅ Cita creada exitosamente.',
        cita: {
            id: resultado_insert.insertId,
            paciente,
            razon,
            fecha,
            hora,
            doctor_id
        }
    });
};
