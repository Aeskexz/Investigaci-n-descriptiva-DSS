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

exports.obtenerDisponibilidadDoctor = async (req, res) => {
    const { doctor_id, fecha_inicio } = req.query;

    try {
        if (req.usuario.rol !== 'paciente') {
            return res.status(403).json({ mensaje: 'Solo los pacientes pueden consultar disponibilidad.' });
        }

        if (!doctor_id) {
            return res.status(400).json({ mensaje: 'El doctor es requerido.' });
        }

        const [doctores] = await db.query('SELECT codigo_id FROM doctores WHERE codigo_id = ? LIMIT 1', [doctor_id]);
        if (doctores.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor especificado no existe.' });
        }

        const baseDate = fecha_inicio
            ? new Date(`${String(fecha_inicio)}T00:00:00`)
            : new Date();

        if (Number.isNaN(baseDate.getTime())) {
            return res.status(400).json({ mensaje: 'Fecha de inicio no válida.' });
        }

        const mondayOffset = (baseDate.getDay() + 6) % 7;
        baseDate.setDate(baseDate.getDate() - mondayOffset);

        const inicioSemana = new Date(baseDate);
        const finSemana = new Date(baseDate);
        finSemana.setDate(finSemana.getDate() + 6);

        const toIsoDate = (dateObj) => dateObj.toISOString().slice(0, 10);
        const inicioIso = toIsoDate(inicioSemana);
        const finIso = toIsoDate(finSemana);

        const [ocupadas] = await db.query(
            `SELECT fecha, hora
             FROM citas
             WHERE doctor_id = ?
               AND fecha BETWEEN ? AND ?
               AND estado <> 'cancelada'`,
            [doctor_id, inicioIso, finIso]
        );

        const [asuetosSemana] = await db.query(
            `SELECT fecha, tipo, motivo
             FROM dias_asueto
             WHERE fecha BETWEEN ? AND ?`,
            [inicioIso, finIso]
        );

        const formatearFechaSql = (value) => {
            if (!value) return '';

            if (value instanceof Date) {
                const y = value.getFullYear();
                const m = String(value.getMonth() + 1).padStart(2, '0');
                const d = String(value.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }

            return String(value).slice(0, 10);
        };

        const ocupadasSet = new Set(
            ocupadas.map((c) => `${formatearFechaSql(c.fecha)}|${String(c.hora).slice(0, 5)}`)
        );

        const asuetosMap = new Map(
            asuetosSemana.map((a) => [formatearFechaSql(a.fecha), { tipo: a.tipo, motivo: a.motivo }])
        );

        const slotsPorDia = (diaSemana) => {
            if (diaSemana === 0) return [];
            if (diaSemana === 6) return ['08:00', '09:00', '10:00', '11:00'];
            return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
        };

        const dias = [];
        for (let i = 0; i < 7; i += 1) {
            const current = new Date(inicioSemana);
            current.setDate(inicioSemana.getDate() + i);

            const fecha = toIsoDate(current);
            const diaSemana = current.getDay();
            const asuetoInfo = asuetosMap.get(fecha);

            if (asuetoInfo) {
                dias.push({
                    fecha,
                    dia_semana: diaSemana,
                    slots: [],
                    asueto: true,
                    tipo: asuetoInfo.tipo,
                    motivo: asuetoInfo.motivo,
                });
                continue;
            }

            const slots = slotsPorDia(diaSemana).map((hora) => ({
                hora,
                disponible: !ocupadasSet.has(`${fecha}|${hora}`),
            }));

            dias.push({ fecha, dia_semana: diaSemana, slots });
        }

        return res.json({
            doctor_id,
            fecha_inicio: inicioIso,
            fecha_fin: finIso,
            dias,
        });
    } catch (error) {
        console.error('Error al obtener disponibilidad:', error);
        return res.status(500).json({ mensaje: 'Error interno al consultar la disponibilidad.' });
    }
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

        const [asuetoDia] = await db.query(
            'SELECT id, tipo, motivo FROM dias_asueto WHERE fecha = ? LIMIT 1',
            [fecha]
        );

        if (asuetoDia.length > 0) {
            return res.status(409).json({ mensaje: 'La clinica no atiende en esa fecha por asueto/vacaciones.' });
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
