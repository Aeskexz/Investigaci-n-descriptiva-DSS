const crypto = require('crypto');
const { getTableByRole } = require('./accountDirectory');

function getUserIdPrefixByRole(role) {
    if (role === 'paciente') return 'P';
    if (role === 'doctor') return 'D';
    if (role === 'admin') return 'A';
    return 'U';
}

function buildCandidate(prefix) {
    const number = crypto.randomInt(0, 100000000);
    return `${prefix}-${String(number).padStart(8, '0')}`;
}

async function userIdExists(db, role, publicId, excludeUserId = null) {
    const table = getTableByRole(role);
    if (!table) return false;

    const sql = excludeUserId
        ? `SELECT codigo_id FROM ${table} WHERE codigo_id = ? AND codigo_id <> ? LIMIT 1`
        : `SELECT codigo_id FROM ${table} WHERE codigo_id = ? LIMIT 1`;

    const params = excludeUserId ? [publicId, excludeUserId] : [publicId];
    const [rows] = await db.query(sql, params);
    return rows.length > 0;
}

async function generateUniquePublicUserId(db, role, excludeUserId = null) {
    const prefix = getUserIdPrefixByRole(role);
    let candidate = buildCandidate(prefix);

    while (await userIdExists(db, role, candidate, excludeUserId)) {
        candidate = buildCandidate(prefix);
    }

    return candidate;
}

module.exports = {
    getUserIdPrefixByRole,
    generateUniquePublicUserId,
};