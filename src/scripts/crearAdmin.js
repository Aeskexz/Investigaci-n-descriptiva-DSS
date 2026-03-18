const db = require('../db');
const bcrypt = require('bcrypt');

/**
 * Script para crear el usuario administrador por defecto
 * Ejecutar una sola vez con: node src/scripts/crearAdmin.js
 */

async function crearAdmin() {
    try {
        // Verificar si ya existe un admin
        const [admins] = await db.query("SELECT id FROM usuarios WHERE rol = 'admin'");
        
        if (admins.length > 0) {
            console.log('Ya existe un administrador en la base de datos.');
            process.exit(0);
        }

        // Encriptar contraseña
        const passwordHash = await bcrypt.hash('admin123', 10);

        // Crear usuario admin
        await db.query(
            'INSERT INTO usuarios (email, password, rol) VALUES (?, ?, ?)',
            ['admin@sistema.com', passwordHash, 'admin']
        );

        console.log('✅ Administrador creado exitosamente!');
        console.log('   Email: admin@sistema.com');
        console.log('   Contraseña: admin123');
        console.log('\n⚠️  Cambia la contraseña después del primer login.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al crear administrador:', error);
        process.exit(1);
    }
}

crearAdmin();
