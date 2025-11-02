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

// --- 1. DATENBANK-VERBINDUNG ---
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error("------------------------------------------------------------------");
    console.error("❌ FEHLER: Umgebungsvariable MONGO_URI ist nicht gesetzt. API-Routen werden nicht funktionieren.");
    console.error("Setzen Sie diese Variable in Ihren Render-Einstellungen oder in Ihrer lokalen .env-Datei.");
    consoleider.");
    console.error("------------------------------------------------------------------");
    // Beenden Sie den Prozess nicht, um statische Dateien bereitzustellen, auch wenn die DB nicht funktioniert
} else {
    mongoose.connect(mongoUri)
        .then(() => console.log('✅ MongoDB erfolgreich verbunden.'))
        .catch(err => {
            console.error('❌ MongoDB Verbindungsfehler:', err.message);
        });
}


// Middleware für JSON-Anfragen
app.use(express.json());


// ====================================================================
// --- DATENBANK MODELLE (MONGOOSE SCHEMATA) ---
// ====================================================================

// Schema für Termine/Kalendereinträge
const AppointmentSchema = new mongoose.Schema({
    employeeId: { type: String, required: true }, // Zu welchem Mitarbeiter gehört der Termin
    date: { type: String, required: true },       // Datum als String (YYYY-MM-DD)
    startHour: { type: Number, required: true },  // Startstunde
    endHour: { type: Number, required: true },    // Endstunde
    title: { type: String, default: "Termin" },   // Titel des Termins
    details: { type: String }                     // Zusätzliche Details
});

const Appointment = mongoose.model('Appointment', AppointmentSchema);


// Schema für Mitarbeiter (enthält Arbeitszeiten)
const EmployeeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Eindeutige ID (wie in Firebase)
    name: { type: String, required: true },
    dailyHours: { // Arbeitszeiten pro Wochentag
        type: Map,
        of: {
            start: Number,
            end: Number
        },
        default: {}
    }
});

const Employee = mongoose.model('Employee', EmployeeSchema);

// Platzhalter-Mitarbeiter beim ersten Start (nur wenn keine Mitarbeiter vorhanden sind)
// Dies simuliert die Firebase-Initialisierung.
async function initializeEmployees() {
    if (mongoose.connection.readyState !== 1) { // 1 = connected
        console.warn('DB noch nicht verbunden, überspringe Mitarbeiter-Initialisierung.');
        return;
    }
    try {
        const count = await Employee.countDocuments();
        if (count === 0) {
            console.log("Keine Mitarbeiter gefunden. Füge Initialdaten hinzu...");
            await Employee.insertMany([
                { id: "e1", name: "Max Mustermann", dailyHours: { "Mon": { start: 9, end: 17 }, "Tue": { start: 9, end: 17 }, "Wed": { start: 9, end: 17 }, "Thu": { start: 9, end: 17 }, "Fri": { start: 9, end: 17 } } },
                { id: "e2", name: "Erika Musterfrau", dailyHours: { "Mon": { start: 10, end: 18 }, "Tue": { start: 10, end: 18 }, "Wed": { start: 10, end: 18 }, "Thu": { start: 10, end: 18 }, "Fri": { start: 10, end: 18 } } }
            ]);
            console.log("Initialdaten erfolgreich gespeichert.");
        }
    } catch (error) {
        console.error("Fehler beim Initialisieren der Mitarbeiterdaten:", error);
    }
}

// Initialisieren nach erfolgreicher DB-Verbindung
if (mongoUri) {
    mongoose.connection.on('connected', initializeEmployees);
}


// ====================================================================
// --- API-ROUTEN (CRUD) ---
// ====================================================================

// ** 1. Termine abrufen (READ) **
app.get('/api/appointments', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: "Datenbank ist nicht verbunden." });
    }
    try {
        // Lädt alle Termine
        const appointments = await Appointment.find({});
        res.json(appointments);
    } catch (error) {
        console.error("Fehler beim Abrufen der Termine:", error);
        res.status(500).json({ error: "Datenbankfehler beim Laden der Termine." });
    }
});

// ** 2. Termin speichern (CREATE) **
app.post('/api/appointments', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: "Datenbank ist nicht verbunden." });
    }
    try {
        const newAppointment = new Appointment(req.body);
        await newAppointment.save();
        res.status(201).json(newAppointment);
    } catch (error) {
        console.error("Fehler beim Erstellen des Termins:", error);
        res.status(400).json({ error: "Fehler beim Erstellen des Termins: " + error.message });
    }
});

// ** 3. Termin aktualisieren (UPDATE) **
app.put('/api/appointments/:id', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: "Datenbank ist nicht verbunden." });
    }
    try {
        // Finde den Termin anhand der MongoDB _id und aktualisiere ihn
        const updatedAppointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true } // 'new: true' gibt das aktualisierte Dokument zurück
        );

        if (!updatedAppointment) {
            return res.status(404).json({ error: "Termin nicht gefunden." });
        }
        res.json(updatedAppointment);
    } catch (error) {
        console.error("Fehler beim Aktualisieren des Termins:", error);
        res.status(400).json({ error: "Fehler beim Aktualisieren des Termins: " + error.message });
    }
});

// ** 4. Termin löschen (DELETE) **
app.delete('/api/appointments/:id', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: "Datenbank ist nicht verbunden." });
    }
    try {
        const result = await Appointment.findByIdAndDelete(req.params.id);

        if (!result) {
            return res.status(404).json({ error: "Termin nicht gefunden." });
        }
        res.status(204).send(); // 204 No Content
    } catch (error) {
        console.error("Fehler beim Löschen des Termins:", error);
        res.status(500).json({ error: "Datenbankfehler beim Löschen des Termins." });
    }
});

// ** 5. Mitarbeiter abrufen (READ) **
app.get('/api/employees', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: "Datenbank ist nicht verbunden." });
    }
    try {
        // Lädt alle Mitarbeiter
        const employees = await Employee.find({});
        res.json(employees);
    } catch (error) {
        console.error("Fehler beim Abrufen der Mitarbeiter:", error);
        res.status(500).json({ error: "Datenbankfehler beim Laden der Mitarbeiter." });
    }
});


// ====================================================================
// --- STATISCHE DATEIEN UND FALLBACK ---
// ====================================================================

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
