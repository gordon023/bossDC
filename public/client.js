// public/client.js
(() => {
  const socket = io();

  const bossReference = {
    "Venatus": { time: 10, loc: "Corrupted Basin" },
    "Viorent": { time: 10, loc: "Crescent Lake" },
    "Ego": { time: 21, loc: "Ulan Canyon" },
    "Livera": { time: 24, loc: "Protector`s Ruins" },
    "Araneo": { time: 24, loc: "Lower Tomb of Tyriosa 1F" },
    "Undomiel": { time: 24, loc: "Secret Laboratory" },
    "Lady Dalia": { time: 18, loc: "Twilight Hill" },
    "General Aquleus": { time: 29, loc: "Lower Tomb of Tyriosa 2F" },
    "Amentis": { time: 29, loc: "Land of Glory" },
    "Baron Braudmore": { time: 32, loc: "Battlefield of Templar" },
    "Wannitas": { time: 48, loc: "Plateau of Revolution" },
    "Metus": { time: 48, loc: "Plateau of Revolution" },
    "Duplican": { time: 48, loc: "Plateau of Revolution" },
    "Shuliar": { time: 95, loc: "Ruins of the War" },
    "Gareth": { time: 32, loc: "Deadman`s Land District 1" },
    "Titore": { time: 37, loc: "Deadman`s Land District 2" },
    "Larba": { time: 35, loc: "Ruins of the War" },
    "Catena": { time: 35, loc: "Deadman`s Land District 3" },
    "Secreta": { time: 62, loc: "Silvergrass Field" },
    "Ordo": { time: 62, loc: "Silvergrass Field" },
    "Asta": { time: 62, loc: "Silvergrass Field" },
    "Supore": { time: 62, loc: "Silvergrass Field" }
  };

  // UI elements
  const manualBoss = document.getElementById("manualBoss");
  const manualAcquired = document.getElementById("manualAcquired");
  const manualAddBtn = document.getElementById("manualAdd");
  const manualStatus = document.getElementById("manualStatus");
  const imageUpload = document.getElementById("imageUpload");
  const uploadBtn = document.getElementById("uploadBtn");
  const clearOcrBtn = document.getElementById("clearOcrBtn");
  const statusEl = document.getElementById("status");
  const activeBody = document.getElementById("activeBody");
  const viewerCountEl = document.getElementById("viewerCount");

  let timers = [];

  // populate boss dropdown
  function populateBossDropdown() {
    manualBoss.innerHTML = "<option value=''>Select Boss</option>";
    Object.keys(bossReference).forEach(name => {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      manualBoss.appendChild(o);
    });
  }
  populateBossDropdown();

  function makeTimerObj(name, acquiredDate) {
    const ref = bossReference[name] || { time: 24, loc: "Unknown" };
    const acquired = new Date(acquiredDate);
    const nextSpawn = new Date(acquired.getTime() + ref.time * 60 * 60 * 1000);
    return {
      id: `${Date.now()}-${Math.floor(Math.random()*10000)}`,
      name,
      location: ref.loc,
      acquired: acquired.toISOString(),
      nextSpawn: nextSpawn.toISOString()
    };
  }

  // Socket events
  socket.on("init", (data) => {
    timers = (data || []).filter(t => !t.spawned);
    renderAll();
  });

  socket.on("update", (data) => {
    timers = (data || []).filter(t => !t.spawned);
    renderAll();
  });

  socket.on("viewerCount", (payload) => {
    try {
      const c = payload && payload.count ? payload.count : payload;
      viewerCountEl.textContent = c;
    } catch (e) {
      // ignore
    }
  });

  socket.on("deleteDenied", (payload) => {
    alert(payload && payload.message ? payload.message : "Delete denied.");
  });
  socket.on("deletedSuccess", (payload) => {
    // optionally show a short notification
    // we already get update from server so UI will refresh
    // show a small message
    manualStatus.textContent = "Delete successful.";
    setTimeout(()=> manualStatus.textContent = "", 2500);
  });

  // Add manual boss
  manualAddBtn.addEventListener("click", () => {
    const name = manualBoss.value;
    const timeVal = manualAcquired.value;
    if (!name || !timeVal) {
      manualStatus.textContent = "Please select boss and acquired time.";
      return;
    }
    const obj = makeTimerObj(name, timeVal);
    // push and inform server
    socket.emit("addTimer", obj);
    manualStatus.textContent = `Added ${name}.`;
    manualBoss.value = "";
    manualAcquired.value = "";
    setTimeout(()=> manualStatus.textContent = "", 2500);
  });

  // OCR Upload handler: send file to /api/ocr and parse text client-side (keeps your original flow)
  uploadBtn.addEventListener("click", async () => {
    const file = imageUpload.files[0];
    if (!file) { statusEl.textContent = "Choose an image first."; return; }
    statusEl.textContent = "Uploading image...";
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await fetch("/api/ocr", { method: "POST", body: form });
      const json = await res.json();
      if (json.error) { statusEl.textContent = "OCR failed."; return; }
      const text = (json.text || "").trim();
      if (!text) { statusEl.textContent = "No text detected."; return; }
      statusEl.textContent = "OCR complete. Parsing...";
      const lowered = text.toLowerCase();
      const bossName = Object.keys(bossReference).find(b => lowered.includes(b.toLowerCase()));
      let acquiredTime = new Date();
      const acqMatch = text.match(/acquired[^\d]*(\d{1,2}[:.]\d{2}\s?(AM|PM|am|pm)?)/i);
      if (acqMatch) {
        let timeStr = acqMatch[1].replace('.', ':').trim();
        const parsed = new Date(`${new Date().toDateString()} ${timeStr}`);
        if (!isNaN(parsed)) acquiredTime = parsed;
      } else {
        const altMatch = text.match(/(obtained|received)[^\d]*(\d{1,2}[:.]\d{2}\s?(AM|PM|am|pm)?)/i);
        if (altMatch) {
          let timeStr = altMatch[2].replace('.', ':').trim();
          const parsed = new Date(`${new Date().toDateString()} ${timeStr}`);
          if (!isNaN(parsed)) acquiredTime = parsed;
        } else {
          const anyMatch = text.match(/(\d{1,2}[:.]\d{2}\s?(AM|PM|am|pm)?)/);
          if (anyMatch) {
            let timeStr = anyMatch[1].replace('.', ':').trim();
            const parsed = new Date(`${new Date().toDateString()} ${timeStr}`);
            if (!isNaN(parsed)) acquiredTime = parsed;
          }
        }
      }

      if (!bossName) {
        statusEl.textContent = "No boss name detected from image.";
        return;
      }

      const timerObj = makeTimerObj(bossName, acquiredTime.toISOString());
      socket.emit("addTimer", timerObj);
      statusEl.textContent = `Detected ${bossName}. Added timer.`;
      imageUpload.value = "";
      setTimeout(()=> statusEl.textContent = "", 2500);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "OCR/upload failed.";
    }
  });

  clearOcrBtn.addEventListener("click", () => {
    imageUpload.value = "";
    statusEl.textContent = "";
  });

  // Delete handler asks for special code before emitting to server
  window.deleteTimer = function(id) {
    const code = prompt("You want to delete this timer? Please input special code");
    if (code === null) return; // user cancelled
    // emit deletion request with code
    socket.emit("deleteTimer", { id, code });
  };

  // Render logic - only active table (spawned table removed)
  function renderAll() {
    const now = Date.now();
    const activeList = [...timers].filter(t => {
      const next = new Date(t.nextSpawn).getTime();
      return !isNaN(next) && next > now;
    });

    activeBody.innerHTML = "";
    activeList.forEach(t => {
      const next = new Date(t.nextSpawn).getTime();
      const remainingSec = Math.max(0, Math.floor((next - Date.now())/1000));
      const hrs = Math.floor(remainingSec / 3600);
      const mins = Math.floor((remainingSec % 3600) / 60);
      const secs = remainingSec % 60;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-2 py-1">${escapeHtml(t.name)}</td>
        <td class="px-2 py-1">${escapeHtml(t.location || "")}</td>
        <td class="px-2 py-1">${new Date(t.acquired).toLocaleString()}</td>
        <td class="px-2 py-1">${new Date(t.nextSpawn).toLocaleString()}</td>
        <td class="px-2 py-1">${hrs}h ${mins}m ${secs}s</td>
        <td class="px-2 py-1"><button class="px-2 py-1 bg-red-600 rounded text-black" onclick="deleteTimer('${t.id}')">Delete</button></td>
      `;
      activeBody.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    if (!s) return "";
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // Keep UI ticking (update remaining display)
  setInterval(renderAll, 1000);
})();
