const STORAGE_KEY = "ytTimestampNotes_v1";

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

function youtubeUrl(videoId, timestampSec) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${timestampSec}s`;
}

function $(id) {
  return document.getElementById(id);
}

function renderEmpty(listEl) {
  listEl.innerHTML = `
    <div style="opacity:.8; font-weight:700; font-size:12px; line-height:1.4;">
      No notes yet.<br/>
      Open a YouTube video and click <b>+ Note</b> (or press <b>Alt/Option+N</b>).
    </div>
  `;
}

function normalize(str) {
  return String(str || "").toLowerCase();
}

async function render() {
  const listEl = $("list");
  const q = normalize($("search").value);

  const data = await loadAll();
  const entries = Object.entries(data.videos || {});

  entries.sort((a, b) => {
    const aNotes = a[1]?.notes || [];
    const bNotes = b[1]?.notes || [];
    const aLatest = aNotes[0]?.createdAt || 0;
    const bLatest = bNotes[0]?.createdAt || 0;
    return bLatest - aLatest;
  });

  listEl.innerHTML = "";

  let shown = 0;

  for (const [videoId, videoData] of entries) {
    const title = videoData.title || videoId;
    const notes = (videoData.notes || []).slice();

    const filteredNotes = notes.filter((n) => {
      if (!q) return true;
      return (
        normalize(title).includes(q) ||
        normalize(n.noteText).includes(q) ||
        normalize(formatTime(n.timestampSec)).includes(q) ||
        normalize(videoId).includes(q)
      );
    });

    if (filteredNotes.length === 0) continue;

    const videoTpl = $("videoTpl").content.cloneNode(true);
    const card = videoTpl.querySelector(".videoCard");
    card.querySelector(".videoTitle").textContent = title;
    card.querySelector(".videoMeta").textContent = `${videoId} • ${filteredNotes.length} note(s)`;

    const notesEl = card.querySelector(".notes");
    const noteTpl = $("noteTpl");

    for (const note of filteredNotes) {
      const row = noteTpl.content.cloneNode(true);
      const timeLink = row.querySelector(".timeLink");
      const noteText = row.querySelector(".noteText");
      const deleteBtn = row.querySelector(".deleteBtn");

      timeLink.textContent = formatTime(note.timestampSec);
      timeLink.href = youtubeUrl(videoId, note.timestampSec);

      noteText.textContent = note.noteText;

      deleteBtn.addEventListener("click", async () => {
        const latest = await loadAll();
        const vid = latest.videos?.[videoId];
        if (!vid) return;

        vid.notes = (vid.notes || []).filter((x) => x.id !== note.id);
        if (vid.notes.length === 0) delete latest.videos[videoId];

        await saveAll(latest);
        render();
      });

      notesEl.appendChild(row);
      shown++;
    }

    listEl.appendChild(card);
  }

  if (shown === 0) renderEmpty(listEl);
}

async function exportNotes() {
  const data = await loadAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "youtube-timestamp-notes.json";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function importNotes(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== "object" || !parsed.videos) {
    throw new Error("Invalid file format");
  }

  await saveAll(parsed);
}

async function clearAll() {
  await chrome.storage.local.remove([STORAGE_KEY]);
}

document.addEventListener("DOMContentLoaded", () => {
  $("search").addEventListener("input", render);
  $("export").addEventListener("click", exportNotes);

  $("import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importNotes(file);
      e.target.value = "";
      render();
    } catch (err) {
      alert("Import failed: " + (err?.message || String(err)));
    }
  });

  $("clearAll").addEventListener("click", async () => {
    const ok = confirm("Clear ALL saved notes? This cannot be undone.");
    if (!ok) return;
    await clearAll();
    render();
  });

  render();
});
