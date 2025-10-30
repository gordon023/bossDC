// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Config
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "timers.json");
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1433449406056763557/nifC_lCD78cMTOoMY6ryDBlain76udKiIEVOitIWT_n8XqygjGj_GWU0zDEf8v6GTxGu";
const DELETE_SPECIAL_CODE = "bernbern";

// serve static files from public/
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Load timers (simple JSON persistence)
let timers = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    timers = JSON.parse(raw) || [];
  }
} catch (e) {
  console.error("Failed to load timers.json:", e.message);
  timers = [];
}

function saveTimers() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(timers, null, 2));
  } catch (e) {
    console.error("Failed to save timers.json:", e.message);
  }
}

// REST API: return timers for external scripts
app.get("/api/timers", (req, res) => {
  return res.json(timers);
});

// If OCR endpoint exists previously, keep a placeholder to avoid breaking UI upload
app.post("/api/ocr", (req, res) => {
  // Placeholder: front-end expects { text: "..." } shape. Implement OCR if desired.
  res.json({ text: "" });
});

// Socket.IO: realtime sync + viewer count + events
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send initial data
  socket.emit("init", timers);

  // Broadcast viewer count
  const sendViewerCount = () => io.emit("viewerCount", { count: io.engine.clientsCount });
  sendViewerCount();

  // add timer
  socket.on("addTimer", (obj) => {
    // basic validation
    if (!obj || !obj.id) return;
    // ensure no duplicate id
    if (!timers.find(t => t.id === obj.id)) {
      const entry = { ...obj, spawned: false };
      timers.push(entry);
      saveTimers();
      io.emit("update", timers);
      console.log("Added timer:", entry.name);
    }
  });

  // delete timer with code validation
  // payload: { id, code }
  socket.on("deleteTimer", (payload) => {
    try {
      if (!payload || !payload.id) return;
      const { id, code } = payload;
      if (code !== DELETE_SPECIAL_CODE) {
        // Tell only requester that delete denied
        socket.emit("deleteDenied", { id, message: "Special code incorrect. Delete canceled." });
        return;
      }
      const before = timers.length;
      timers = timers.filter(t => t.id !== id);
      if (timers.length !== before) {
        saveTimers();
        io.emit("update", timers);
        socket.emit("deletedSuccess", { id });
        console.log("Deleted timer:", id);
      }
    } catch (e) {
      console.error("deleteTimer error:", e);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    sendViewerCount();
  });
});

// ---- Discord notifier logic ----
// We track which timer IDs we've warned / announced to avoid duplicate messages while service is running.
const warned15 = new Set();
const announcedSpawn = new Set();

// Helper to post to Discord webhook
async function postDiscordMessage(text) {
  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content: text });
  } catch (e) {
    console.error("Failed to send Discord webhook:", e.message || e);
  }
}

// Periodic check every 30 seconds
setInterval(async () => {
  if (!timers || timers.length === 0) return;
  const now = Date.now();

  for (const t of timers) {
    // only handle timers with nextSpawn defined
    if (!t.nextSpawn) continue;

    const spawnTime = new Date(t.nextSpawn).getTime();
    const minsLeft = Math.floor((spawnTime - now) / (60 * 1000));

    // 15-minute warning
    if (minsLeft === 15 && !warned15.has(t.id)) {
      warned15.add(t.id);
      const msg = `⚠️ **${t.name}** will spawn in **15 minutes!**`;
      await postDiscordMessage(msg);
      console.log("Discord 15-min warning sent for", t.name);
    }

    // Spawned (<= 0)
    if (minsLeft <= 0 && !announcedSpawn.has(t.id)) {
      announcedSpawn.add(t.id);
      // mark as spawned in server data so UI can consider it if desired
      t.spawned = true;
      t.spawnedTime = new Date().toISOString();
      const msg = `🟢 **${t.name}** has spawned!`;
      await postDiscordMessage(msg);
      saveTimers();
      io.emit("update", timers);
      console.log("Discord spawn message sent for", t.name);
    }
  }
}, 30 * 1000); // every 30s

// Start server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
