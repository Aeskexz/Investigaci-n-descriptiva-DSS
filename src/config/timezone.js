const EL_SALVADOR_TIME_ZONE = 'America/El_Salvador';
const EL_SALVADOR_TIME_ZONE_OFFSET = '-06:00';
const EL_SALVADOR_LOCALE = 'es-SV';

process.env.TZ = EL_SALVADOR_TIME_ZONE;

function getDatePartsInElSalvador(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: EL_SALVADOR_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const values = Object.create(null);
    for (const part of formatter.formatToParts(date)) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }

    return values;
}

function formatDateTimeInElSalvador(value = new Date(), locale = EL_SALVADOR_LOCALE, options = {}) {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString(locale, {
        timeZone: EL_SALVADOR_TIME_ZONE,
        ...options,
    });
}

function formatIsoDateTimeInElSalvador(value = new Date()) {
    const parts = getDatePartsInElSalvador(value);

    if (!parts) {
        return '';
    }

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${EL_SALVADOR_TIME_ZONE_OFFSET}`;
}

module.exports = {
    EL_SALVADOR_LOCALE,
    EL_SALVADOR_TIME_ZONE,
    EL_SALVADOR_TIME_ZONE_OFFSET,
    formatDateTimeInElSalvador,
    formatIsoDateTimeInElSalvador,
    getDatePartsInElSalvador,
};