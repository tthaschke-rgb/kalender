import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// --- WICHTIG: Environment Variables laden (für lokale Entwicklung) ---
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Hilfsvariablen für ESM (ES Modules) - Äquivalent zu __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. DATENBANK-VERBINDUNG FIX ---
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error("------------------------------------------------------------------");
    console.error("❌ FEHLER: Umgebungsvariable MONGO_URI ist nicht gesetzt. API-Routen werden nicht funktionieren.");
    console.error("Setzen Sie diese Variable in Ihren Render-Einstellungen oder in Ihrer lokalen .env-Datei.");
    console.error("------------------------------------------------------------------");
} else {
    mongoose.connect(mongoUri)
        .then(() => console.log('✅ MongoDB erfolgreich verbunden.'))
        .catch(err => {
            console.error('❌ MongoDB Verbindungsfehler:', err.message);
            // In einer Produktionsanwendung würden Sie hier process.exit(1) aufrufen.
        });
}


// Middleware für JSON-Anfragen
app.use(express.json());

// ====================================================================
// --- NEU: API-ROUTEN HINZUFÜGEN ---
// Das Frontend versucht, Daten von Endpunkten wie diesen zu laden.
// Diese müssen definiert sein, um 404-Fehler zu vermeiden.
// ====================================================================

// Beispiel-Platzhalter für die Datenmodelle
// In einer echten Anwendung würden Sie hier Ihre Mongoose-Modelle importieren:
// import Employee from './models/Employee.js';
// import Appointment from './models/Appointment.js';

app.get('/api/employees', async (req, res) => {
    if (!mongoose.connection.readyState) {
        return res.status(503).json({ error: "Datenbank ist nicht verbunden." });
    }
    try {
        // --- TODO: HIER IHR ECHTES DATENBANK-MODELL VERWENDEN ---
        // const employees = await Employee.find({});
        // res.json(employees);

        // PLACEHOLDER-DATEN, falls die MongoDB-Verbindung fehlschlägt oder das Modell fehlt
        res.json([
            { id: "e1", name: "Max Mustermann", dailyHours: { "Mon": { start: 9, end: 17 } } },
            { id: "e2", name: "Erika Musterfrau", dailyHours: { "Tue": { start: 10, end: 18 } } }
        ]);
    } catch (error) {
        console.error("Fehler beim Abrufen der Mitarbeiter:", error);
        res.status(500).json({ error: "Datenbankfehler beim Laden der Mitarbeiter." });
    }
});

app.get('/api/appointments', async (req, res) => {
    if (!mongoose.connection.readyState) {
        return res.status(503).json({ error: "Datenbank ist nicht verbunden." });
    }
    try {
        // --- TODO: HIER IHR ECHTES DATENBANK-MODELL VERWENDEN ---
        // const appointments = await Appointment.find({});
        // res.json(appointments);

        // PLACEHOLDER-DATEN
        res.json([
            // { employeeId: "e1", date: "2025-10-25", startHour: 10, endHour: 11, title: "Meeting" }
        ]);
    } catch (error) {
        console.error("Fehler beim Abrufen der Termine:", error);
        res.status(500).json({ error: "Datenbankfehler beim Laden der Termine." });
    }
});


// --- 2. STATISCHE DATEIEN FIX ---
// Express mitteilen, wo die statischen Dateien (index.html, CSS, Bilder) liegen.
app.use(express.static(path.join(__dirname, 'public')));

// Fallback für alle nicht gefundenen Routen, um die index.html zu servieren
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error(`❌ Fehler beim Senden von index.html: Datei existiert nicht unter ${path.join(__dirname, 'public', 'index.html')}`);
            res.status(404).send('Die Hauptdatei (index.html) wurde nicht gefunden. Bitte prüfen Sie den Ordner "public".');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
    console.log(`Dies ist die URL, die in der Render-Konsole ausgegeben wurde: https://kalender-qyj1.onrender.com`);
});

// Exportieren Sie die App, falls Sie sie in anderen Modulen verwenden möchten
export default app;
