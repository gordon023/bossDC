import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Create table if not exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS timers (
      id SERIAL PRIMARY KEY,
      boss TEXT NOT NULL,
      location TEXT NOT NULL,
      acquired TIMESTAMP NOT NULL,
      next_spawn TIMESTAMP NOT NULL
    );
  `);
})();

// Fetch timers
app.get("/api/timers", async (req, res) => {
  const result = await pool.query("SELECT * FROM timers ORDER BY next_spawn ASC");
  res.json(result.rows);
});

// Add new timer
app.post("/api/timers", async (req, res) => {
  const { boss, location, acquired, next_spawn } = req.body;
  const result = await pool.query(
    "INSERT INTO timers (boss, location, acquired, next_spawn) VALUES ($1, $2, $3, $4) RETURNING *",
    [boss, location, acquired, next_spawn]
  );
  io.emit("timerAdded", result.rows[0]);
  res.json(result.rows[0]);
});

// Delete timer
app.delete("/api/timers/:id", async (req, res) => {
  const { id } = req.params;
  await pool.query("DELETE FROM timers WHERE id=$1", [id]);
  io.emit("timerDeleted", id);
  res.json({ success: true });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
