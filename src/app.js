const express = require('express');
const cors = require('cors');

const citasRoutes = require('./routes/citasRoutes');
const doctoresRoutes = require('./routes/doctoresRoutes');

const app = express();

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Panel de Pruebas - API Citas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0f2f5; padding: 30px; color: #333; }
    h1 { text-align: center; margin-bottom: 8px; color: #2c3e50; }
    p.sub { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 1000px; margin: 0 auto; }
    .card { background: white; border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h2 { font-size: 16px; margin-bottom: 16px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }
    label { display: block; font-size: 13px; margin-bottom: 4px; color: #555; margin-top: 10px; }
    input, select, textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #ddd;
      border-radius: 6px; font-size: 14px; outline: none;
    }
    input:focus, select:focus { border-color: #3498db; }
    button {
      margin-top: 16px; width: 100%; padding: 10px;
      background: #3498db; color: white; border: none;
      border-radius: 6px; font-size: 15px; cursor: pointer;
    }
    button:hover { background: #2980b9; }
    .result {
      margin-top: 14px; background: #f8f9fa; border-radius: 6px;
      padding: 12px; font-size: 13px; white-space: pre-wrap;
      border-left: 4px solid #3498db; min-height: 50px; color: #2c3e50;
    }
    .result.error { border-left-color: #e74c3c; color: #e74c3c; }
    .result.ok { border-left-color: #2ecc71; }
    #lista-doctores { list-style: none; padding: 0; }
    #lista-doctores li {
      padding: 8px 12px; background: #f0f7ff; border-radius: 6px;
      margin-bottom: 6px; font-size: 14px; border-left: 3px solid #3498db;
    }
  </style>
</head>
<body>
  <h1>🏥 Panel de Pruebas — API Citas Médicas</h1>
  <p class="sub">Servidor corriendo en <strong>http://localhost:3000</strong></p>

  <div class="grid">

    <!-- AGENDAR CITA -->
    <div class="card">
      <h2>📅 Agendar Cita</h2>
      <label>Paciente</label>
      <input id="paciente" type="text" placeholder="Nombre del paciente" />
      <label>Razón</label>
      <textarea id="razon" rows="2" placeholder="Motivo de la consulta"></textarea>
      <label>Fecha</label>
      <input id="fecha" type="date" />
      <label>Hora</label>
      <input id="hora" type="time" />
      <label>Doctor</label>
      <select id="doctor_id">
        <option value="">-- Cargando doctores... --</option>
      </select>
      <button onclick="agendarCita()">Agendar Cita</button>
      <div class="result" id="res-cita">Aquí aparecerá la respuesta...</div>
    </div>

    <!-- VER DOCTORES -->
    <div class="card">
      <h2>👨‍⚕️ Doctores Disponibles</h2>
      <button onclick="cargarDoctores()">🔄 Recargar Doctores</button>
      <ul id="lista-doctores" style="margin-top:14px;"></ul>
    </div>

    <!-- VER CITAS -->
    <div class="card" style="grid-column: 1 / -1;">
      <h2>📋 Citas Agendadas</h2>
      <button onclick="cargarCitas()">🔄 Ver Citas</button>
      <div class="result" id="res-lista-citas" style="margin-top:14px;">Presiona el botón para cargar las citas...</div>
    </div>

  </div>

  <script>
    const BASE = 'http://localhost:3000/api';

    async function cargarDoctores() {
      const res = await fetch(BASE + '/doctores');
      const data = await res.json();
      const select = document.getElementById('doctor_id');
      const lista = document.getElementById('lista-doctores');
      select.innerHTML = '';
      lista.innerHTML = '';
      data.forEach(d => {
        select.innerHTML += \`<option value="\${d.id}">\${d.nombre} — \${d.especialidad}</option>\`;
        lista.innerHTML += \`<li><strong>\${d.nombre}</strong> · \${d.especialidad}</li>\`;
      });
    }

    async function agendarCita() {
      const body = {
        paciente: document.getElementById('paciente').value,
        razon: document.getElementById('razon').value,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value + ':00',
        doctor_id: parseInt(document.getElementById('doctor_id').value)
      };
      const el = document.getElementById('res-cita');
      try {
        const res = await fetch(BASE + '/citas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        el.className = 'result ' + (res.ok ? 'ok' : 'error');
        el.textContent = JSON.stringify(data, null, 2);
      } catch(e) {
        el.className = 'result error';
        el.textContent = 'Error de conexión: ' + e.message;
      }
    }

    async function cargarCitas() {
      const el = document.getElementById('res-lista-citas');
      try {
        const res = await fetch(BASE + '/citas');
        const data = await res.json();
        el.className = 'result ok';
        el.textContent = JSON.stringify(data, null, 2);
      } catch(e) {
        el.className = 'result error';
        el.textContent = 'Error: ' + e.message;
      }
    }

    // Cargar doctores al iniciar
    cargarDoctores();
  </script>
</body>
</html>`);
});

// ─── Rutas API ───────────────────────────────────────────────────────────────
app.use('/api/citas', citasRoutes);
app.use('/api/doctores', doctoresRoutes);

module.exports = app;
