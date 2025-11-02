import express from 'express';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Umgebungsvariablen laden (.env Datei)
dotenv.config();

// Hilfsvariablen für __dirname in ES-Modulen
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(express.json());

// =========================================================
// --- MONGOOSE SETUP & SCHEMA ---
// =========================================================

// Mongoose Schema für Termine
const appointmentSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startHour: { type: Number, required: true, min: 0, max: 23 },
    endHour: { type: Number, required: true, min: 1, max: 24 },
    title: { type: String, required: true }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

// Mongoose Schema für Mitarbeiter (wird hauptsächlich für initiales Laden verwendet)
const employeeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    dailyHours: { type: Object } // Arbeitszeiten pro Wochentag
});

const Employee = mongoose.model('Employee', employeeSchema);


// =========================================================
// --- DATENBANKVERBINDUNG ---
// =========================================================

mongoose.connect(MONGO_URI)
    .then(() => {
        // HIER WAR VERMUTLICH DER FEHLER IN DER VORHERIGEN VERSION!
        console.log("✅ Erfolgreich mit MongoDB verbunden."); 
        // Initialdaten laden, falls die Collection leer ist (einmaliger Vorgang)
        initializeData();
    })
    .catch(err => {
        console.error("❌ Datenbankverbindungsfehler:", err);
    });

// Initialdaten für Mitarbeiter (simuliert)
const initialEmployees = [
    { id: 'e1', name: 'Max Mustermann', dailyHours: { Mon: { start: 9, end: 17 }, Tue: { start: 9, end: 17 }, Wed: { start: 9, end: 17 }, Thu: { start: 9, end: 17 }, Fri: { start: 9, end: 17 } } },
    { id: 'e2', name: 'Erika Musterfrau', dailyHours: { Mon: { start: 10, end: 18 }, Tue: { start: 10, end: 18 }, Wed: { start: 8, end: 16 }, Thu: { start: 10, end: 18 }, Fri: { start: 10, end: 18 } } },
    { id: 'e3', name: 'Tim Tester', dailyHours: { Mon: { start: 8, end: 16 }, Tue: { start: 8, end: 16 }, Wed: { start: 9, end: 17 }, Thu: { start: 8, end: 16 }, Fri: { start: 8, end: 16 } } }
];

async function initializeData() {
    try {
        const employeeCount = await Employee.countDocuments();
        if (employeeCount === 0) {
            await Employee.insertMany(initialEmployees);
            console.log("Initialdaten für Mitarbeiter wurden in MongoDB eingefügt.");
        }
    } catch (err) {
        console.error("Fehler beim Initialisieren der Mitarbeiterdaten:", err);
    }
}


// =========================================================
// --- API ENDPUNKTE (ROUTEN) ---
// =========================================================

// 1. Mitarbeiter laden
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await Employee.find({}, { _id: 0, __v: 0 }); // Schließt MongoDB-interne Felder aus
        res.status(200).json(employees);
    } catch (error) {
        console.error("Fehler beim Abrufen der Mitarbeiter:", error);
        res.status(500).json({ message: "Fehler beim Laden der Mitarbeiterdaten." });
    }
});

// 2. Termine laden
app.get('/api/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.find({});
        res.status(200).json(appointments);
    } catch (error) {
        console.error("Fehler beim Abrufen der Termine:", error);
        res.status(500).json({ message: "Fehler beim Laden der Termindaten." });
    }
});

// 3. Neuen Termin erstellen (POST)
app.post('/api/appointments', async (req, res) => {
    try {
        const newAppointment = new Appointment(req.body);
        await newAppointment.save();
        res.status(201).json(newAppointment);
    } catch (error) {
        console.error("Fehler beim Erstellen des Termins:", error);
        res.status(400).json({ message: "Ungültige Termindaten.", error: error.message });
    }
});

// 4. Termin aktualisieren (PUT)
app.put('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const updatedAppointment = await Appointment.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!updatedAppointment) {
            return res.status(404).json({ message: "Termin nicht gefunden." });
        }
        res.status(200).json(updatedAppointment);
    } catch (error) {
        console.error(`Fehler beim Aktualisieren des Termins ${id}:`, error);
        res.status(400).json({ message: "Fehler beim Aktualisieren des Termins.", error: error.message });
    }
});

// 5. Termin löschen (DELETE)
app.delete('/api/appointments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedAppointment = await Appointment.findByIdAndDelete(id);
        if (!deletedAppointment) {
            return res.status(404).json({ message: "Termin nicht gefunden." });
        }
        res.status(200).json({ message: "Termin erfolgreich gelöscht." });
    } catch (error) {
        console.error(`Fehler beim Löschen des Termins ${id}:`, error);
        res.status(500).json({ message: "Fehler beim Löschen des Termins." });
    }
});


// =========================================================
// --- STATISCHE DATEIEN UND FALLBACK ---
// =========================================================

// Statische Dateien aus dem 'public' Ordner bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Hauptseite für alle anderen GET-Anfragen bereitstellen
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// =========================================================
// --- SERVER START ---
// =========================================================

app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
