import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.static("public"));
app.use(express.json());

// Multer (for image uploads)
const upload = multer({ dest: "uploads/" });

// Example Discord webhook (optional)
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// ---------- ROUTES ----------

// Fetch all active timers
app.get("/api/timers", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM timers ORDER BY next_spawn ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
  }
});

// Add new timer
app.post("/api/timers", async (req, res) => {
  try {
    const { boss, location, acquired, next_spawn } = req.body;
    const result = await pool.query(
      "INSERT INTO timers (boss, location, acquired, next_spawn) VALUES ($1,$2,$3,$4) RETURNING *",
      [boss, location, acquired, next_spawn]
    );

    // Discord notification
    if (DISCORD_WEBHOOK) {
      await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `🕓 New Boss Timer Added: ${boss} (${location})` })
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding timer.");
  }
});

// Delete timer
app.delete("/api/timers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM timers WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting timer.");
  }
});

// Image detection upload (stub)
app.post("/api/upload", upload.single("screenshot"), async (req, res) => {
  try {
    // ⚠️ Replace this section with your OCR logic or ML API
    const detectedBoss = "Venatus";
    const detectedLocation = "Corrupted Basin";

    res.json({
      boss: detectedBoss,
      location: detectedLocation,
      acquired: new Date(),
      next_spawn: new Date(Date.now() + 4 * 60 * 60 * 1000)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing image.");
  }
});

app.listen(port, () => console.log(`✅ Boss kaba running on port ${port}`));
