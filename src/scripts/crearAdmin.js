const db = require('../db');
const bcrypt = require('bcrypt');



async function crearAdmin() {
    try {
        
        const [admins] = await db.query("SELECT id FROM usuarios WHERE rol = 'admin'");
        
        if (admins.length > 0) {
            console.log('Ya existe un administrador en la base de datos.');
            process.exit(0);
        }

        
        const passwordHash = await bcrypt.hash('admin123', 10);

        
        await db.query(
            'INSERT INTO usuarios (email, username, password, rol) VALUES (?, ?, ?, ?)',
            ['admin@sistema.com', 'admin', passwordHash, 'admin']
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
