<div align="center">
<img width="192" height="192" alt="android-chrome-192x192" src="https://github.com/user-attachments/assets/f19247bd-d319-46aa-83a1-d8fce37adadb" />
</div>

# Investigación Descriptiva - Backend

<p>
Sistema de gestión de citas medicas y doctores. API REST contruida con Node.js, express y MySQL.
</p>

## Requisitos

- Node.js v16+
- MySQL 5.7+ / 8.x

## Estructura del proyecto

- `server.js`: inicia el servidor y muestra rutas principales.
- `src/app.js`: configuración de middleware, archivos estáticos y rutas.
- `src/routes/*.js`: enrutadores (`/api/citas`, `/api/doctores`).
- `src/controllers/*Controller.js`: controladores que procesan solicitudes y respuestas.
- `src/services/citasService.js`: validaciones de negocio (disponibilidad, reglas de horario).
- `src/db.js`: pool de conexiones MySQL (usa `dotenv`).
- `public/`: front-end estático (incluye `index.html`).

## Instalación

```bash
npm install
```

Crea un archivo `.env` en la raíz:

```bash
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=investigacion_descriptiva
```

Para arrancar:
- `npm start` — servidor en producción.
- `npm run dev` — servidor con nodemon.

## Reglas importantes

- No se permiten citas los domingos (ver `src/services/citasService.js`).
- Horario permitido: desde las 07:00 hasta antes de las 18:00 (es decir horas 7..17).
- Al crear o actualizar una cita se verifica:
  - que el `doctor_id` exista;
  - que no haya otra cita del mismo doctor en la misma `fecha` y `hora`.

## Endpoints (con ejemplos)

### `GET /api/doctores`

- Descripción: lista todos los doctores.
- Respuesta 200 OK (ejemplo):

```json
[
  { "id": 1, "nombre": "Dr. Ana López", "especialidad": "Pediatría" },
  { "id": 2, "nombre": "Dr. Carlos Ruiz", "especialidad": "Medicina General" }
]
```

### `GET /api/citas`

- Descripción: lista citas con nombre y especialidad del doctor.
- Respuesta 200 OK (ejemplo):

```json
[
  { "id": 10, "paciente": "Juan Pérez", "razon": "Consulta", "fecha": "2026-03-01", "hora": "09:30:00", "doctor": "Dr. Ana López", "especialidad": "Pediatría" }
]
```

### `POST /api/citas`

- Descripción: crea una nueva cita.
- Body JSON (requerido):

```json
{
  "paciente": "María Gómez",
  "razon": "Dolor de garganta",
  "fecha": "2026-03-02",
  "hora": "10:00",
  "doctor_id": 1
}
```

- Respuestas posibles:
  - `201 Created` — cita creada. Devuelve la cita con `id`.
  - `400 Bad Request` — validación (p. ej. domingo, horario fuera de rango, formato inválido).
  - `404 Not Found` — `doctor_id` no existe.
  - `409 Conflict` — el doctor ya tiene una cita en esa fecha/hora.

- Ejemplo respuesta 201:

```json
{
  "mensaje": "Cita creada exitosamente.",
  "cita": { "id": 11, "paciente": "María Gómez", "razon": "Dolor de garganta", "fecha": "2026-03-02", "hora": "10:00", "doctor_id": 1 }
}
```

### `PUT /api/citas/:id`

- Descripción: actualiza la cita `:id`.
- Body JSON: mismos campos que `POST`.
- Respuestas: `200 OK` (actualizado), `404` (cita o doctor no existe), `400`/`409` (validaciones/conflictos).

### `DELETE /api/citas/:id`

- Descripción: elimina la cita indicada.
- Respuestas: `200 OK` (eliminada), `404` (no existe).[![](sotogrecia.exe@gmail.com)](http://blob:https://web.whatsapp.com/5f7d6a9d-8cdf-4fed-8151-517f06e8bf3c)

## Notas

- `src/db.js` imprime en consola si la conexión MySQL se establece correctamente.
- Revisar `src/services/citasService.js` para ajustar reglas (p. ej. cambiar horario o permitir sábados/domingo si es necesario).


## Licencia

- Por defecto `ISC` (ver `package.json`)
