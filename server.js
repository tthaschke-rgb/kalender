// --- Importe ---
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

// --- Konfiguration ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// ES Module Workaround für __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors()); // CORS für alle Anfragen aktivieren
app.use(express.json()); // Body-Parser für JSON-Anfragen
app.use(express.static(path.join(__dirname, 'public'))); // Stellt das Frontend bereit

// --- MongoDB-Verbindung ---
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error("------------------------------------------------------------------");
    console.error("❌ FEHLER: Umgebungsvariable MONGO_URI ist nicht gesetzt.");
    console.error("Setzen Sie diese Variable in Ihren Render-Einstellungen.");
    console.error("------------------------------------------------------------------");
} else {
    mongoose.connect(mongoUri)
        .then(() => console.log("✅ Erfolgreich mit MongoDB verbunden."))
        .catch(err => console.error("❌ MongoDB Verbindungsfehler:", err.message));
}

// =========================================================
// --- MongoDB-Modelle (Datenbankschema) ---
// =========================================================

// --- Einstellungen-Modell ---
const settingsSchema = new mongoose.Schema({
    calendarName: { type: String, required: true, default: 'Team-Planungsübersicht' },
    dailyHours: { type: Object, default: {
        'So': { enabled: false, start: 9, end: 18 },
        'Mo': { enabled: true, start: 9, end: 18 },
        'Di': { enabled: true, start: 9, end: 18 },
        'Mi': { enabled: true, start: 9, end: 18 },
        'Do': { enabled: true, start: 9, end: 18 },
        'Fr': { enabled: true, start: 9, end: 18 },
        'Sa': { enabled: false, start: 9, end: 18 },
    }},
    services: { type: Array, default: [
        { id: 'default-1', name: 'Herrenhaarschnitt', durationMinutes: 30 },
        { id: 'default-2', name: 'Damen-Coloration', durationMinutes: 120 }
    ]},
    holidays: { type: Array, default: [] }
}, {
    // Stellt sicher, dass nur eine Einstellungs-Kollektion existiert
    collection: 'settings',
    capped: { size: 1024, max: 1 } 
});

// Stellt sicher, dass das Model nur einmal kompiliert wird
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

// --- Mitarbeiter-Modell ---
const employeeSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    color: { type: String, required: true },
    dailyHours: { type: Object, default: {} }, // Leeres Objekt für individuelle Überschreibungen
    holidays: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

// Virtuelles Feld 'id' hinzufügen, das '_id' als String zurückgibt
employeeSchema.virtual('id').get(function() { return this._id.toHexString(); });
employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);

// --- Termin-Modell ---
const appointmentSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    customerEmail: { type: String },
    startHour: { type: Number, required: true },
    startMinute: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    serviceId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

appointmentSchema.virtual('id').get(function() { return this._id.toHexString(); });
appointmentSchema.set('toJSON', { virtuals: true });
appointmentSchema.set('toObject', { virtuals: true });

const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);


// =========================================================
// --- API-Routen (Hier werden die Daten bereitgestellt) ---
// =========================================================

// --- 1. EINSTELLUNGEN ---

// (GET) Globale Einstellungen abrufen
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            // Wenn keine Einstellungen vorhanden sind, die Standardeinstellungen erstellen
            console.log("Keine Einstellungen gefunden, erstelle Standard...");
            settings = new Settings();
            await settings.save();
        }
        res.json(settings);
    } catch (err) {
        console.error("API Fehler [GET /api/settings]:", err);
        res.status(500).json({ message: err.message });
    }
});

// (POST) Globale Einstellungen aktualisieren
app.post('/api/settings', async (req, res) => {
    try {
        const updatedSettings = await Settings.findOneAndUpdate(
            {}, // Finde das einzige Dokument
            req.body, // Ersetze es mit den neuen Daten
            { new: true, upsert: true } // 'new: true' gibt das neue Dokument zurück, 'upsert: true' erstellt es, falls es nicht existiert
        );
        res.json(updatedSettings);
    } catch (err) {
        console.error("API Fehler [POST /api/settings]:", err);
        res.status(500).json({ message: err.message });
    }
});

// --- 2. MITARBEITER ---

// (GET) Alle Mitarbeiter abrufen
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await Employee.find().sort({ firstName: 1 });
        res.json(employees);
    } catch (err) {
        console.error("API Fehler [GET /api/employees]:", err);
        res.status(500).json({ message: err.message });
    }
});

// (POST) Neuen Mitarbeiter erstellen
app.post('/api/employees', async (req, res) => {
    const { firstName, color } = req.body;
    try {
        const newEmployee = new Employee({
            firstName,
            color,
            dailyHours: {}, // Standard-Leereinstellung
            holidays: []
        });
        await newEmployee.save();
        res.status(201).json(newEmployee);
    } catch (err) {
        console.error("API Fehler [POST /api/employees]:", err);
        res.status(400).json({ message: err.message });
    }
});

// (PUT) Mitarbeiter aktualisieren
app.put('/api/employees/:id', async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!employee) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        res.json(employee);
    } catch (err) {
        console.error("API Fehler [PUT /api/employees/:id]:", err);
        res.status(400).json({ message: err.message });
    }
});

// (DELETE) Mitarbeiter löschen
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        res.json({ message: 'Mitarbeiter gelöscht' });
    } catch (err) {
        console.error("API Fehler [DELETE /api/employees/:id]:", err);
        res.status(500).json({ message: err.message });
    }
});

// --- 3. TERMINE ---

// (GET) Alle Termine abrufen
app.get('/api/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.find();
        res.json(appointments);
    } catch (err) {
        console.error("API Fehler [GET /api/appointments]:", err);
        res.status(500).json({ message: err.message });
    }
});

// (POST) Neuen Termin erstellen
app.post('/api/appointments', async (req, res) => {
    try {
        const newAppointment = new Appointment(req.body);
        await newAppointment.save();
        res.status(201).json(newAppointment);
    } catch (err) {
        console.error("API Fehler [POST /api/appointments]:", err);
        res.status(400).json({ message: err.message });
    }
});

// (PUT) Termin aktualisieren
app.put('/api/appointments/:id', async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!appointment) return res.status(404).json({ message: 'Termin nicht gefunden' });
        res.json(appointment);
    } catch (err) {
        console.error("API Fehler [PUT /api/appointments/:id]:", err);
        res.status(400).json({ message: err.message });
    }
});

// (DELETE) Termin löschen
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndDelete(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Termin nicht gefunden' });
        res.json({ message: 'Termin gelöscht' });
    } catch (err) {
        console.error("API Fehler [DELETE /api/appointments/:id]:", err);
        res.status(500).json({ message: err.message });
    }
});


// =========================================================
// --- Fallback-Route (Muss nach allen API-Routen stehen) ---
// =========================================================

// Diese Route fängt alle Anfragen ab, die nicht zu einer API-Route passen,
// und sendet stattdessen die 'index.html'.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Serverstart ---
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
    console.log(`Frontend wird aus ${path.join(__dirname, 'public')} bereitgestellt.`);
});

