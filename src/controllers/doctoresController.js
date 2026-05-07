const db = require('../db');


exports.obtenerDoctores = async (req, res) => {
    const [doctores] = await db.query(`
        SELECT d.codigo_id AS id, d.nombre, d.especialidad, d.foto_perfil
        FROM doctores d
        WHERE COALESCE(d.disponible_consulta, 1) = 1
        ORDER BY d.nombre
    `);
    res.json(doctores);
};
