import express from "express";
import fs from "fs";
import http from "http";
import { Server } from "socket.io";
import fetch from "node-fetch";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

let timers = JSON.parse(fs.readFileSync("timers.json", "utf8"));
let viewerCount = 0;
const WEBHOOK =
  "https://discord.com/api/webhooks/1433449406056763557/nifC_lCD78cMTOoMY6ryDBlain76udKiIEVOitIWT_n8XqygjGj_GWU0zDEf8v6GTxGu";

// ----------- helper -------------
function saveTimers() {
  fs.writeFileSync("timers.json", JSON.stringify(timers, null, 2));
}
async function sendDiscord(msg) {
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg }),
    });
  } catch (e) {
    console.error("Discord error:", e);
  }
}

// ----------- socket -------------
io.on("connection", (socket) => {
  viewerCount++;
  io.emit("viewerCount", viewerCount);
  socket.emit("timers", timers);

  socket.on("disconnect", () => {
    viewerCount--;
    io.emit("viewerCount", viewerCount);
  });

  socket.on("addTimer", (t) => {
    timers.push(t);
    saveTimers();
    io.emit("timers", timers);
  });

  socket.on("deleteTimer", (id) => {
    timers = timers.filter((x) => x.id !== id);
    saveTimers();
    io.emit("timers", timers);
  });
});

// ----------- tick -------------
setInterval(() => {
  const now = Date.now();
  timers.forEach((t) => {
    if (t.remaining <= 0) return;
    t.remaining -= 1000;

    // 15-minute alert
    if (t.remaining === 15 * 60 * 1000) {
      sendDiscord(`⚠️ ${t.name} will spawn in 15 minutes!`);
    }

    // spawn alert
    if (t.remaining <= 0) {
      t.remaining = 0;
      sendDiscord(`🟢 ${t.name} spawned!`);
    }
  });
  saveTimers();
  io.emit("timers", timers);
}, 1000);

server.listen(PORT, () => console.log(`Server running on ${PORT}`));
