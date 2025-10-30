const socket = io();
const viewerCountEl = document.getElementById("viewerCount");
const activeBody = document.getElementById("activeBody");
const imageUpload = document.getElementById("imageUpload");
const uploadBtn = document.getElementById("uploadBtn");
const clearOcrBtn = document.getElementById("clearOcrBtn");
const statusEl = document.getElementById("status");
const manualBoss = document.getElementById("manualBoss");
const manualAcquired = document.getElementById("manualAcquired");
const manualAdd = document.getElementById("manualAdd");
const manualStatus = document.getElementById("manualStatus");

// Example boss list
const bossList = [
  "Venatus", "Kafra", "Eddga", "Orc Lord", "Dracula",
  "Phreeoni", "Baphomet", "Stormy Knight", "Dark Lord", "Amon Ra"
];
bossList.forEach(b => {
  const opt = document.createElement("option");
  opt.value = b;
  opt.textContent = b;
  manualBoss.appendChild(opt);
});

// ====== SOCKET.IO ======
socket.on("updateTimers", timers => renderTimers(timers));
socket.on("viewerCount", n => viewerCountEl.textContent = n);

// ====== FUNCTIONS ======
async function renderTimers(timers) {
  activeBody.innerHTML = "";
  timers.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.name}</td>
      <td>${t.location || "-"}</td>
      <td>${new Date(t.acquired).toLocaleString()}</td>
      <td>${new Date(t.next_spawn).toLocaleString()}</td>
      <td>${getRemaining(t.next_spawn)}</td>
      <td><button class="bg-red-600 text-white px-2 py-1 rounded deleteBtn" data-id="${t.id}">Delete</button></td>
    `;
    activeBody.appendChild(tr);
  });
  attachDeleteEvents();
}

function getRemaining(nextSpawn) {
  const diff = new Date(nextSpawn) - new Date();
  if (diff <= 0) return "Spawned";
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${hrs}h ${mins}m ${secs}s`;
}

function attachDeleteEvents() {
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.onclick = async () => {
      const code = prompt("You want to delete this timer? Please input special code:");
      if (code !== "bernbern") return alert("Invalid code.");
      await fetch("/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: btn.dataset.id, code })
      });
    };
  });
}

// Update remaining timers every second
setInterval(() => {
  document.querySelectorAll("#activeBody tr").forEach(tr => {
    const nextSpawnText = tr.children[3]?.textContent;
    if (!nextSpawnText) return;
    const td = tr.children[4];
    const diff = new Date(nextSpawnText) - new Date();
    if (diff <= 0) td.textContent = "Spawned";
    else {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      td.textContent = `${hrs}h ${mins}m ${secs}s`;
    }
  });
}, 1000);

// ====== OCR UPLOAD ======
uploadBtn.onclick = async () => {
  const file = imageUpload.files[0];
  if (!file) return alert("No image selected.");
  statusEl.textContent = "Detecting...";
  const { createWorker } = Tesseract;
  const worker = await createWorker();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  const result = await worker.recognize(file);
  await worker.terminate();

  const text = result.data.text.toLowerCase();
  statusEl.textContent = "Detection done.";

  let foundBoss = null;
  for (const boss of bossList) {
    if (text.includes(boss.toLowerCase())) foundBoss = boss;
  }

  if (!foundBoss) {
    statusEl.textContent = "No boss detected.";
    return;
  }

  const now = new Date();
  const nextSpawn = new Date(now.getTime() + 8 * 3600000); // example 8h respawn
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await fetch("/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      name: foundBoss,
      location: "Unknown",
      acquired: now,
      nextSpawn
    })
  });
  statusEl.textContent = `Added ${foundBoss} timer.`;
};

// Clear OCR status
clearOcrBtn.onclick = () => {
  statusEl.textContent = "";
  imageUpload.value = "";
};

// ====== MANUAL ADD ======
manualAdd.onclick = async () => {
  const boss = manualBoss.value;
  const acquired = manualAcquired.value;
  if (!boss || !acquired) {
    manualStatus.textContent = "Please fill all fields.";
    return;
  }
  const now = new Date(acquired);
  const nextSpawn = new Date(now.getTime() + 8 * 3600000); // example 8h respawn
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await fetch("/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      name: boss,
      location: "Unknown",
      acquired: now,
      nextSpawn
    })
  });
  manualStatus.textContent = `${boss} added successfully.`;
};
