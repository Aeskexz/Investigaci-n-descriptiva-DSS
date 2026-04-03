const db = require('../db');
const { encryptFields, decryptFields } = require('../utils/encryption');
const { registrarCambio } = require('../utils/historialCambios');

const CAMPOS_SENSIBLES = ['sintomas', 'diagnostico', 'tratamiento', 'notas'];

/**
 * Verifica que el doctor llamante haya atendido alguna cita del paciente.
 */
async function doctorTieneCitaConPaciente(doctorId, pacienteId) {
    const [rows] = await db.query(
        `SELECT 1 FROM citas WHERE doctor_id = ? AND paciente_id = ? LIMIT 1`,
        [doctorId, pacienteId]
    );
    return rows.length > 0;
}

/**
 * Descifra los campos sensibles de una entrada y devuelve el objeto listo.
 */
function descifrarEntrada(row) {
    const plain = decryptFields(
        {
            sintomas: row.sintomas || '',
            diagnostico: row.diagnostico || '',
            tratamiento: row.tratamiento || '',
            notas: row.notas || '',
        },
        row.iv
    );
    return {
        id: row.id,
        paciente_id: row.paciente_id,
        doctor_id: row.doctor_id,
        doctor_nombre: row.doctor_nombre || null,
        fecha_consulta: row.fecha_consulta,
        creado_en: row.creado_en,
        sintomas: plain.sintomas,
        diagnostico: plain.diagnostico,
        tratamiento: plain.tratamiento,
        notas: plain.notas,
    };
}

/**
 * GET /api/expediente/:pacienteId
 * - Doctor: puede leer si tuvo cita con el paciente.
 * - Paciente: solo su propio expediente.
 * - Admin: metadata sin campos sensibles.
 */
exports.obtenerExpediente = async (req, res) => {
    const { pacienteId } = req.params;
    const { rol, id: callerId } = req.usuario;

    try {
        // Autorización
        if (rol === 'paciente' && callerId !== pacienteId) {
            return res.status(403).json({ mensaje: 'Solo puedes ver tu propio expediente.' });
        }

        if (rol === 'doctor') {
            const tieneCita = await doctorTieneCitaConPaciente(callerId, pacienteId);
            if (!tieneCita) {
                return res.status(403).json({ mensaje: 'Solo puedes ver el expediente de pacientes que hayas atendido.' });
            }
        }

        const [rows] = await db.query(
            `SELECT e.id, e.paciente_id, e.doctor_id,
                    d.nombre AS doctor_nombre,
                    e.fecha_consulta, e.creado_en,
                    e.sintomas, e.diagnostico, e.tratamiento, e.notas, e.iv
             FROM expediente_clinico e
             LEFT JOIN doctores d ON d.codigo_id = e.doctor_id
             WHERE e.paciente_id = ?
             ORDER BY e.fecha_consulta DESC, e.creado_en DESC`,
            [pacienteId]
        );

        if (rol === 'admin') {
            // Admin solo ve metadata
            return res.json(
                rows.map((r) => ({
                    id: r.id,
                    paciente_id: r.paciente_id,
                    doctor_id: r.doctor_id,
                    doctor_nombre: r.doctor_nombre,
                    fecha_consulta: r.fecha_consulta,
                    creado_en: r.creado_en,
                }))
            );
        }

        res.json(rows.map(descifrarEntrada));
    } catch (error) {
        console.error('Error al obtener expediente:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener el expediente.' });
    }
};

/**
 * POST /api/expediente/:pacienteId
 * Solo doctores que hayan atendido al paciente pueden agregar entradas.
 */
