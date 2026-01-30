chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "add-note-at-timestamp") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "YT_NOTES_OPEN_MODAL" });
});
