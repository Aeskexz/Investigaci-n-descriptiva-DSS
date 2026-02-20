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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Citas Medicas - Sistema de Gestión de Citas</title>
    <style>
    * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
:root {
    --primary: #0B3B5C;
    --primary-dark: #062837;
    --primary-light: #1E4E6F;
    --secondary: #00A896;
    --secondary-light: #02C3A7;
    --accent: #FF6B6B;
    --background: #F8FAFC;
    --surface: #FFFFFF;
    --text-primary: #1E293B;
    --text-secondary: #475569;
    --text-muted: #64748B;
    --border: #E2E8F0;
    --success: #10B981;
    --warning: #F59E0B;
    --error: #EF4444;
    --shadow-sm: 0 2px 4px rgba(0,0,0,0.02);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
    --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
}
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--background);
    color: var(--text-primary);
    line-height: 1.5;
    min-height: 100vh;
}
/* Layout */
.app {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
}
/* Header */
.header {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
    border-radius: 20px;
    padding: 32px 40px;
    margin-bottom: 32px;
    box-shadow: var(--shadow-xl);
    color: white;
}
.header h1 {
    font-size: 32px;
    font-weight: 600;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
}
.header .subtitle {
    font-size: 16px;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 12px;
}
.header .badge {
    background: rgba(255,255,255,0.2);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
}
.header .server-info {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,0,0,0.2);
    padding: 6px 12px;
    border-radius: 8px;
    font-family: monospace;
}
/* Grid Layout */
.grid {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 24px;
    margin-bottom: 24px;
}
/* Full width card */
.card-full {
    grid-column: 1 / -1;
}
/* Responsive */
@media (max-width: 1024px) {
    .grid {
        grid-template-columns: 1fr;
    }
    .app {
        padding: 16px;
    }
    .header {
        padding: 24px;
    }
}
    /* Javier Aqui pone tu parte*/
    
    </style>
