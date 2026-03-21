const db = require('../db');


exports.obtenerDoctores = async (req, res) => {
    const [doctores] = await db.query(`
        SELECT d.id, d.nombre, d.especialidad, d.foto_perfil
        FROM doctores d
        ORDER BY d.nombre
    `);
    res.json(doctores);
};
