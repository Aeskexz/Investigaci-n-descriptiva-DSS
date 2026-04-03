const db = require('../db');
const bcrypt = require('bcrypt');
const { generateUniquePublicUserId } = require('../utils/userId');



async function crearAdmin() {
    try {
        const [admins] = await db.query('SELECT codigo_id FROM admins');
        
        if (admins.length > 0) {
            console.log('Ya existe un administrador en la base de datos.');
            process.exit(0);
        }

        const passwordHash = await bcrypt.hash('admin123', 10);
        const publicUserId = await generateUniquePublicUserId(db, 'admin');

        await db.query(
            'INSERT INTO admins (email, codigo_id, username, password) VALUES (?, ?, ?, ?)',
            ['admin@sistema.com', publicUserId, 'admin', passwordHash]
        );

        console.log('Administrador creado exitosamente.');
        console.log('   Email: admin@sistema.com');
        console.log('   Username: admin');
        console.log('   Contraseña: admin123');
        console.log('\nCambia la contraseña después del primer login.');

        process.exit(0);
    } catch (error) {
        console.error('Error al crear administrador:', error);
        process.exit(1);
    }
}

crearAdmin();