</head>
<body>
    <div class="app">
        <!-- Header Profesional -->
        <header class="header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1>Citas Medicas</h1>
                    <div class="subtitle">
                        <span>Sistema de Gestión de Citas Médicas</span>
                        <span class="badge">Panel Administrativo</span>
                    </div>
                </div>
                <div class="server-info">
                  
                
                </div>
            </div>
        </header>

        <!-- Grid Principal -->
        <div class="grid">
            <!-- Card: Agendar Cita -->
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">📅</div>
                    <div>
                        <div class="card-title">Agendar Nueva Cita</div>
                        <div class="card-subtitle">Complete los datos del paciente</div>
                    </div>
                </div>

                <form id="appointmentForm">
                    <div class="form-group">
                        <label>Paciente</label>
                        <input type="text" id="paciente" placeholder="Nombre completo del paciente" required>
                    </div>

                    <div class="form-group">
                        <label>Motivo de consulta</label>
                        <textarea id="razon" rows="3" placeholder="Describa el motivo de la consulta" required></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Fecha</label>
                            <input type="date" id="fecha" required>
                        </div>
                        <div class="form-group">
                            <label>Hora</label>
                            <input type="time" id="hora" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Seleccionar Doctor</label>
                        <select id="doctor_id" required>
                            <option value="">-- Seleccione un doctor --</option>
                        </select>
                    </div>

                    <button type="button" class="btn btn-primary btn-full" onclick="agendarCita()">
                        <span>📌</span>
                        Agendar Cita
                    </button>
                </form>

                <div id="res-cita" class="result-box">
                    Complete el formulario para agendar una cita
                </div>
            </div>

            <!-- Card: Doctores Disponibles -->
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">👨‍⚕️</div>
                    <div>
                        <div class="card-title">Doctores Disponibles</div>
                        <div class="card-subtitle">Seleccione un doctor para la cita</div>
                    </div>
                </div>

                <button class="btn btn-outline" onclick="cargarDoctores()" style="width: 100%; margin-bottom: 20px;">
                    <span>🔄</span>
                    Actualizar Lista de Doctores
                </button>

                <div id="doctors-container">
                    <div class="loading">
                        <div class="spinner"></div>
                        <span>Cargando doctores...</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Card: Citas Agendadas (Full Width) -->
        <div class="card card-full" style="margin-top: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div class="card-header" style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
                    <div class="card-icon">📋</div>
                    <div>
                        <div class="card-title">Citas Agendadas</div>
                        <div class="card-subtitle">Listado de todas las citas programadas</div>
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="cargarCitas()">
                    <span>🔄</span>
                    Actualizar Citas
                </button>
            </div>

            <div id="citas-container">
                <!-- Las citas se cargarán aquí -->
            </div>
        </div>
    </div>

    <script>
        const BASE = 'http://localhost:3000/api';
        let selectedDoctor = null;

        // Función para mostrar loading
        function showLoading(containerId, message = 'Cargando...') {
            document.getElementById(containerId).innerHTML = \`
                <div class="loading">
                    <div class="spinner"></div>
                    <span>\${message}</span>
                </div>
            \`;
        }

        // Cargar doctores al iniciar
        document.addEventListener('DOMContentLoaded', cargarDoctores);

        async function cargarDoctores() {
            const container = document.getElementById('doctors-container');
            const select = document.getElementById('doctor_id');
            
            try {
                showLoading('doctors-container', 'Cargando doctores...');
                
                const res = await fetch(BASE + '/doctores');
                const data = await res.json();
                
                // Llenar select
                select.innerHTML = '<option value="">-- Seleccione un doctor --</option>';
                
                // Crear lista de doctores
                let doctorsHtml = '<div class="doctors-list">';
                data.forEach(d => {
                    select.innerHTML += \`<option value="\${d.id}">\${d.nombre} — \${d.especialidad}</option>\`;
                    doctorsHtml += \`
                        <div class="doctor-item" onclick="selectDoctor(\${d.id}, '\${d.nombre}', '\${d.especialidad}')" id="doctor-\${d.id}">
                            <div class="doctor-name">\${d.nombre}</div>
                            <div class="doctor-specialty">\${d.especialidad}</div>
                        </div>
                    \`;
                });
                doctorsHtml += '</div>';
                
                container.innerHTML = doctorsHtml;
                
            } catch (error) {
                container.innerHTML = \`
                    <div class="result-box error">
                        Error al cargar doctores: \${error.message}
                    </div>
                \`;
            }
        }

        function selectDoctor(id, nombre, especialidad) {
            // Remover selección anterior
            if (selectedDoctor) {
                const prevSelected = document.getElementById('doctor-' + selectedDoctor);
                if (prevSelected) {
                    prevSelected.classList.remove('selected');
                }
            }
            
            // Seleccionar nuevo doctor
            selectedDoctor = id;
            const newSelected = document.getElementById('doctor-' + id);
            if (newSelected) {
                newSelected.classList.add('selected');
            }
            
            // Actualizar select
            document.getElementById('doctor_id').value = id;
        }

        async function agendarCita() {
            const paciente = document.getElementById('paciente').value;
            const razon = document.getElementById('razon').value;
            const fecha = document.getElementById('fecha').value;
            const horaInput = document.getElementById('hora').value;
            const doctor_id = document.getElementById('doctor_id').value;

            // Validaciones
            if (!paciente || !razon || !fecha || !horaInput || !doctor_id) {
                const resultBox = document.getElementById('res-cita');
                resultBox.className = 'result-box error';
                resultBox.innerHTML = '⚠️ Por favor complete todos los campos';
                return;
            }

            const hora = horaInput + ':00';
            
            const body = {
                paciente,
                razon,
                fecha,
                hora,
                doctor_id: parseInt(doctor_id)
            };

            const resultBox = document.getElementById('res-cita');
            
            try {
                resultBox.className = 'result-box';
                resultBox.innerHTML = \`
                    <div class="loading">
                        <div class="spinner"></div>
                        <span>Agendando cita...</span>
                    </div>
                \`;

                const res = await fetch(BASE + '/citas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                
                const data = await res.json();
                
                resultBox.className = 'result-box ' + (res.ok ? 'success' : 'error');
                
                if (res.ok) {
                    resultBox.innerHTML = \`
                        <div style="color: var(--success); font-weight: 600; margin-bottom: 8px;">✅ Cita agendada exitosamente</div>
                        <pre style="margin: 0; font-family: inherit;">\${JSON.stringify(data, null, 2)}</pre>
                    \`;
                    
                    // Limpiar formulario
                    document.getElementById('appointmentForm').reset();
                    selectedDoctor = null;
                    document.querySelectorAll('.doctor-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    
                    // Recargar citas
                    cargarCitas();
                } else {
                    resultBox.innerHTML = \`
                        <div style="color: var(--error); font-weight: 600; margin-bottom: 8px;">❌ Error al agendar</div>
                        <pre style="margin: 0; font-family: inherit;">\${JSON.stringify(data, null, 2)}</pre>
                    \`;
                }
            } catch(e) {
                resultBox.className = 'result-box error';
                resultBox.innerHTML = \`
                    <div style="color: var(--error); font-weight: 600; margin-bottom: 8px;">❌ Error de conexión</div>
                    <pre style="margin: 0; font-family: inherit;">\${e.message}</pre>
                \`;
            }
        }

        async function cargarCitas() {
            const container = document.getElementById('citas-container');
            
            try {
                container.innerHTML = \`
                    <div class="loading">
                        <div class="spinner"></div>
                        <span>Cargando citas...</span>
                    </div>
                \`;

                const res = await fetch(BASE + '/citas');
                const data = await res.json();
                
                if (data.length === 0) {
                    container.innerHTML = \`
                        <div class="result-box">
                            No hay citas agendadas actualmente
                        </div>
                    \`;
                    return;
                }

                let citasHtml = '<div class="appointments-list">';
                
                data.forEach(cita => {
                    citasHtml += \`
                        <div class="appointment-card">
                            <div class="appointment-header">
                                <span class="appointment-patient">\${cita.paciente}</span>
                                <span class="appointment-datetime">\${cita.fecha} \${cita.hora}</span>
                            </div>
                            <div class="appointment-reason">
                                \${cita.razon}
                            </div>
                            <div class="appointment-doctor">
                                \${cita.doctor} - \${cita.especialidad}
                            </div>
                        </div>
                    \`;
                });
                
                citasHtml += '</div>';
                container.innerHTML = citasHtml;
                
            } catch (error) {
                container.innerHTML = \`
                    <div class="result-box error">
                        Error al cargar citas: \${error.message}
                    </div>
                \`;
            }
        }

        // Cargar citas al iniciar
        cargarCitas();
    </script>
</body>
</html>`);
});

// ─── Rutas API ───────────────────────────────────────────────────────────────
app.use('/api/citas', citasRoutes);
app.use('/api/doctores', doctoresRoutes);

module.exports = app;