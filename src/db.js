const mysql = require('mysql2');
require('dotenv').config();
const { generateUniqueUsername } = require('./utils/username');

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missingEnv = requiredEnv.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');

if (missingEnv.length > 0) {
    console.error(`Faltan variables de entorno obligatorias: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const promisePool = pool.promise();
let initializationPromise;

async function ensureUsernameSupport() {
    const [columns] = await promisePool.query("SHOW COLUMNS FROM usuarios LIKE 'username'");

    if (columns.length === 0) {
        await promisePool.query('ALTER TABLE usuarios ADD COLUMN username VARCHAR(40) NULL AFTER email');
    }

    const [usersWithoutUsername] = await promisePool.query(
        "SELECT id, email FROM usuarios WHERE username IS NULL OR TRIM(username) = ''"
    );

    for (const user of usersWithoutUsername) {
        const emailSeed = user.email ? String(user.email).split('@')[0] : `usuario${user.id}`;
        const username = await generateUniqueUsername(promisePool, emailSeed || `usuario${user.id}`, user.id);
        await promisePool.query('UPDATE usuarios SET username = ? WHERE id = ?', [username, user.id]);
    }

    const [indexes] = await promisePool.query("SHOW INDEX FROM usuarios WHERE Key_name = 'uk_usuarios_username'");
    if (indexes.length === 0) {
        await promisePool.query('ALTER TABLE usuarios ADD UNIQUE KEY uk_usuarios_username (username)');
    }
}

function initializeDatabase() {
    if (!initializationPromise) {
        initializationPromise = ensureUsernameSupport();
    }

    return initializationPromise;
}

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
        return;
    }

    initializeDatabase()
        .then(() => {
            console.log('Conexión a MySQL establecida correctamente.');
            connection.release();
        })
        .catch((initializationError) => {
            console.error('Error al inicializar la base de datos:', initializationError);
            connection.release();
        });
});

module.exports = promisePool;
