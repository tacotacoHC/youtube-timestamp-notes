const STORAGE_KEY = "ytTimestampNotes_v1";

function isWatchPage() {
  return location.pathname === "/watch" && new URLSearchParams(location.search).has("v");
}

function getVideoId() {
  return new URLSearchParams(location.search).get("v");
}

function getVideoTitle() {
  const titleEl = document.querySelector("h1.ytd-watch-metadata yt-formatted-string");
  return titleEl?.textContent?.trim() || document.title.replace(" - YouTube", "").trim();
}

function getCurrentTimeSeconds() {
  const video = document.querySelector("video");
  if (!video) return 0;
  return Math.floor(video.currentTime || 0);
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function loadAll() {
  const res = await chrome.storage.local.get([STORAGE_KEY]);
  return res[STORAGE_KEY] || { videos: {} };
}

async function saveAll(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function addNote({ videoId, title, timestampSec, noteText }) {
  const data = await loadAll();
  if (!data.videos[videoId]) {
    data.videos[videoId] = { title, notes: [] };
  } else if (title && data.videos[videoId].title !== title) {
    data.videos[videoId].title = title;
  }

  data.videos[videoId].notes.push({
    id: crypto.randomUUID(),
    timestampSec,
    noteText,
    createdAt: Date.now()
  });

  data.videos[videoId].notes.sort((a, b) => b.createdAt - a.createdAt);
  await saveAll(data);
}

function ensureStyles() {
  if (document.getElementById("yt-notes-style")) return;
  const style = document.createElement("style");
  style.id = "yt-notes-style";
  style.textContent = `
    .yt-notes-btn {
      position: fixed;
      right: 18px;
      bottom: 110px;
      z-index: 999999;
      background: #7c6cff;
      color: white;
      border: none;
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .yt-notes-btn:hover { filter: brightness(1.05); }
    .yt-notes-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0,0,0,.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    .yt-notes-modal {
      width: min(640px, 100%);
      background: #111;
      color: #fff;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 70px rgba(0,0,0,.5);
    }
    .yt-notes-modal header {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.04);
    }
    .yt-notes-modal header .meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .yt-notes-modal header .meta .title {
      font-weight: 800;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 520px;
    }
    .yt-notes-modal header .meta .time {
      opacity: .85;
      font-size: 12px;
      font-weight: 600;
    }
    .yt-notes-modal header button {
      background: transparent;
      color: #fff;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 10px;
      padding: 7px 10px;
      cursor: pointer;
    }
    .yt-notes-modal main {
      padding: 14px 16px 16px;
      display: grid;
      gap: 10px;
    }
    .yt-notes-modal textarea {
      width: 100%;
      min-height: 120px;
      resize: vertical;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.06);
      color: #fff;
      outline: none;
      font-size: 14px;
      line-height: 1.35;
    }
    .yt-notes-modal footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 0 16px 16px;
    }
    .yt-notes-primary {
      background: #7c6cff;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 800;
      cursor: pointer;
    }
    .yt-notes-secondary {
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 800;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

function removeExistingModal() {
  document.querySelector(".yt-notes-modal-backdrop")?.remove();
}

async function openModal() {
  if (!isWatchPage()) return;

  ensureStyles();
  removeExistingModal();

  const videoId = getVideoId();
  const title = getVideoTitle();
  const timestampSec = getCurrentTimeSeconds();

  const backdrop = document.createElement("div");
  backdrop.className = "yt-notes-modal-backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  const modal = document.createElement("div");
  modal.className = "yt-notes-modal";
  modal.innerHTML = `
    <header>
      <div class="meta">
        <div class="title">Note @ ${formatTime(timestampSec)} — ${escapeHtml(title)}</div>
        <div class="time">Video ID: ${escapeHtml(videoId)}</div>
      </div>
      <button type="button" aria-label="Close">Esc</button>
    </header>
    <main>
      <textarea placeholder="Type your note... (Shift+Enter for new line)"></textarea>
    </main>
    <footer>
      <button class="yt-notes-secondary" type="button">Cancel</button>
      <button class="yt-notes-primary" type="button">Save note</button>
    </footer>
  `;

  const closeBtn = modal.querySelector("header button");
  const textarea = modal.querySelector("textarea");
  const cancelBtn = modal.querySelector(".yt-notes-secondary");
  const saveBtn = modal.querySelector(".yt-notes-primary");

  function close() {
    backdrop.remove();
  }

  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);

  saveBtn.addEventListener("click", async () => {
    const noteText = textarea.value.trim();
    if (!noteText) {
      textarea.focus();
      return;
    }
    await addNote({ videoId, title, timestampSec, noteText });
    close();
    toast("Saved note ✅");
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") saveBtn.click();
    },
    { once: true }
  );

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  setTimeout(() => textarea.focus(), 0);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = `
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 26px;
    z-index: 999999;
    background: rgba(20,20,20,.92);
    color: #fff;
    border: 1px solid rgba(255,255,255,.16);
    padding: 10px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function ensureButton() {
  if (!isWatchPage()) {
    document.querySelector(".yt-notes-btn")?.remove();
    return;
  }
  if (document.querySelector(".yt-notes-btn")) return;

  ensureStyles();

  const btn = document.createElement("button");
  btn.className = "yt-notes-btn";
  btn.type = "button";
  btn.textContent = "+ Note";
  btn.title = "Add a note at the current timestamp (Alt/Option+N)";
  btn.addEventListener("click", openModal);

  document.body.appendChild(btn);
}

function hookYouTubeSpaNavigation() {
  window.addEventListener("yt-navigate-finish", () => {
    setTimeout(ensureButton, 300);
  });

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      ensureButton();
    }
  }, 800);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "YT_NOTES_OPEN_MODAL") {
    openModal();
  }
});

ensureButton();
hookYouTubeSpaNavigation();
