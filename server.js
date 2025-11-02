// Team Planner Kalender - Backend-Server für MongoDB
//
// Dieser Server stellt die REST-API-Endpunkte bereit und dient als sichere Brücke
// zwischen dem Frontend-Code und der MongoDB Atlas-Datenbank.
// 
// WICHTIG: Die MongoDB-Verbindungszeichenfolge MUSS als Umgebungsvariable
// 'MONGODB_URI' in der Render-Konfiguration gesetzt werden.

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Für Cross-Origin Resource Sharing

const app = express();
const port = process.env.PORT || 3000; // Liest den Port von Render (standardmäßig 3000)

// --- 1. MongoDB Konfiguration ---
// Verbindung wird aus der Umgebungsvariable MONGODB_URI geladen.
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FEHLER: Die Umgebungsvariable MONGODB_URI ist nicht gesetzt. Der Server wird beendet.');
    // In einer Produktionsumgebung wie Render ist es wichtig, den Prozess zu beenden,
    // wenn die Datenbankverbindung fehlt.
    process.exit(1); 
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Atlas erfolgreich verbunden. Verwendung der DB: ' + mongoose.connection.name))
    .catch(err => {
        console.error('MongoDB Verbindungsfehler. Bitte prüfen Sie die Umgebungsvariable MONGODB_URI.', err);
        process.exit(1); // Prozess bei Verbindungsfehler beenden
    });

// --- 2. Mongoose Schema definieren ---
const eventSchema = new mongoose.Schema({
    // Der Titel der Kalenderveranstaltung
    title: { type: String, required: true }, 
    // Identifier des Benutzers/Teams, der das Event erstellt hat
    userId: { type: String, required: true }, 
    // Datum der Veranstaltung (z.B. "2025-11-01")
    date: { type: String, required: true }, 
    // Startzeit (z.B. "09:00")
    startTime: { type: String, required: true }, 
    // Endzeit (z.B. "10:30")
    endTime: { type: String, required: true }, 
    // Timestamp der Erstellung
    createdAt: { type: Date, default: Date.now }
});

const Event = mongoose.model('Event', eventSchema);

// --- 3. Middleware ---
// CORS-Konfiguration: Erlaubt Anfragen von jedem Frontend.
// Da Render als API agiert, ist dies für die Kommunikation mit dem Frontend wichtig.
app.use(cors()); 
app.use(express.json()); // Erlaubt das Parsen von JSON im Request Body

// --- 4. API-Routen (CRUD-Operationen) ---

// GET: Alle Events abrufen
// Endpunkt: /api/events
app.get('/api/events', async (req, res) => {
    try {
        // Ruft alle Events ab und sortiert sie nach Datum und Startzeit
        const events = await Event.find().sort({ date: 1, startTime: 1 });
        res.status(200).json(events);
    } catch (error) {
        console.error('Fehler beim Abrufen der Events:', error);
        res.status(500).json({ message: 'Interner Serverfehler beim Abrufen der Events' });
    }
});

// POST/PUT: Event erstellen oder aktualisieren
// Endpunkt: /api/events
// Diese Route wird sowohl für POST (Erstellung) als auch für PUT (Aktualisierung) verwendet,
// basierend darauf, ob das Event-Objekt eine '_id' enthält.
app.post('/api/events', async (req, res) => {
    const eventData = req.body;
    
    if (eventData._id) {
        // Aktualisieren eines bestehenden Events
        try {
            const updatedEvent = await Event.findByIdAndUpdate(
                eventData._id, 
                eventData, 
                { new: true, runValidators: true } // 'new: true' gibt das aktualisierte Dokument zurück
            );
            if (!updatedEvent) {
                return res.status(404).json({ message: 'Event zur Aktualisierung nicht gefunden' });
            }
            res.status(200).json(updatedEvent);
        } catch (error) {
            console.error('Fehler beim Aktualisieren des Events:', error);
            res.status(400).json({ message: 'Fehlerhafte Anfrage beim Aktualisieren' });
        }
    } else {
        // Erstellen eines neuen Events
        try {
            const newEvent = new Event(eventData);
            await newEvent.save();
            res.status(201).json(newEvent);
        } catch (error) {
            console.error('Fehler beim Erstellen des Events:', error);
            // Mongoose Validation Errors führen zu 400
            res.status(400).json({ message: 'Fehlerhafte Anfrage beim Erstellen: ' + error.message });
        }
    }
});

// DELETE: Event löschen
// Endpunkt: /api/events/:id
app.delete('/api/events/:id', async (req, res) => {
    try {
        const deletedEvent = await Event.findByIdAndDelete(req.params.id);
        if (!deletedEvent) {
            return res.status(404).json({ message: 'Event zum Löschen nicht gefunden' });
        }
        // 204 No Content ist der Standard-Antwortcode für erfolgreiches Löschen
        res.status(204).send(); 
    } catch (error) {
        console.error('Fehler beim Löschen des Events:', error);
        res.status(500).json({ message: 'Interner Serverfehler beim Löschen' });
    }
});


// --- 5. Server starten ---
app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`);
    console.log(`API-Basis-URL: https://kalender-a6b4.onrender.com/api/events`);
});
