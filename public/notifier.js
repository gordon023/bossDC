import axios from "axios";

const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/XXXX/YYYY";
const SITE_API = "https://boss-1-jhbq.onrender.com/api/timers"; // needs to expose timer data as JSON

// remember which bosses we've already notified for
let notified15 = new Set();
let notifiedSpawn = new Set();

async function checkBosses() {
  try {
    const res = await axios.get(SITE_API);
    const timers = res.data; // [{name, spawnAt, spawned}, ...]

    const now = Date.now();
    for (const t of timers) {
      if (t.spawned) continue;
      const mins = Math.floor((t.spawnAt - now) / 60000);

      // 15-minute warning
      if (mins === 15 && !notified15.has(t.name)) {
        await axios.post(DISCORD_WEBHOOK, {
          content: `⏰ **${t.name}** will spawn in **15 minutes**!`
        });
        notified15.add(t.name);
      }

      // Spawned
      if (mins <= 0 && !notifiedSpawn.has(t.name)) {
        await axios.post(DISCORD_WEBHOOK, {
          content: `🔥 **${t.name}** has spawned!`
        });
        notifiedSpawn.add(t.name);
      }
    }
  } catch (err) {
    console.error("check failed:", err.message);
  }
}

// check every minute
setInterval(checkBosses, 60_000);
checkBosses();
