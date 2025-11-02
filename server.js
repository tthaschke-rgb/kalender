import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- GRUNDEINSTELLUNGEN ---
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(express.json()); // Ersetzt bodyParser

// --- MONGOOSE MODELLE (angepasst an Ihre RTF-Datei) ---

// 1. Mitarbeiter
const employeeSchema = new mongoose.Schema({
    // 'id' wird von MongoDB als '_id' verwaltet, aber wir fügen eine 'id'-Kopie hinzu,
    // da Ihr Frontend 'id' zu verwenden scheint. Besser wäre, das Frontend auf '_id' umzustellen.
    // Für jetzt duplizieren wir es, um Kompatibilität zu gewährleisten.
    firstName: { type: String, required: true },
    color: { type: String, required: true },
    dailyHours: { type: Object, default: {} }, // Individuelle Arbeitszeiten
    holidays: { type: Array, default: [] }, // Individuelle Feiertage
}, { timestamps: true });

// Sicherstellen, dass die 'id' mit der '_id' übereinstimmt, wenn sie vom Frontend kommt
employeeSchema.pre('save', function(next) {
    if (this.isNew) {
        // Beim Erstellen wird 'id' nicht gesetzt, Mongoose erstellt '_id'
    }
    next();
});

const Employee = mongoose.model('Employee', employeeSchema);

// 2. Termine
const appointmentSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    title: { type: String, required: true }, // Wird als customerName verwendet
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    startHour: { type: Number, required: true },
    startMinute: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    serviceId: { type: String, default: null },
}, { timestamps: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

// 3. Kalender-Einstellungen (speichert alles andere in einem einzigen Dokument)
const DEFAULT_SETTINGS = {
    calendarName: 'Team-Planungsübersicht',
    dailyHours: {
        'So': { enabled: false, start: 9, end: 18 },
        'Mo': { enabled: true, start: 9, end: 18 },
        'Di': { enabled: true, start: 9, end: 18 },
        'Mi': { enabled: true, start: 9, end: 18 },
        'Do': { enabled: true, start: 9, end: 18 },
        'Fr': { enabled: true, start: 9, end: 18 },
        'Sa': { enabled: false, start: 9, end: 18 },
    },
    services: [
        { id: 'default-1', name: 'Herrenhaarschnitt', durationMinutes: 30 },
        { id: 'default-2', name: 'Damen-Coloration', durationMinutes: 120 }
    ],
    holidays: [] // Globale Feiertage
};

const settingsSchema = new mongoose.Schema({
    calendarName: { type: String, default: DEFAULT_SETTINGS.calendarName },
    dailyHours: { type: Object, default: DEFAULT_SETTINGS.dailyHours },
    services: { type: Array, default: DEFAULT_SETTINGS.services },
    holidays: { type: Array, default: DEFAULT_SETTINGS.holidays }
});

const Setting = mongoose.model('Setting', settingsSchema);

// --- DATENBANKVERBINDUNG ---
if (!MONGO_URI) {
    console.error("------------------------------------------------------------------");
    console.error("❌ FEHLER: Umgebungsvariable MONGO_URI ist nicht gesetzt.");
    console.error("Der Server kann nicht ohne Datenbankverbindung starten.");
    console.error("Setzen Sie diese Variable in Ihren Render-Einstellungen.");
    console.error("------------------------------------------------------------------");
    process.exit(1); // Beendet den Serverstart, wenn die URI fehlt
}

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ Erfolgreich mit MongoDB verbunden.");
    })
    .catch(err => {
        console.error("❌ Datenbankverbindungsfehler:", err.message);
        console.error("Stellen Sie sicher, dass die IP-Adresse von Render in Atlas freigegeben ist (0.0.0.0/0) und die Anmeldedaten korrekt sind.");
    });


// =========================================================
// --- API ENDPUNKTE (ROUTEN) ---
// =========================================================

// --- EINSTELLUNGEN (Services, Feiertage, Name, etc.) ---

// GET: Lädt das einzelne Einstellungs-Dokument
app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) {
            // Wenn keine Einstellungen vorhanden sind, die Standardeinstellungen erstellen
            console.log("Keine Einstellungen gefunden. Erstelle Standardeinstellungen...");
            settings = new Setting(DEFAULT_SETTINGS);
            await settings.save();
        }
        res.status(200).json(settings);
    } catch (error) {
        console.error("Fehler beim Abrufen der Einstellungen:", error);
        res.status(500).json({ message: "Fehler beim Laden der Einstellungen." });
    }
});

// POST: Speichert das einzelne Einstellungs-Dokument
// (nutzt findOneAndUpdate mit upsert=true, um es zu erstellen, falls es nicht existiert)
app.post('/api/settings', async (req, res) => {
    try {
        const updatedSettings = await Setting.findOneAndUpdate({}, req.body, {
            new: true, // Gibt das aktualisierte Dokument zurück
            upsert: true, // Erstellt das Dokument, falls es nicht existiert
            runValidators: true
        });
        res.status(200).json(updatedSettings);
    } catch (error) {
        console.error("Fehler beim Speichern der Einstellungen:", error);
        res.status(400).json({ message: "Fehler beim Speichern der Einstellungen.", error: error.message });
    }
});


