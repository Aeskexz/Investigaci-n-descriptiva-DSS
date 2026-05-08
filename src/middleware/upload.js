const multer = require('multer');
const path = require('path');
const {
    uploadDir,
    ensureUploadDir,
    getProfileOwnerId,
    buildProfileFilename,
    deleteProfilePhotosByUserId,
} = require('../utils/profilePhotos');

ensureUploadDir();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ownerId = getProfileOwnerId(req);
        const ext = path.extname(file.originalname);
        if (!ownerId) {
            return cb(null, `perfil-${Date.now()}${ext.toLowerCase()}`);
        }

        const finalFilename = buildProfileFilename(ownerId, ext);
        deleteProfilePhotosByUserId(ownerId, { excludeFilename: finalFilename });
        cb(null, finalFilename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG, GIF y WebP.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

module.exports = upload;
