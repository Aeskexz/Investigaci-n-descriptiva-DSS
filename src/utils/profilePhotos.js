const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../uploads/perfiles');

function ensureUploadDir() {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
}

function getProfileOwnerId(req) {
    return String(
        req?.params?.doctorId
        || req?.params?.id
        || req?.usuario?.id
        || ''
    ).trim();
}

function sanitizeUserId(userId) {
    return String(userId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function buildProfileFilename(userId, extension) {
    const safeId = sanitizeUserId(userId);
    const ext = String(extension || '').toLowerCase();
    return `${safeId}${ext}`;
}

function buildProfilePublicPath(filename) {
    return `/uploads/perfiles/${filename}`;
}

function deleteStoredProfilePath(profilePath) {
    if (!profilePath) return;

    const filename = String(profilePath).replace('/uploads/perfiles/', '').trim();
    if (!filename) return;

    const fullPath = path.join(uploadDir, filename);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
    }
}

function deleteProfilePhotosByUserId(userId, options = {}) {
    const safeId = sanitizeUserId(userId);
    const excludeFilename = options.excludeFilename || null;

    if (!safeId || !fs.existsSync(uploadDir)) return;

    const files = fs.readdirSync(uploadDir);
    files.forEach((file) => {
        const parsed = path.parse(file);
        if (parsed.name !== safeId) return;
        if (excludeFilename && file === excludeFilename) return;

        const fullPath = path.join(uploadDir, file);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    });
}

module.exports = {
    uploadDir,
    ensureUploadDir,
    getProfileOwnerId,
    buildProfileFilename,
    buildProfilePublicPath,
    deleteStoredProfilePath,
    deleteProfilePhotosByUserId,
};