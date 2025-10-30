import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import multer from "multer";
import Tesseract from "tesseract.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "timers.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

// ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

function loadTimers() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}
function saveTimers(timers) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(timers, null, 2));
}

let timers = loadTimers();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// REST endpoint (optional): fetch timers
app.get("/api/timers", (req, res) => {
  res.json(timers);
});

// OCR upload endpoint
app.post("/api/ocr", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const imagePath = req.file.path;
  try {
    const result = await Tesseract.recognize(imagePath, "eng", { logger: m => {} });
    const text = (result.data && result.data.text) ? result.data.text : "";
    // cleanup
    try { fs.unlinkSync(imagePath); } catch(e){ /* ignore */ }
    return res.json({ text });
  } catch (err) {
    console.error("OCR error:", err);
    try { fs.unlinkSync(imagePath); } catch(e){ /* ignore */ }
    return res.status(500).json({ error: "OCR failed" });
  }
});

// Socket.io realtime
io.on("connection", (socket) => {
  // on connect, send current timers
  socket.emit("init", timers);

  // client wants to add a timer (already computed nextSpawn on client)
  socket.on("addTimer", (timer) => {
    // Normalize & ensure id
    timer.id = timer.id || `${Date.now()}-${Math.floor(Math.random()*10000)}`;
    timers.push(timer);
    saveTimers(timers);
    io.emit("update", timers);
  });

  // client requests delete by id
  socket.on("deleteTimer", (id) => {
    timers = timers.filter(t => t.id !== id);
    saveTimers(timers);
    io.emit("update", timers);
  });

  // client sends entire timers array (overwrite)
  socket.on("replaceAll", (newTimers) => {
    timers = newTimers || [];
    saveTimers(timers);
    io.emit("update", timers);
  });

  // optional: edit timer
  socket.on("editTimer", (updated) => {
    timers = timers.map(t => t.id === updated.id ? updated : t);
    saveTimers(timers);
    io.emit("update", timers);
  });

  socket.on("disconnect", () => {});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
