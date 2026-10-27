document.addEventListener("mouseup", (e) => {
  // Ignore clicks inside an open popup
  const existingPopup = document.getElementById("lumen-popup") || document.getElementById("gemini-popup");
  if (existingPopup && existingPopup.contains(e.target)) {
    return;
  }

  const selection = window.getSelection();
  const rawText = selection.toString().trim();
  // Strip surrounding punctuation (e.g. quotes, brackets, periods)
  const cleanWord = rawText.replace(/^[^\w]+|[^\w]+$/g, "");

  if (cleanWord && cleanWord.split(/\s+/).length === 1 && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    chrome.storage.local.get(["lumen_lang"], (res) => {
      const lang = res.lumen_lang || "en";
      chrome.runtime.sendMessage({
        action: "lookup",
        word: cleanWord,
        lang: lang,
        coords: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height
        }
      });
    });
  }
});
