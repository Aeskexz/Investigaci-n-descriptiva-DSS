const db = require('../db');

exports.obtenerDoctores = async (req, res) => {
    const [doctores] = await db.query('SELECT id, nombre, especialidad FROM doctores');
    res.json(doctores);
};

exports.crearDoctor = async (req, res) => {
    const { nombre, especialidad } = req.body;

    try {
        // Validar que los campos no estén vacíos
        if (!nombre || !especialidad) {
            return res.status(400).json({ mensaje: 'Nombre y especialidad son requeridos.' });
        }

        // Verificar que no existe un doctor con el mismo nombre
        const [doctoresExistentes] = await db.query('SELECT id FROM doctores WHERE nombre = ?', [nombre]);
        if (doctoresExistentes.length > 0) {
            return res.status(409).json({ mensaje: 'Un doctor con este nombre ya existe.' });
        }

        // Insertar el nuevo doctor
        const [resultado] = await db.query(
            'INSERT INTO doctores (nombre, especialidad) VALUES (?, ?)',
            [nombre, especialidad]
        );

        res.status(201).json({
            mensaje: 'Doctor agregado exitosamente.',
            doctor: {
                id: resultado.insertId,
                nombre,
                especialidad
            }
        });

    } catch (error) {
        console.error('Error al crear doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al crear el doctor.' });
    }
};

exports.actualizarDoctor = async (req, res) => {
    const { id } = req.params;
    const { nombre, especialidad } = req.body;

    try {
        // Validar que los campos no estén vacíos
        if (!nombre || !especialidad) {
            return res.status(400).json({ mensaje: 'Nombre y especialidad son requeridos.' });
        }

        // Verificar que el doctor existe
        const [doctorExistente] = await db.query('SELECT id FROM doctores WHERE id = ?', [id]);
        if (doctorExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        // Verificar que no existe otro doctor con el mismo nombre
        const [doctoresConMismoNombre] = await db.query(
            'SELECT id FROM doctores WHERE nombre = ? AND id != ?',
            [nombre, id]
        );
        if (doctoresConMismoNombre.length > 0) {
            return res.status(409).json({ mensaje: 'Otro doctor ya tiene este nombre.' });
        }

        // Actualizar el doctor
        await db.query(
            'UPDATE doctores SET nombre = ?, especialidad = ? WHERE id = ?',
            [nombre, especialidad, id]
        );

        res.json({
            mensaje: 'Doctor actualizado exitosamente.',
            doctor: {
                id,
                nombre,
                especialidad
            }
        });

    } catch (error) {
        console.error('Error al actualizar doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el doctor.' });
    }
};

exports.eliminarDoctor = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar que el doctor existe
        const [doctorExistente] = await db.query('SELECT id FROM doctores WHERE id = ?', [id]);
        if (doctorExistente.length === 0) {
            return res.status(404).json({ mensaje: 'El doctor no existe.' });
        }

        // Verificar que el doctor no tiene citas asignadas
        const [citasDoctor] = await db.query('SELECT id FROM citas WHERE doctor_id = ?', [id]);
        if (citasDoctor.length > 0) {
            return res.status(409).json({ mensaje: 'No se puede eliminar un doctor que tiene citas asignadas.' });
        }

        // Eliminar el doctor
        await db.query('DELETE FROM doctores WHERE id = ?', [id]);

        res.json({
            mensaje: 'Doctor eliminado exitosamente.'
        });

    } catch (error) {
        console.error('Error al eliminar doctor:', error);
        res.status(500).json({ mensaje: 'Error interno al eliminar el doctor.' });
    }
};
