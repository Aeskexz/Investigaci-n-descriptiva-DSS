const db = require('../db');
const { decryptFields } = require('../utils/encryption');
const { generarInformeHistorialPacientePdf } = require('../services/reportesService');

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

exports.generarPdfHistorialPaciente = async (req, res) => {
    const { pacienteId } = req.params;
    const { rol, id: callerId, email } = req.usuario;

    if (!['admin', 'doctor', 'paciente'].includes(rol)) {
        return res.status(403).json({ mensaje: 'No tienes permisos para generar este informe.' });
    }

    if (rol === 'paciente' && callerId !== pacienteId) {
        return res.status(403).json({ mensaje: 'Solo puedes generar el informe de tu propio historial.' });
    }

    try {
        const [pacientes] = await db.query(
            `SELECT codigo_id AS id, nombre, email, telefono
             FROM pacientes
             WHERE codigo_id = ?
             LIMIT 1`,
            [pacienteId]
        );

        if (pacientes.length === 0) {
            return res.status(404).json({ mensaje: 'Paciente no encontrado.' });
        }

        const paciente = pacientes[0];

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

        const historial = rows.map(descifrarEntrada);

        const generadoPor = `${rol.toUpperCase()} ${email || callerId}`;
        const { pdfPath, cleanup } = await generarInformeHistorialPacientePdf({
            paciente,
            historial,
            generadoPor,
        });

        const nombreArchivo = `informe_historial_${paciente.id}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

        const finalize = async () => {
            await cleanup();
        };

        res.on('finish', finalize);
        res.on('close', finalize);
        res.sendFile(pdfPath);
    } catch (error) {
        console.error('Error al generar informe PDF del historial medico:', error);
        res.status(500).json({
            mensaje: 'No se pudo generar el informe PDF del historial medico.',
            detalle: error.message,
        });
    }
};