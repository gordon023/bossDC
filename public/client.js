async function loadTimers() {
  const res = await fetch("/api/timers");
  const timers = await res.json();
  const tbody = document.querySelector("#timerTable tbody");
  tbody.innerHTML = "";

  timers.forEach(t => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${t.boss}</td>
      <td>${t.location}</td>
      <td>${new Date(t.acquired).toLocaleString()}</td>
      <td>${new Date(t.next_spawn).toLocaleString()}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteTimer(${t.id})">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}

async function addTimer() {
  const boss = document.getElementById("bossName").value;
  const location = document.getElementById("location").value;
  const acquired = new Date(document.getElementById("acquired").value);
  const next_spawn = new Date(acquired.getTime() + 4 * 60 * 60 * 1000);

  await fetch("/api/timers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boss, location, acquired, next_spawn })
  });
  loadTimers();
}

async function deleteTimer(id) {
  await fetch(`/api/timers/${id}`, { method: "DELETE" });
  loadTimers();
}

async function uploadImage() {
  const file = document.getElementById("fileInput").files[0];
  const formData = new FormData();
  formData.append("screenshot", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();
  alert(`Detected boss: ${data.boss}`);
  loadTimers();
}

document.getElementById("addBtn").addEventListener("click", addTimer);
document.getElementById("uploadBtn").addEventListener("click", uploadImage);

loadTimers();
