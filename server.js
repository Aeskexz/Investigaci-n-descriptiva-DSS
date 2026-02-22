require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Rutas disponibles:`);
    console.log(`   GET  http://localhost:${PORT}/api/doctores`);
    console.log(`   POST http://localhost:${PORT}/api/citas`);
});
