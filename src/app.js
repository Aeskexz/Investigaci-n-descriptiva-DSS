const express = require('express');
const cors = require('cors');
const path = require('path');

const citasRoutes = require('./routes/citasRoutes');
const doctoresRoutes = require('./routes/doctoresRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'public'
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use('/api/citas', citasRoutes);
app.use('/api/doctores', doctoresRoutes);

module.exports = app;
