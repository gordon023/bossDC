import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import fetch from "node-fetch";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ==== PostgreSQL setup ====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/bosstimer"
});

// Discord webhook
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1433449406056763557/nifC_lCD78cMTOoMY6ryDBlain76udKiIEVOitIWT_n8XqygjGj_GWU0zDEf8v6GTxGu";

// Track connected clients
let viewerCount = 0;

// ===== SOCKET CONNECTION =====
io.on("connection", async (socket) => {
  viewerCount++;
  io.emit("viewerCount", viewerCount);
  const result = await pool.query("SELECT * FROM timers ORDER BY acquired DESC");
  socket.emit("updateTimers", result.rows);

  socket.on("disconnect", () => {
    viewerCount--;
    io.emit("viewerCount", viewerCount);
  });
});

// ===== API ROUTES =====

// Add new timer
app.post("/add", async (req, res) => {
  const { id, name, location, acquired, nextSpawn } = req.body;
  await pool.query(
    "INSERT INTO timers (id, name, location, acquired, next_spawn) VALUES ($1,$2,$3,$4,$5)",
    [id, name, location, acquired, nextSpawn]
  );
  updateAllClients();
  res.json({ success: true });
});

// Delete timer
app.post("/delete", async (req, res) => {
  const { id, code } = req.body;
  if (code !== "bernbern") return res.status(403).json({ error: "Invalid code" });
  await pool.query("DELETE FROM timers WHERE id=$1", [id]);
  updateAllClients();
  res.json({ success: true });
});

// Broadcast all timers
async function updateAllClients() {
  const result = await pool.query("SELECT * FROM timers ORDER BY acquired DESC");
  io.emit("updateTimers", result.rows);
}

// ====== Timer Monitoring (for Discord Alerts) ======
async function monitorTimers() {
  const now = new Date();
  const result = await pool.query("SELECT * FROM timers");
  for (const t of result.rows) {
    const diff = new Date(t.next_spawn) - now;
    if (diff <= 0) {
      await sendToDiscord(`🔥 ${t.name} has spawned!`);
      await pool.query("DELETE FROM timers WHERE id=$1", [t.id]);
      updateAllClients();
    } else if (diff <= 15 * 60 * 1000 && diff > 14 * 60 * 1000) {
      await sendToDiscord(`⚔️ ${t.name} will spawn in 15 minutes!`);
    }
  }
}
setInterval(monitorTimers, 60000); // every 1 minute

async function sendToDiscord(message) {
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
  } catch (err) {
    console.error("Discord Webhook Error:", err);
  }
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
