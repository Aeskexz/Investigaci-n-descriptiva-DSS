const ROLE_TABLE_MAP = {
    admin: 'admins',
    doctor: 'doctores',
    paciente: 'pacientes',
};

const ROLE_SCAN_ORDER = ['admin', 'doctor', 'paciente'];

function getTableByRole(role) {
    return ROLE_TABLE_MAP[role] || null;
}

async function existsInTableByField(db, table, field, value, excludeCodigoId = null) {
    const sql = excludeCodigoId
        ? `SELECT codigo_id FROM ${table} WHERE ${field} = ? AND codigo_id <> ? LIMIT 1`
        : `SELECT codigo_id FROM ${table} WHERE ${field} = ? LIMIT 1`;

    const params = excludeCodigoId ? [value, excludeCodigoId] : [value];
    const [rows] = await db.query(sql, params);
    return rows.length > 0;
}

async function emailExists(db, email, excludeAccount = null) {
    for (const role of ROLE_SCAN_ORDER) {
        const table = getTableByRole(role);
        const excludeCodigoId = excludeAccount && excludeAccount.rol === role ? excludeAccount.id : null;
        if (await existsInTableByField(db, table, 'email', email, excludeCodigoId)) {
            return true;
        }
    }
    return false;
}

async function usernameExists(db, username, excludeAccount = null) {
    for (const role of ROLE_SCAN_ORDER) {
        const table = getTableByRole(role);
        const excludeCodigoId = excludeAccount && excludeAccount.rol === role ? excludeAccount.id : null;
        if (await existsInTableByField(db, table, 'username', username, excludeCodigoId)) {
            return true;
        }
    }
    return false;
}

async function findAccountByIdentifier(db, identifier, normalizedUsername = null) {
    const isEmail = String(identifier).includes('@');
    const value = isEmail ? String(identifier).trim() : String(normalizedUsername || identifier).trim();
    const field = isEmail ? 'email' : 'username';

    for (const role of ROLE_SCAN_ORDER) {
        const table = getTableByRole(role);
        const [rows] = await db.query(
            `SELECT codigo_id, email, username, password, creado_en FROM ${table} WHERE ${field} = ? LIMIT 1`,
            [value]
        );

        if (rows.length > 0) {
            return { ...rows[0], rol: role };
        }
    }

    return null;
}

async function getAccountByRoleAndId(db, role, codigoId, includePassword = false) {
    const table = getTableByRole(role);
    if (!table) return null;

    const fields = includePassword
        ? 'codigo_id, email, username, password, creado_en'
        : 'codigo_id, email, username, creado_en';

    const [rows] = await db.query(
        `SELECT ${fields} FROM ${table} WHERE codigo_id = ? LIMIT 1`,
        [codigoId]
    );

    if (rows.length === 0) return null;
    return { ...rows[0], rol: role };
}

module.exports = {
    getTableByRole,
    emailExists,
    usernameExists,
    findAccountByIdentifier,
    getAccountByRoleAndId,
};