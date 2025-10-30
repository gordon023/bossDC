// server.js (CommonJS)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "timers.json");

// <-- put your webhook here (you gave this earlier; it's used as-is) -->
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1433449406056763557/nifC_lCD78cMTOoMY6ryDBlain76udKiIEVOitIWT_n8XqygjGj_GWU0zDEf8v6GTxGu";

// special delete code required
const DELETE_CODE = "bernbern";

// load or init timers file
let timers = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    timers = JSON.parse(raw) || [];
  } else {
    timers = [];
    fs.writeFileSync(DATA_FILE, JSON.stringify(timers, null, 2));
  }
} catch (e) {
  console.error("Failed to read timers.json:", e);
  timers = [];
}

function saveTimers() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(timers, null, 2));
  } catch (err) {
    console.error("Failed to save timers.json:", err);
  }
}

// static public folder
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// simple API endpoint (returns timers)
app.get("/api/timers", (req, res) => {
  res.json(timers);
});

// socket.io realtime
io.on("connection", (socket) => {
  console.log("conn:", socket.id);

  // send initial
  socket.emit("init", timers);

  // broadcast viewer count
  io.emit("viewerCount", { count: io.engine.clientsCount });

  socket.on("addTimer", (obj) => {
    if (!obj || !obj.id) return;
    // avoid duplicate id
    if (!timers.find(t => t.id === obj.id)) {
      timers.push({ ...obj, spawned: false });
      saveTimers();
      io.emit("update", timers);
      console.log("Added timer:", obj.name);
    }
  });

  socket.on("deleteTimer", (payload) => {
    // payload: { id, code }
    try {
      if (!payload || !payload.id) return;
      const { id, code } = payload;
      if (code !== DELETE_CODE) {
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
      console.error("deleteTimer err:", e);
    }
  });

  socket.on("disconnect", () => {
    console.log("disconn:", socket.id);
    io.emit("viewerCount", { count: io.engine.clientsCount });
  });
});

// ---- Discord notifier ----
// track which IDs we've warned/announced in-memory
const warned15 = new Set();
const announcedSpawn = new Set();

async function postDiscord(content) {
  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content });
  } catch (e) {
    console.error("Discord webhook error:", e.message || e);
  }
}

// Check every 30 seconds for 15-min and spawn events
setInterval(async () => {
  if (!timers || timers.length === 0) return;
  const now = Date.now();

  for (const t of timers) {
    if (!t.nextSpawn) continue;
    const spawnMs = new Date(t.nextSpawn).getTime();
    const minsLeft = Math.floor((spawnMs - now) / 60000);

    // 15-minute warning
    if (minsLeft === 15 && !warned15.has(t.id) && !t.spawned) {
      warned15.add(t.id);
      const msg = `⚠️ **${t.name}** will spawn in **15 minutes!**`;
      await postDiscord(msg);
      console.log("Discord 15m:", t.name);
    }

    // spawn
    if (minsLeft <= 0 && !announcedSpawn.has(t.id)) {
      announcedSpawn.add(t.id);
      // mark spawned
      t.spawned = true;
      t.spawnedTime = new Date().toISOString();
      saveTimers();
      io.emit("update", timers);
      const msg = `🟢 **${t.name}** has spawned!`;
      await postDiscord(msg);
      console.log("Discord spawn:", t.name);
    }
  }
}, 30 * 1000);

// start server
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
