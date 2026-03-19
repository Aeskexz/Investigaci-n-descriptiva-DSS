const db = require('../db');

exports.validarDisponibilidad = async (datosCita) => {

    const { fecha, hora, doctor_id } = datosCita;

    const fechaObjeto = new Date(fecha);
    const dia = fechaObjeto.getDay(); 

    if (dia === 0) {
        return {
            disponible: false,
            mensaje: "No se puede agendar los domingos."
        };
    }

    const horaNumero = parseInt(hora.split(":")[0]);

    if (horaNumero < 7) {
        return {
            disponible: false,
            mensaje: "Horario disponible desde las 7:00 AM."
        };
    }

    if (horaNumero >= 18) {
        return {
            disponible: false,
            mensaje: "Horario disponible hasta las 6:00 PM."
        };
    }

    try {
        
        const query = 'SELECT * FROM citas WHERE fecha = ? AND hora = ? AND doctor_id = ?';
        const [rows] = await db.query(query, [fecha, hora, doctor_id]);

        
        if (rows.length > 0) {
            return {
                disponible: false,
                mensaje: "El doctor ya tiene una cita programada para esa fecha y hora."
            };
        }


        return {
            disponible: true,
            mensaje: "Horario disponible"
        };

    } catch (error) {
        console.error("Error al consultar la disponibilidad:", error);
        return {
            disponible: false,
            mensaje: "Error interno al validar la disponibilidad."
        };
    }
};
