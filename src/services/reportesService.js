const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const {
    formatDateTimeInElSalvador,
    formatIsoDateTimeInElSalvador,
} = require('../config/timezone');

const REPORTS_DIR = path.join(__dirname, '../../reports');
const TEMPLATES_DIR = path.join(REPORTS_DIR, 'templates');
const OUTPUT_DIR = path.join(REPORTS_DIR, 'output');
const TEMPLATE_HISTORIAL = path.join(TEMPLATES_DIR, 'historial_medico_paciente.jrxml');

function ensureReportsStructure() {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildHistorialXml({ paciente, historial, generadoPor }) {
    const entradasXml = (historial || []).map((e) => `
        <entrada>
            <fecha_consulta>${escapeXml(e.fecha_consulta)}</fecha_consulta>
            <doctor_nombre>${escapeXml(e.doctor_nombre || e.doctor_id || '-')}</doctor_nombre>
            <sintomas>${escapeXml(e.sintomas || '')}</sintomas>
            <diagnostico>${escapeXml(e.diagnostico || '')}</diagnostico>
            <tratamiento>${escapeXml(e.tratamiento || '')}</tratamiento>
            <notas>${escapeXml(e.notas || '')}</notas>
            <creado_en>${escapeXml(e.creado_en || '')}</creado_en>
        </entrada>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<reporte>
    <paciente>
        <id>${escapeXml(paciente.id)}</id>
        <nombre>${escapeXml(paciente.nombre || '')}</nombre>
        <email>${escapeXml(paciente.email || '')}</email>
        <telefono>${escapeXml(paciente.telefono || '')}</telefono>
    </paciente>
    <meta>
        <generado_por>${escapeXml(generadoPor || '')}</generado_por>
        <generado_en>${escapeXml(formatIsoDateTimeInElSalvador())}</generado_en>
    </meta>
    <entradas>${entradasXml}</entradas>
</reporte>`;
}

function runCommand(bin, args, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        let stdout = '';
        let stderr = '';

        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`Tiempo de espera agotado al ejecutar JasperStarter (${timeoutMs} ms).`));
        }, timeoutMs);

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        child.on('close', (code) => {
            clearTimeout(timeout);
            if (code !== 0) {
                return reject(new Error(`JasperStarter finalizo con codigo ${code}. ${stderr || stdout}`));
            }
            resolve({ stdout, stderr });
        });
    });
}

function writePdfWithPdfKit(outputPdf, { paciente, historial, generadoPor }) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(outputPdf);

        stream.on('finish', resolve);
        stream.on('error', reject);
        doc.on('error', reject);

        doc.pipe(stream);

        doc.fontSize(18).text('Informe de Historial Medico', { align: 'center' });
        doc.moveDown(0.5);

        doc.fontSize(11).text(`Paciente: ${paciente.nombre || ''} (${paciente.id})`);
        doc.text(`Email: ${paciente.email || '-'}`);
        doc.text(`Telefono: ${paciente.telefono || '-'}`);
        doc.text(`Generado por: ${generadoPor || '-'}`);
        doc.text(`Generado en: ${formatDateTimeInElSalvador()}`);

        doc.moveDown(1);

        const entradas = Array.isArray(historial) ? historial : [];
        if (entradas.length === 0) {
            doc.fontSize(12).text('No hay entradas en el historial medico para este paciente.');
            doc.end();
            return;
        }

        entradas.forEach((e, index) => {
            if (index > 0) {
                doc.moveDown(0.8);
                doc.strokeColor('#D1D5DB').moveTo(doc.x, doc.y).lineTo(555, doc.y).stroke();
                doc.moveDown(0.6);
            }

            doc.fontSize(11).font('Helvetica-Bold').text(`Fecha: ${e.fecha_consulta || '-'}`);
            doc.font('Helvetica').text(`Doctor: ${e.doctor_nombre || e.doctor_id || '-'}`);
            doc.text(`Sintomas: ${e.sintomas || '-'}`);
            doc.text(`Diagnostico: ${e.diagnostico || '-'}`);
            doc.text(`Tratamiento: ${e.tratamiento || '-'}`);
            doc.text(`Notas: ${e.notas || '-'}`);
        });

        doc.end();
    });
}

async function generarPdfConFallbackPdfKit({ workDir, outputPdf, paciente, historial, generadoPor }) {
    await fsp.mkdir(workDir, { recursive: true });
    await writePdfWithPdfKit(outputPdf, { paciente, historial, generadoPor });

    if (!fs.existsSync(outputPdf)) {
        throw new Error('No se genero el archivo PDF del informe con PDFKit.');
    }

    const cleanup = async () => {
        try {
            await fsp.rm(workDir, { recursive: true, force: true });
        } catch (err) {
            console.error('No se pudo limpiar el directorio temporal del reporte:', err);
        }
    };

    return { pdfPath: outputPdf, cleanup, engine: 'pdfkit' };
}

async function generarInformeHistorialPacientePdf({ paciente, historial, generadoPor }) {
    ensureReportsStructure();

    const jasperBin = process.env.JASPERSTARTER_BIN || 'jasperstarter';
    const runId = crypto.randomUUID();
    const workDir = path.join(OUTPUT_DIR, `tmp-${runId}`);
    const xmlPath = path.join(workDir, 'historial.xml');
    const outputBase = path.join(workDir, `historial-${paciente.id}`);
    const outputPdf = `${outputBase}.pdf`;

    const forcePdfKit = String(process.env.REPORT_ENGINE || '').toLowerCase() === 'pdfkit';

    if (forcePdfKit) {
        return generarPdfConFallbackPdfKit({ workDir, outputPdf, paciente, historial, generadoPor });
    }

    if (!fs.existsSync(TEMPLATE_HISTORIAL)) {
        return generarPdfConFallbackPdfKit({ workDir, outputPdf, paciente, historial, generadoPor });
    }

    await fsp.mkdir(workDir, { recursive: true });

    const xmlContent = buildHistorialXml({ paciente, historial, generadoPor });
    await fsp.writeFile(xmlPath, xmlContent, 'utf8');

    const args = [
        'pr',
        TEMPLATE_HISTORIAL,
        '-f', 'pdf',
        '-o', outputBase,
        '-t', 'xml',
        '--data-file', xmlPath,
        '--xml-xpath', '/reporte/entradas/entrada',
        '-P', `P_PACIENTE_ID=${paciente.id}`,
        '-P', `P_PACIENTE_NOMBRE=${paciente.nombre || ''}`,
        '-P', `P_PACIENTE_EMAIL=${paciente.email || ''}`,
        '-P', `P_PACIENTE_TELEFONO=${paciente.telefono || ''}`,
        '-P', `P_GENERADO_POR=${generadoPor || ''}`,
        '-P', `P_GENERADO_EN=${formatDateTimeInElSalvador()}`,
    ];

    try {
        await runCommand(jasperBin, args, 120000);
    } catch (error) {
        return generarPdfConFallbackPdfKit({ workDir, outputPdf, paciente, historial, generadoPor });
    }

    if (!fs.existsSync(outputPdf)) {
        return generarPdfConFallbackPdfKit({ workDir, outputPdf, paciente, historial, generadoPor });
    }

    const cleanup = async () => {
        try {
            await fsp.rm(workDir, { recursive: true, force: true });
        } catch (err) {
            console.error('No se pudo limpiar el directorio temporal del reporte:', err);
        }
    };

    return {
        pdfPath: outputPdf,
        cleanup,
        engine: 'jasper',
    };
}

module.exports = {
    generarInformeHistorialPacientePdf,
};