exports.agregarEntrada = async (req, res) => {
    const { pacienteId } = req.params;
    const { rol, id: doctorId } = req.usuario;

    if (rol !== 'doctor') {
        return res.status(403).json({ mensaje: 'Solo los doctores pueden agregar entradas al expediente.' });
    }

    const { fecha_consulta, sintomas, diagnostico, tratamiento, notas } = req.body;

    try {
        if (!fecha_consulta) {
            return res.status(400).json({ mensaje: 'La fecha de consulta es requerida.' });
        }

        // Verificar que el paciente existe
        const [pacientes] = await db.query(
            `SELECT codigo_id FROM pacientes WHERE codigo_id = ? LIMIT 1`,
            [pacienteId]
        );
        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'Paciente no encontrado.' });
        }

        // Verificar autorización del doctor
        const tieneCita = await doctorTieneCitaConPaciente(doctorId, pacienteId);
        if (!tieneCita) {
            return res.status(403).json({ mensaje: 'Solo puedes agregar entradas de pacientes que hayas atendido.' });
        }

        // Cifrar campos sensibles
        const { fields: enc, iv } = encryptFields({
            sintomas: sintomas || '',
            diagnostico: diagnostico || '',
            tratamiento: tratamiento || '',
            notas: notas || '',
        });

        const [result] = await db.query(
            `INSERT INTO expediente_clinico
                (paciente_id, doctor_id, fecha_consulta, sintomas, diagnostico, tratamiento, notas, iv)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [pacienteId, doctorId, fecha_consulta, enc.sintomas, enc.diagnostico, enc.tratamiento, enc.notas, iv]
        );

        await registrarCambio({
            tipo: 'EXPEDIENTE',
            descripcion: `Doctor ${doctorId} agregó una entrada al expediente del paciente ${pacienteId}.`,
        });

        res.status(201).json({
            mensaje: 'Entrada agregada al expediente exitosamente.',
            id: result.insertId,
        });
    } catch (error) {
        console.error('Error al agregar entrada al expediente:', error);
        res.status(500).json({ mensaje: 'Error interno al agregar la entrada.' });
    }
};

/**
 * PUT /api/expediente/:pacienteId/:entradaId
 * Solo el doctor que creó la entrada puede editarla.
 */
exports.editarEntrada = async (req, res) => {
    const { pacienteId, entradaId } = req.params;
    const { rol, id: doctorId } = req.usuario;

    if (rol !== 'doctor') {
        return res.status(403).json({ mensaje: 'Solo los doctores pueden editar entradas del expediente.' });
    }

    const { fecha_consulta, sintomas, diagnostico, tratamiento, notas } = req.body;

    try {
        const [entradas] = await db.query(
            `SELECT id, doctor_id FROM expediente_clinico WHERE id = ? AND paciente_id = ? LIMIT 1`,
            [entradaId, pacienteId]
        );

        if (entradas.length === 0) {
            return res.status(404).json({ mensaje: 'Entrada no encontrada.' });
        }

        if (entradas[0].doctor_id !== doctorId) {
            return res.status(403).json({ mensaje: 'Solo puedes editar entradas que tú creaste.' });
        }

        if (!fecha_consulta) {
            return res.status(400).json({ mensaje: 'La fecha de consulta es requerida.' });
        }

        const { fields: enc, iv } = encryptFields({
            sintomas: sintomas || '',
            diagnostico: diagnostico || '',
            tratamiento: tratamiento || '',
            notas: notas || '',
        });

        await db.query(
            `UPDATE expediente_clinico
             SET fecha_consulta = ?, sintomas = ?, diagnostico = ?, tratamiento = ?, notas = ?, iv = ?
             WHERE id = ?`,
            [fecha_consulta, enc.sintomas, enc.diagnostico, enc.tratamiento, enc.notas, iv, entradaId]
        );

        res.json({ mensaje: 'Entrada actualizada exitosamente.' });
    } catch (error) {
        console.error('Error al editar entrada del expediente:', error);
        res.status(500).json({ mensaje: 'Error interno al editar la entrada.' });
    }
};

/**
 * DELETE /api/expediente/:pacienteId/:entradaId
 * El doctor que la creó o un admin pueden eliminarla.
 */
exports.eliminarEntrada = async (req, res) => {
    const { pacienteId, entradaId } = req.params;
    const { rol, id: callerId } = req.usuario;

    try {
        const [entradas] = await db.query(
            `SELECT id, doctor_id FROM expediente_clinico WHERE id = ? AND paciente_id = ? LIMIT 1`,
            [entradaId, pacienteId]
        );

        if (entradas.length === 0) {
            return res.status(404).json({ mensaje: 'Entrada no encontrada.' });
        }

        if (rol !== 'admin' && entradas[0].doctor_id !== callerId) {
            return res.status(403).json({ mensaje: 'No tienes permiso para eliminar esta entrada.' });
        }

        await db.query(`DELETE FROM expediente_clinico WHERE id = ?`, [entradaId]);

        await registrarCambio({
            tipo: 'EXPEDIENTE',
            descripcion: `Entrada ${entradaId} del expediente del paciente ${pacienteId} eliminada por ${callerId}.`,
        });

        res.json({ mensaje: 'Entrada eliminada exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar entrada del expediente:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar la entrada.' });
    }
};