// --- MITARBEITER (Employees) ---

// GET: Alle Mitarbeiter laden
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await Employee.find().sort({ createdAt: 1 });
        // MongoDB _id in id umwandeln, damit das Frontend es versteht
        const employeesWithId = employees.map(emp => {
            const empObj = emp.toObject();
            empObj.id = empObj._id.toString();
            return empObj;
        });
        res.status(200).json(employeesWithId);
    } catch (error) {
        res.status(500).json({ message: "Fehler beim Laden der Mitarbeiter." });
    }
});

// POST: Neuen Mitarbeiter erstellen
app.post('/api/employees', async (req, res) => {
    try {
        const { firstName, color } = req.body;
        const newEmployee = new Employee({ 
            firstName, 
            color,
            dailyHours: {}, // Startet mit leeren individuellen Stunden
            holidays: [] 
        });
        await newEmployee.save();
        
        const empObj = newEmployee.toObject();
        empObj.id = empObj._id.toString(); // ID für das Frontend hinzufügen
        
        res.status(201).json(empObj);
    } catch (error) {
        res.status(400).json({ message: "Fehler beim Hinzufügen des Mitarbeiters.", error: error.message });
    }
});

// PUT: Mitarbeiter aktualisieren (Name, Farbe, Arbeitszeiten, Feiertage)
app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const updatedEmployee = await Employee.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!updatedEmployee) {
            return res.status(404).json({ message: "Mitarbeiter nicht gefunden." });
        }
        
        const empObj = updatedEmployee.toObject();
        empObj.id = empObj._id.toString(); // ID für das Frontend hinzufügen

        res.status(200).json(empObj);
    } catch (error) {
        res.status(400).json({ message: "Fehler beim Aktualisieren des Mitarbeiters.", error: error.message });
    }
});

// DELETE: Mitarbeiter löschen
app.delete('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedEmployee = await Employee.findByIdAndDelete(id);
        if (!deletedEmployee) {
            return res.status(404).json({ message: "Mitarbeiter nicht gefunden." });
        }
        res.status(200).json({ message: "Mitarbeiter erfolgreich gelöscht." });
    } catch (error) {
        res.status(500).json({ message: "Fehler beim Löschen des Mitarbeiters." });
    }
});


// --- TERMINE (Appointments) ---

// GET: Alle Termine laden
app.get('/api/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.find();
         // MongoDB _id in id umwandeln
        const appointmentsWithId = appointments.map(apt => {
            const aptObj = apt.toObject();
            aptObj.id = aptObj._id.toString();
            return aptObj;
        });
        res.status(200).json(appointmentsWithId);
    } catch (error) {
        res.status(500).json({ message: "Fehler beim Laden der Termine." });
    }
});

// POST: Neuen Termin erstellen
app.post('/api/appointments', async (req, res) => {
    try {
        // 'title' wird vom Frontend als customerName gesetzt
        const appointmentData = req.body;
        appointmentData.title = appointmentData.customerName; 
        
        const newAppointment = new Appointment(appointmentData);
        await newAppointment.save();
        
        const aptObj = newAppointment.toObject();
        aptObj.id = aptObj._id.toString(); // ID für das Frontend hinzufügen

        res.status(201).json(aptObj);
    } catch (error) {
        res.status(400).json({ message: "Fehler beim Erstellen des Termins.", error: error.message });
    }
});

// PUT: Termin aktualisieren
app.put('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const appointmentData = req.body;
        appointmentData.title = appointmentData.customerName; // Titel synchronisieren

        const updatedAppointment = await Appointment.findByIdAndUpdate(id, appointmentData, { new: true, runValidators: true });
        if (!updatedAppointment) {
            return res.status(404).json({ message: "Termin nicht gefunden." });
        }
        
        const aptObj = updatedAppointment.toObject();
        aptObj.id = aptObj._id.toString(); // ID für das Frontend hinzufügen
        
        res.status(200).json(aptObj);
    } catch (error) {
        res.status(400).json({ message: "Fehler beim Aktualisieren des Termins.", error: error.message });
    }
});

// DELETE: Termin löschen
app.delete('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedAppointment = await Appointment.findByIdAndDelete(id);
        if (!deletedAppointment) {
            return res.status(404).json({ message: "Termin nicht gefunden." });
        }
        res.status(200).json({ message: "Termin erfolgreich gelöscht." });
    } catch (error) {
        res.status(500).json({ message: "Fehler beim Löschen des Termins." });
    }
});


// =========================================================
// --- STATISCHE DATEIEN UND FALLBACK ---
// =========================================================

// Statische Dateien aus dem 'public' Ordner bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Hauptseite (index.html) für alle anderen GET-Anfragen bereitstellen (für Single Page App)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// =========================================================
// --- SERVER START ---
// =========================================================
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
    console.log(`Frontend wird aus ${path.join(__dirname, 'public')} bereitgestellt.`);
});

