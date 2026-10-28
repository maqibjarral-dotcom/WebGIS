// Environmental Monitoring WebGIS - Express + PostGIS backend
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

// ---- CONFIG (edit password, or set PGPASSWORD env var) ----
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'env_gis', user: 'postgres',
  password: process.env.PGPASSWORD || 'YOUR_POSTGRES_PASSWORD'
});
const USERS = { admin: 'admin123' };   // "authorized users" (demo-level auth)
const tokens = new Map();              // token -> username

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));     // serves the frontend

// Middleware: only logged-in users may modify data
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!tokens.has(t)) return res.status(401).json({ error: 'Login required' });
  req.user = tokens.get(t); next();
}
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(500).json({ error: e.message }));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] && USERS[username] === password) {
    const t = crypto.randomBytes(16).toString('hex'); tokens.set(t, username);
    return res.json({ token: t, user: username });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// GET all stations as GeoJSON, each with its LATEST observation. Optional filters: type, status, province
app.get('/api/stations', wrap(async (req, res) => {
  const { type, status, province } = req.query, w = [], v = [];
  if (type)     { v.push(type);     w.push(`s.type=$${v.length}`); }
  if (status)   { v.push(status);   w.push(`s.status=$${v.length}`); }
  if (province) { v.push(province); w.push(`s.province=$${v.length}`); }
  const { rows } = await pool.query(`
    SELECT s.id,s.name,s.type,s.city,s.province,s.status,s.installed_on,
           ST_AsGeoJSON(s.geom)::json AS geometry,
           o.observed_at,o.temperature_c,o.humidity_pct,o.rainfall_mm,o.pm25,o.wind_kph
    FROM stations s
    LEFT JOIN LATERAL (SELECT * FROM observations WHERE station_id=s.id ORDER BY observed_at DESC LIMIT 1) o ON TRUE
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY s.name`, v);
  res.json({ type: 'FeatureCollection',
    features: rows.map(({ geometry, ...p }) => ({ type: 'Feature', geometry, properties: p })) });
}));

// GET observation history of one station
app.get('/api/stations/:id/observations', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM observations WHERE station_id=$1 ORDER BY observed_at DESC LIMIT 50', [req.params.id]);
  res.json(rows);
}));

// ADD station
app.post('/api/stations', auth, wrap(async (req, res) => {
  const s = req.body;
  const { rows } = await pool.query(
    `INSERT INTO stations (name,type,city,province,status,installed_on,geom)
     VALUES ($1,$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint($7,$8),4326)) RETURNING id`,
    [s.name, s.type, s.city, s.province, s.status || 'Active', s.installed_on || null, s.lng, s.lat]);
  res.json(rows[0]);
}));

// UPDATE station (attributes + status)
app.put('/api/stations/:id', auth, wrap(async (req, res) => {
  const s = req.body;
  await pool.query(`UPDATE stations SET name=$1,type=$2,city=$3,province=$4,status=$5 WHERE id=$6`,
    [s.name, s.type, s.city, s.province, s.status, req.params.id]);
  res.json({ ok: true });
}));

// ADD observation for a station
app.post('/api/stations/:id/observations', auth, wrap(async (req, res) => {
  const o = req.body, n = x => (x === '' || x == null ? null : x);
  const { rows } = await pool.query(
    `INSERT INTO observations (station_id,observed_at,temperature_c,humidity_pct,rainfall_mm,pm25,wind_kph,notes,recorded_by,source)
     VALUES ($1,COALESCE($2,now()),$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [req.params.id, n(o.observed_at), n(o.temperature_c), n(o.humidity_pct), n(o.rainfall_mm),
     n(o.pm25), n(o.wind_kph), o.notes, req.user, o.source || 'student-collected']);
  res.json(rows[0]);
}));

// UPDATE an existing observation
app.put('/api/observations/:id', auth, wrap(async (req, res) => {
  const o = req.body, n = x => (x === '' || x == null ? null : x);
  await pool.query(
    `UPDATE observations SET temperature_c=$1,humidity_pct=$2,rainfall_mm=$3,pm25=$4,wind_kph=$5,notes=$6 WHERE id=$7`,
    [n(o.temperature_c), n(o.humidity_pct), n(o.rainfall_mm), n(o.pm25), n(o.wind_kph), o.notes, req.params.id]);
  res.json({ ok: true });
}));

app.listen(3000, () => console.log('Running: http://localhost:3000'));
