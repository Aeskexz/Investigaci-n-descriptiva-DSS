const db = require('../db');

exports.obtenerDoctores = async (req, res) => {
    const [doctores] = await db.query('SELECT id, nombre, especialidad FROM doctores');
    res.json(doctores);
};
