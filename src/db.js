const mysql = require('mysql2');
require('dotenv').config();
const { generateUniqueUsername } = require('./utils/username');
const { generateUniquePublicUserId } = require('./utils/userId');

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

async function tableExists(tableName) {
    const [rows] = await promisePool.query('SHOW TABLES LIKE ?', [tableName]);
    return rows.length > 0;
}

async function columnExists(tableName, columnName) {
    const [rows] = await promisePool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [process.env.DB_NAME, tableName, columnName]
    );
    return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
    if (await columnExists(tableName, columnName)) return;

    try {
        await promisePool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
}

async function addUniqueIndexIfMissing(tableName, indexName, columnName) {
    const [indexes] = await promisePool.query(
        `SHOW INDEX FROM ${tableName} WHERE Key_name = ?`,
        [indexName]
    );

    if (indexes.length > 0) return;

    try {
        await promisePool.query(
            `ALTER TABLE ${tableName} ADD UNIQUE KEY ${indexName} (${columnName})`
        );
    } catch (error) {
        if (error.code !== 'ER_DUP_KEYNAME') throw error;
    }
}

async function hasPrimaryKey(tableName) {
    const [rows] = await promisePool.query(
        `SHOW INDEX FROM ${tableName} WHERE Key_name = 'PRIMARY'`
    );
    return rows.length > 0;
}

