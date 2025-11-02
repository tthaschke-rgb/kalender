import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Konfiguration ---
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// ES-Module Äquivalent für __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors()); // CORS für alle Anfragen aktivieren
app.use(express.json()); // Body-Parser für JSON
app.use(express.static(path.join(__dirname, 'public'))); // Frontend-Dateien bereitstellen

// --- Standardeinstellungen (wird verwendet, wenn die DB leer ist) ---
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
    holidays: []
};

// --- MongoDB-Verbindung ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB verbunden...'))
  .catch(err => console.error('MongoDB Verbindungsfehler:', err));

// --- Mongoose Schemas ---
const ServiceSchema = new mongoose.Schema({
    id: String,
    name: String,
    durationMinutes: Number
}, { _id: false });

const HolidaySchema = new mongoose.Schema({
    start: String,
    end: String
}, { _id: false });

const DailyHoursSchema = new mongoose.Schema({
    enabled: Boolean,
    start: Number,
    end: Number
}, { _id: false });

// Schema für Kalender-Einstellungen (als einzelnes Dokument gespeichert)
const SettingsSchema = new mongoose.Schema({
    calendarName: { type: String, default: 'Team-Planungsübersicht' },
    dailyHours: {
        type: Map,
        of: DailyHoursSchema,
        default: DEFAULT_SETTINGS.dailyHours
    },
    services: { type: [ServiceSchema], default: DEFAULT_SETTINGS.services },
    holidays: { type: [HolidaySchema], default: DEFAULT_SETTINGS.holidays }
});
const Settings = mongoose.model('Settings', SettingsSchema);

// Mitarbeiter Schema
const EmployeeSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    color: { type: String, required: true },
    dailyHours: {
        type: Map,
        of: DailyHoursSchema,
        default: {}
    },
    holidays: { type: [HolidaySchema], default: [] }
}, { timestamps: true });
const Employee = mongoose.model('Employee', EmployeeSchema);

// Termin Schema
const AppointmentSchema = new mongoose.Schema({
    employeeId: { type: String, required: true }, // Wir verwenden hier String, um die Kompatibilität mit der Frontend-Logik zu wahren
    customerName: { type: String, required: true },
    customerPhone: String,
    customerEmail: String,
    startHour: { type: Number, required: true },
    startMinute: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    date: { type: String, required: true },
    serviceId: String,
    title: String // Behalte das 'title'-Feld bei, falls es noch verwendet wird
}, { timestamps: true });
const Appointment = mongoose.model('Appointment', AppointmentSchema);

// --- API-Routen ---
const router = express.Router();

// HELPER: Einstellungen abrufen oder erstellen
async function getSettings() {
    let settings = await Settings.findOne();
    if (!settings) {
        console.log('Keine Einstellungen gefunden, erstelle Standardeinstellungen...');
        settings = new Settings(DEFAULT_SETTINGS);
        await settings.save();
    }
    return settings;
}

// --- EINSTELLUNGEN ---
router.get('/settings', async (req, res) => {
    try {
        const settings = await getSettings();
        res.json(settings);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.post('/settings', async (req, res) => {
    try {
        const settings = await Settings.findOneAndUpdate({}, req.body, {
            new: true,
            upsert: true // Erstellt, falls nicht vorhanden
        });
        res.json(settings);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- MITARBEITER ---
router.get('/employees', async (req, res) => {
    try {
        const employees = await Employee.find().sort({ createdAt: 1 });
        // Wandle _id in id um, damit es zum Frontend passt
        const frontendEmployees = employees.map(emp => ({
            ...emp.toObject(),
            id: emp._id.toString()
        }));
        res.json(frontendEmployees);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.post('/employees', async (req, res) => {
    try {
        const newEmployee = new Employee(req.body);
        await newEmployee.save();
        res.status(201).json({ ...newEmployee.toObject(), id: newEmployee._id.toString() });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

router.put('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedEmployee = await Employee.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedEmployee) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        res.json({ ...updatedEmployee.toObject(), id: updatedEmployee._id.toString() });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

router.delete('/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedEmployee = await Employee.findByIdAndDelete(id);
        if (!deletedEmployee) return res.status(404).json({ message: 'Mitarbeiter nicht gefunden' });
        res.status(204).send(); // No Content
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// --- TERMINE ---
router.get('/appointments', async (req, res) => {
    try {
        const appointments = await Appointment.find();
        // Wandle _id in id um
        const frontendAppointments = appointments.map(apt => ({
            ...apt.toObject(),
            id: apt._id.toString()
        }));
        res.json(frontendAppointments);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.post('/appointments', async (req, res) => {
    try {
        // Stelle sicher, dass 'title' gesetzt ist, wenn 'customerName' vorhanden ist
        const data = { ...req.body };
        if (data.customerName && !data.title) {
            data.title = data.customerName;
        }
        
        const newAppointment = new Appointment(data);
        await newAppointment.save();
        res.status(201).json({ ...newAppointment.toObject(), id: newAppointment._id.toString() });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

router.put('/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Stelle sicher, dass 'title' gesetzt ist, wenn 'customerName' vorhanden ist
        const data = { ...req.body };
        if (data.customerName && !data.title) {
            data.title = data.customerName;
        }

        const updatedAppointment = await Appointment.findByIdAndUpdate(id, data, { new: true });
        if (!updatedAppointment) return res.status(404).json({ message: 'Termin nicht gefunden' });
        res.json({ ...updatedAppointment.toObject(), id: updatedAppointment._id.toString() });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

router.delete('/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedAppointment = await Appointment.findByIdAndDelete(id);
        if (!deletedAppointment) return res.status(404).json({ message: 'Termin nicht gefunden' });
        res.status(204).send(); // No Content
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Alle API-Routen unter /api registrieren
app.use('/api', router);

// --- Frontend-Catchall-Route ---
// Alle anderen Anfragen an die index.html leiten, damit das Client-Side-Routing funktioniert
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Serverstart ---
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
