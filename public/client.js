const socket = io();
const timerList = document.getElementById("timers");
const viewerText = document.getElementById("viewers");

// load timers
socket.on("timers", (timers) => {
  timerList.innerHTML = "";
  timers.forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${t.name}</strong> –
      <span id="time-${t.id}">${formatTime(t.remaining)}</span>
      <button onclick="deleteTimer('${t.id}')">Delete</button>`;
    timerList.appendChild(li);
  });
});

socket.on("viewerCount", (n) => {
  viewerText.textContent = `👁️ ${n} viewing`;
});

function formatTime(ms) {
  let s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  s %= 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

function addTimer() {
  const name = document.getElementById("bossName").value.trim();
  const hrs = parseInt(document.getElementById("hours").value || 0);
  const mins = parseInt(document.getElementById("minutes").value || 0);
  const total = (hrs * 60 + mins) * 60 * 1000;
  if (!name || total <= 0) return alert("Enter name and valid time");
  socket.emit("addTimer", {
    id: Date.now().toString(),
    name,
    remaining: total,
  });
}

function deleteTimer(id) {
  const code = prompt(
    "You want to delete this timer? Please input special code."
  );
  if (code === "bernbern") {
    socket.emit("deleteTimer", id);
  } else {
    alert("Wrong code, timer not deleted.");
  }
}
