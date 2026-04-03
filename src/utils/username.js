const { usernameExists: usernameExistsAcrossTables } = require('./accountDirectory');

function normalizeUsername(value) {
    const baseValue = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const normalized = baseValue
        .replace(/[^a-z0-9._-]/g, '')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 40);

    return normalized || 'usuario';
}

async function usernameExists(db, username, excludeUserId = null) {
    const normalized = normalizeUsername(username);
    const excludeAccount = excludeUserId && typeof excludeUserId === 'object' ? excludeUserId : null;
    return usernameExistsAcrossTables(db, normalized, excludeAccount);
}

async function generateUniqueUsername(db, seed, excludeUserId = null) {
    const normalizedSeed = normalizeUsername(seed);
    let candidate = normalizedSeed;
    let sequence = 1;

    while (await usernameExists(db, candidate, excludeUserId)) {
        candidate = `${normalizedSeed}${sequence}`.slice(0, 40);
        sequence += 1;
    }

    return candidate;
}

module.exports = {
    normalizeUsername,
    generateUniqueUsername,
    usernameExists,
};