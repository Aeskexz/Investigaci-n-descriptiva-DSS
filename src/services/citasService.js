exports.validarDisponibilidad = (datosCita) => {

    const { fecha, hora } = datosCita;

    const fechaObjeto = new Date(fecha);
    const dia = fechaObjeto.getDay(); // 0 = domingo

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

    // 🔥 Aquí Iván y Gabriel deben:
    // 1. Consultar la base de datos
    // 2. Verificar si el doctor ya tiene cita en esa fecha y hora
    // 3. Retornar disponible: false si está ocupado

    return {
        disponible: true,
        mensaje: "Horario válido"
    };
};
