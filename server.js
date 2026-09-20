const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'students.json');

app.use(cors());
app.use(express.json());

// Serve static files (index.html, views/, js/, style/, etc.) from project root
const STATIC_DIR = path.join(__dirname);
app.use(express.static(STATIC_DIR));

// Ensure root serves index.html explicitly (helps when directory settings vary)
app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading data file:', e);
    return [];
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing data file:', e);
  }
}

// GET /students - devuelve lista completa
app.get('/students', (req, res) => {
  const list = readData();
  res.json(list);
});

// POST /students - crear o marcar estudiante como el último (activo)
// body: { name }
app.post('/students', (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });

  const students = readData();
  const normalized = name.trim();
  // Buscar por nombre (case-insensitive)
  const idx = students.findIndex(s => s.name && s.name.toLowerCase() === normalized.toLowerCase());
  let student;
  if (idx !== -1) {
    // mover al final
    student = students.splice(idx, 1)[0];
    student.lastActiveAt = new Date().toISOString();
    students.push(student);
  } else {
    student = {
      name: normalized,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      totalPoints: 0,
      performances: []
    };
    students.push(student);
  }
  writeData(students);
  res.json(student);
});

// POST /students/:name/performance - agregar registro de rendimiento
// body: { points, reason, snapshot }
app.post('/students/:name/performance', (req, res) => {
  const name = req.params.name;
  const { points = 0, reason = '', snapshot = null } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name param required' });

  const students = readData();
  const idx = students.findIndex(s => s.name && s.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'student not found' });

  const student = students[idx];
  const entry = {
    points: Number(points) || 0,
    reason: reason || '',
    timestamp: new Date().toISOString(),
    snapshot: snapshot || null
  };
  student.performances = student.performances || [];
  student.performances.push(entry);
  student.totalPoints = (student.totalPoints || 0) + entry.points;
  student.lastActiveAt = new Date().toISOString();

  // move student to end to mark active
  students.splice(idx, 1);
  students.push(student);

  writeData(students);
  res.json({ ok: true, entry, student });
});

// simple helper to download the students.json file
app.get('/download/students.json', (req, res) => {
  res.download(DATA_FILE, 'students.json', (err) => {
    if (err) res.status(500).send('Error descargando el archivo');
  });
});

app.listen(PORT, () => {
  console.log(`Students server running on http://localhost:${PORT}`);
});
