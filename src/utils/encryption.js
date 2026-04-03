const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

/**
 * Derives a consistent 32-byte key from the env variable.
 * If ENCRYPTION_KEY is 64 hex chars it's used directly.
 * Otherwise it's hashed with SHA-256 to produce 32 bytes.
 * If no env var is present a deterministic dev-only key is used.
 */
function getKey() {
    const raw = process.env.ENCRYPTION_KEY || '';

    if (!raw) {
        return crypto.createHash('sha256').update('dss-dev-key-insecure').digest();
    }

    const hexBuf = Buffer.from(raw, 'hex');
    if (hexBuf.length === 32) return hexBuf;

    return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a string value.
 * Returns { ciphertext: string(hex), iv: string(hex) }
 */
function encrypt(text) {
    const key = getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(text == null ? '' : text), 'utf8'),
        cipher.final(),
    ]);
    return {
        ciphertext: encrypted.toString('hex'),
        iv: iv.toString('hex'),
    };
}

/**
 * Decrypts a hex ciphertext using the given hex IV.
 * Returns the original string or '[Error al descifrar]' on failure.
 */
function decrypt(ciphertextHex, ivHex) {
    try {
        const key = getKey();
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(ciphertextHex, 'hex')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    } catch {
        return '[Error al descifrar]';
    }
}

/**
 * Encrypts multiple fields using a single shared IV per record.
 * Returns { fields: { campo: ciphertext_hex, ... }, iv: iv_hex }
 */
function encryptFields(fieldMap) {
    const key = getKey();
    const iv = crypto.randomBytes(16);
    const ivHex = iv.toString('hex');
    const result = {};

    for (const [campo, valor] of Object.entries(fieldMap)) {
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const enc = Buffer.concat([
            cipher.update(String(valor == null ? '' : valor), 'utf8'),
            cipher.final(),
        ]);
        result[campo] = enc.toString('hex');
    }

    return { fields: result, iv: ivHex };
}

/**
 * Decrypts multiple fields that share a single IV.
 * fieldMap: { campo: ciphertext_hex, ... }
 * Returns { campo: plaintext, ... }
 */
function decryptFields(fieldMap, ivHex) {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const result = {};

    for (const [campo, ciphertextHex] of Object.entries(fieldMap)) {
        try {
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            const dec = Buffer.concat([
                decipher.update(Buffer.from(ciphertextHex, 'hex')),
                decipher.final(),
            ]);
            result[campo] = dec.toString('utf8');
        } catch {
            result[campo] = '[Error al descifrar]';
        }
    }

    return result;
}

module.exports = { encrypt, decrypt, encryptFields, decryptFields };