async function ensureAdminsTable() {
    await promisePool.query(`
        CREATE TABLE IF NOT EXISTS admins (
            id INT(11) NOT NULL AUTO_INCREMENT,
            codigo_id VARCHAR(10) NULL,
            email VARCHAR(150) NULL,
            username VARCHAR(40) NULL,
            password VARCHAR(255) NULL,
            creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
}

async function ensureHistorialCambiosTable() {
    await promisePool.query(`
        CREATE TABLE IF NOT EXISTS historial_cambios (
            id INT(11) NOT NULL AUTO_INCREMENT,
            tipo VARCHAR(20) NOT NULL,
            descripcion TEXT NOT NULL,
            creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
}

async function ensureExpedienteClinicoTable() {
    await promisePool.query(`
        CREATE TABLE IF NOT EXISTS expediente_clinico (
            id INT(11) NOT NULL AUTO_INCREMENT,
            paciente_id VARCHAR(10) NOT NULL,
            doctor_id VARCHAR(10) NOT NULL,
            fecha_consulta DATE NOT NULL,
            sintomas TEXT NULL,
            diagnostico TEXT NULL,
            tratamiento TEXT NULL,
            notas TEXT NULL,
            iv VARCHAR(32) NOT NULL,
            creado_en TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_exp_paciente (paciente_id),
            INDEX idx_exp_doctor (doctor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
}

async function ensureAccountColumns(tableName) {
    await addColumnIfMissing(tableName, 'codigo_id', 'VARCHAR(10) NULL');
    await addColumnIfMissing(tableName, 'email', 'VARCHAR(150) NULL');
    await addColumnIfMissing(tableName, 'username', 'VARCHAR(40) NULL');
    await addColumnIfMissing(tableName, 'password', 'VARCHAR(255) NULL');
    await addColumnIfMissing(tableName, 'creado_en', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
    await addColumnIfMissing(tableName, 'foto_perfil', 'VARCHAR(255) NULL');
}

async function migrateFromUsuariosIfPresent() {
    if (!(await tableExists('usuarios'))) return;

    await promisePool.query(`
        UPDATE doctores d
        JOIN usuarios u ON d.usuario_id = u.id
        SET
            d.codigo_id = COALESCE(d.codigo_id, u.codigo_id),
            d.email = COALESCE(d.email, u.email),
            d.username = COALESCE(d.username, u.username),
            d.password = COALESCE(d.password, u.password),
            d.creado_en = COALESCE(d.creado_en, u.creado_en)
        WHERE u.rol = 'doctor'
    `);

    await promisePool.query(`
        UPDATE pacientes p
        JOIN usuarios u ON p.usuario_id = u.id
        SET
            p.codigo_id = COALESCE(p.codigo_id, u.codigo_id),
            p.email = COALESCE(p.email, u.email),
            p.username = COALESCE(p.username, u.username),
            p.password = COALESCE(p.password, u.password),
            p.creado_en = COALESCE(p.creado_en, u.creado_en)
        WHERE u.rol = 'paciente'
    `);

    await promisePool.query(`
        INSERT INTO admins (codigo_id, email, username, password, creado_en)
        SELECT u.codigo_id, u.email, u.username, u.password, u.creado_en
        FROM usuarios u
        WHERE u.rol = 'admin'
          AND NOT EXISTS (
              SELECT 1 FROM admins a WHERE a.email = u.email OR a.username = u.username
          )
    `);
}

async function backfillAuthValues(tableName, role) {
    const keyColumn = (await columnExists(tableName, 'id')) ? 'id' : 'codigo_id';

    const [withoutCode] = await promisePool.query(
        `SELECT ${keyColumn} AS ref_key FROM ${tableName} WHERE codigo_id IS NULL OR TRIM(codigo_id) = ''`
    );

    for (const row of withoutCode) {
        const publicId = await generateUniquePublicUserId(promisePool, role, row.ref_key || null);
        await promisePool.query(
            `UPDATE ${tableName} SET codigo_id = ? WHERE ${keyColumn} = ?`,
            [publicId, row.ref_key]
        );
    }

    const [withoutUsername] = await promisePool.query(
        `SELECT ${keyColumn} AS ref_key, email FROM ${tableName} WHERE username IS NULL OR TRIM(username) = ''`
    );

    for (const row of withoutUsername) {
        const seed = row.email ? String(row.email).split('@')[0] : `${role}${row.ref_key}`;
        const username = await generateUniqueUsername(
            promisePool,
            seed,
            { rol: role, id: row.ref_key }
        );
        await promisePool.query(
            `UPDATE ${tableName} SET username = ? WHERE ${keyColumn} = ?`,
            [username, row.ref_key]
        );
    }
}

async function generateUniqueCitaCodigo() {
    let candidate = '';
    let exists = true;

    while (exists) {
        const random = Math.floor(Math.random() * 100000000);
        candidate = `C-${String(random).padStart(8, '0')}`;
        const [rows] = await promisePool.query('SELECT codigo_id FROM citas WHERE codigo_id = ? LIMIT 1', [candidate]);
        exists = rows.length > 0;
    }

    return candidate;
}

async function ensureCitasCodigoSupport() {
    await addColumnIfMissing('citas', 'codigo_id', 'VARCHAR(10) NULL');

    const citaKeyColumn = (await columnExists('citas', 'id')) ? 'id' : 'codigo_id';

    const [citasWithoutCode] = await promisePool.query(
        `SELECT ${citaKeyColumn} AS ref_key FROM citas WHERE codigo_id IS NULL OR TRIM(codigo_id) = ''`
    );

    for (const cita of citasWithoutCode) {
        const codigo = await generateUniqueCitaCodigo();
        await promisePool.query(`UPDATE citas SET codigo_id = ? WHERE ${citaKeyColumn} = ?`, [codigo, cita.ref_key]);
    }

    await addUniqueIndexIfMissing('citas', 'uk_citas_codigo_id', 'codigo_id');
}

async function migrateCitasReferencesToCodigoId() {
    const getColumnType = async (tableName, columnName) => {
        const [rows] = await promisePool.query(
            `SELECT DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
            [process.env.DB_NAME, tableName, columnName]
        );
        return rows.length > 0 ? String(rows[0].COLUMN_TYPE || rows[0].DATA_TYPE).toLowerCase() : null;
    };

    const dropColumnIfExists = async (tableName, columnName) => {
        if (await columnExists(tableName, columnName)) {
            const [indexes] = await promisePool.query(
                `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND INDEX_NAME <> 'PRIMARY'`,
                [process.env.DB_NAME, tableName, columnName]
            );

            for (const idx of indexes) {
                try {
                    await promisePool.query(`ALTER TABLE ${tableName} DROP INDEX ${idx.INDEX_NAME}`);
                } catch (error) {
                    if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw error;
                }
            }

            try {
                await promisePool.query(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
            } catch (error) {
                if (error.code !== 'ER_KEY_COLUMN_DOES_NOT_EXITS' && error.code !== 'ER_BAD_FIELD_ERROR') throw error;
            }
        }
    };

    if (await columnExists('citas', 'doctor_id') && await columnExists('doctores', 'id')) {
        const doctorType = await getColumnType('citas', 'doctor_id');
        if (doctorType && doctorType.startsWith('int') && !(await columnExists('citas', 'doctor_id_old'))) {
            try {
                await promisePool.query('ALTER TABLE citas CHANGE COLUMN doctor_id doctor_id_old INT(11) NULL');
            } catch (error) {
                if (!['ER_DUP_FIELDNAME', 'ER_BAD_FIELD_ERROR'].includes(error.code)) throw error;
            }
        }
    }

    if (await columnExists('citas', 'paciente_id') && await columnExists('pacientes', 'id')) {
        const pacienteType = await getColumnType('citas', 'paciente_id');
        if (pacienteType && pacienteType.startsWith('int') && !(await columnExists('citas', 'paciente_id_old'))) {
            try {
                await promisePool.query('ALTER TABLE citas CHANGE COLUMN paciente_id paciente_id_old INT(11) NULL');
            } catch (error) {
                if (!['ER_DUP_FIELDNAME', 'ER_BAD_FIELD_ERROR'].includes(error.code)) throw error;
            }
        }
    }

    if (!(await columnExists('citas', 'doctor_id'))) {
        await addColumnIfMissing('citas', 'doctor_id', 'VARCHAR(10) NULL');
    }

    if (!(await columnExists('citas', 'paciente_id'))) {
        await addColumnIfMissing('citas', 'paciente_id', 'VARCHAR(10) NULL');
    }

    if (await columnExists('citas', 'doctor_codigo_tmp')) {
        await promisePool.query(`
            UPDATE citas
            SET doctor_id = doctor_codigo_tmp
            WHERE doctor_id IS NULL OR TRIM(doctor_id) = ''
        `);
    }

    if (await columnExists('citas', 'paciente_codigo_tmp')) {
        await promisePool.query(`
            UPDATE citas
            SET paciente_id = paciente_codigo_tmp
            WHERE paciente_id IS NULL OR TRIM(paciente_id) = ''
        `);
    }

    if (await columnExists('citas', 'doctor_id_old')) {
        await promisePool.query(`
            UPDATE citas c
            JOIN doctores d ON c.doctor_id_old = d.id
            SET c.doctor_id = d.codigo_id
            WHERE c.doctor_id IS NULL OR TRIM(c.doctor_id) = ''
        `);
    }

    if (await columnExists('citas', 'paciente_id_old')) {
        await promisePool.query(`
            UPDATE citas c
            JOIN pacientes p ON c.paciente_id_old = p.id
            SET c.paciente_id = p.codigo_id
            WHERE c.paciente_id IS NULL OR TRIM(c.paciente_id) = ''
        `);
    }

    const [foreignKeys] = await promisePool.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'citas'
          AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME]);

    for (const fk of foreignKeys) {
        await promisePool.query(`ALTER TABLE citas DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
    }

    await promisePool.query('ALTER TABLE citas MODIFY COLUMN doctor_id VARCHAR(10) NOT NULL');
    await promisePool.query('ALTER TABLE citas MODIFY COLUMN paciente_id VARCHAR(10) NOT NULL');

    await dropColumnIfExists('citas', 'doctor_codigo_tmp');
    await dropColumnIfExists('citas', 'paciente_codigo_tmp');
    await dropColumnIfExists('citas', 'doctor_id_old');
    await dropColumnIfExists('citas', 'paciente_id_old');

    const [doctorIndex] = await promisePool.query("SHOW INDEX FROM citas WHERE Key_name = 'idx_citas_doctor_id'");
    if (doctorIndex.length === 0 && await columnExists('citas', 'doctor_id')) {
        await promisePool.query('ALTER TABLE citas ADD INDEX idx_citas_doctor_id (doctor_id)');
    }

    const [pacienteIndex] = await promisePool.query("SHOW INDEX FROM citas WHERE Key_name = 'idx_citas_paciente_id'");
    if (pacienteIndex.length === 0 && await columnExists('citas', 'paciente_id')) {
        await promisePool.query('ALTER TABLE citas ADD INDEX idx_citas_paciente_id (paciente_id)');
    }

    const [citaHorario] = await promisePool.query("SHOW INDEX FROM citas WHERE Key_name = 'uq_cita_doctor_horario_codigo'");
    if (citaHorario.length === 0 && await columnExists('citas', 'doctor_id')) {
        await promisePool.query('ALTER TABLE citas ADD UNIQUE KEY uq_cita_doctor_horario_codigo (doctor_id, fecha, hora)');
    }
}

async function promoteCodigoIdAsPrimaryKey(tableName) {
    if (!(await columnExists(tableName, 'id'))) return;

    const [codigoIndexes] = await promisePool.query(
        `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'codigo_id' AND INDEX_NAME <> 'PRIMARY'`,
        [process.env.DB_NAME, tableName]
    );

    for (const idx of codigoIndexes) {
        try {
            await promisePool.query(`ALTER TABLE ${tableName} DROP INDEX ${idx.INDEX_NAME}`);
        } catch (error) {
            if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw error;
        }
    }

    try {
        await promisePool.query(`ALTER TABLE ${tableName} MODIFY COLUMN id INT(11) NULL`);
    } catch (error) {
        if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    }

    if (await hasPrimaryKey(tableName)) {
        await promisePool.query(`ALTER TABLE ${tableName} DROP PRIMARY KEY`);
    }
    await promisePool.query(`ALTER TABLE ${tableName} MODIFY COLUMN codigo_id VARCHAR(10) NOT NULL`);
    if (!(await hasPrimaryKey(tableName))) {
        try {
            await promisePool.query(`ALTER TABLE ${tableName} ADD PRIMARY KEY (codigo_id)`);
        } catch (error) {
            if (error.code !== 'ER_WRONG_NAME_FOR_INDEX') throw error;
        }
    }
    await promisePool.query(`ALTER TABLE ${tableName} DROP COLUMN id`);
}

async function applyCodigoIdForeignKeys() {
    const [doctorFk] = await promisePool.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'citas'
          AND CONSTRAINT_NAME = 'fk_citas_doctor_codigo'
    `, [process.env.DB_NAME]);

    if (doctorFk.length === 0 && await columnExists('citas', 'doctor_id')) {
        await promisePool.query(
            'ALTER TABLE citas ADD CONSTRAINT fk_citas_doctor_codigo FOREIGN KEY (doctor_id) REFERENCES doctores(codigo_id) ON DELETE CASCADE ON UPDATE CASCADE'
        );
    }

    const [pacienteFk] = await promisePool.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'citas'
          AND CONSTRAINT_NAME = 'fk_citas_paciente_codigo'
    `, [process.env.DB_NAME]);

    if (pacienteFk.length === 0 && await columnExists('citas', 'paciente_id')) {
        await promisePool.query(
            'ALTER TABLE citas ADD CONSTRAINT fk_citas_paciente_codigo FOREIGN KEY (paciente_id) REFERENCES pacientes(codigo_id) ON DELETE CASCADE ON UPDATE CASCADE'
        );
    }
}

async function migrateAllTablesToCodigoPrimaryId() {
    await ensureCitasCodigoSupport();
    await migrateCitasReferencesToCodigoId();

    await promoteCodigoIdAsPrimaryKey('admins');
    await promoteCodigoIdAsPrimaryKey('doctores');
    await promoteCodigoIdAsPrimaryKey('pacientes');
    await promoteCodigoIdAsPrimaryKey('citas');

    await applyCodigoIdForeignKeys();
}

async function removeUsuarioReferencesAndDropTable() {
    if (!(await tableExists('usuarios'))) return;

    const [foreignKeys] = await promisePool.query(`
        SELECT TABLE_NAME, CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
          AND REFERENCED_TABLE_NAME = 'usuarios'
          AND COLUMN_NAME = 'usuario_id'
    `, [process.env.DB_NAME]);

    for (const fk of foreignKeys) {
        await promisePool.query(
            `ALTER TABLE ${fk.TABLE_NAME} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`
        );
    }

    if (await columnExists('doctores', 'usuario_id')) {
        await promisePool.query('ALTER TABLE doctores DROP COLUMN usuario_id');
    }

    if (await columnExists('pacientes', 'usuario_id')) {
        await promisePool.query('ALTER TABLE pacientes DROP COLUMN usuario_id');
    }

    await promisePool.query('DROP TABLE IF EXISTS usuarios');
}

async function ensureSplitAccountSchema() {
    await ensureAdminsTable();
    await ensureHistorialCambiosTable();
    await ensureExpedienteClinicoTable();
    await ensureAccountColumns('admins');
    await ensureAccountColumns('doctores');
    await ensureAccountColumns('pacientes');

    await migrateFromUsuariosIfPresent();

    await backfillAuthValues('admins', 'admin');
    await backfillAuthValues('doctores', 'doctor');
    await backfillAuthValues('pacientes', 'paciente');

    await addUniqueIndexIfMissing('admins', 'uk_admins_codigo_id', 'codigo_id');
    await addUniqueIndexIfMissing('admins', 'uk_admins_email', 'email');
    await addUniqueIndexIfMissing('admins', 'uk_admins_username', 'username');

    await addUniqueIndexIfMissing('doctores', 'uk_doctores_codigo_id', 'codigo_id');
    await addUniqueIndexIfMissing('doctores', 'uk_doctores_email', 'email');
    await addUniqueIndexIfMissing('doctores', 'uk_doctores_username', 'username');

    await addUniqueIndexIfMissing('pacientes', 'uk_pacientes_codigo_id', 'codigo_id');
    await addUniqueIndexIfMissing('pacientes', 'uk_pacientes_email', 'email');
    await addUniqueIndexIfMissing('pacientes', 'uk_pacientes_username', 'username');

    await removeUsuarioReferencesAndDropTable();
    await migrateAllTablesToCodigoPrimaryId();
}

function initializeDatabase() {
    if (!initializationPromise) {
        initializationPromise = ensureSplitAccountSchema();
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
