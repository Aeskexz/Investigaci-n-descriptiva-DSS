const db = require('../db');

async function registrarCambio({ tipo, descripcion }) {
    if (!tipo || !descripcion) return;

    await db.query(
        'INSERT INTO historial_cambios (tipo, descripcion) VALUES (?, ?)',
        [String(tipo).trim().toUpperCase(), String(descripcion).trim()]
    );
}

module.exports = {
    registrarCambio,
};
