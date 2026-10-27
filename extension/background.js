chrome.runtime.onMessage.addListener(async (request, sender) => {
  const word = request.word;
  const coords = request.coords;
  const lang = request.lang || "en";
  const tabId = sender.tab ? sender.tab.id : null;

  if (!tabId || !word) return;

  try {
    const res = await fetch("http://127.0.0.1:5000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: word, lang: lang })
    });

    const data = await res.json();
    const definition = data.response || data.error;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (word, rawResponse, coords, activeLang) => {
        // Remove existing popup if any
        const existing = document.getElementById("lumen-popup") || document.getElementById("gemini-popup");
        if (existing) existing.remove();

        if (!rawResponse) return;

        function escapeHtml(str) {
          return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }

        const isTamil = (activeLang === "ta" || activeLang === "tamil");

        // Parse structured dictionary response
        const parsed = {
          word: word || "",
          partOfSpeech: "",
          definition: "",
          synonyms: [],
          example: "",
          translations: []
        };

        const lines = rawResponse.split("\n").map(l => l.trim()).filter(Boolean);
        let section = null;

        for (const line of lines) {
          const lower = line.toLowerCase();
          if (lower.startsWith("word:")) {
            parsed.word = line.slice(5).trim() || parsed.word;
            section = null;
          } else if (lower.startsWith("part of speech:")) {
            parsed.partOfSpeech = line.slice(15).trim();
            section = null;
          } else if (lower.startsWith("definition:")) {
            parsed.definition = line.slice(11).trim();
            section = "definition";
          } else if (lower.startsWith("synonyms:")) {
            const synStr = line.slice(9).trim();
            parsed.synonyms = synStr.split(/,\s*/).map(s => s.trim()).filter(Boolean);
            section = null;
          } else if (/^examples?(\s+sentences?)?:/i.test(line)) {
            section = "examples";
          } else if (/^translations?:/i.test(line)) {
            section = "translations";
          } else if (section === "definition") {
            parsed.definition += " " + line;
          } else if (section === "examples") {
            if (!parsed.example) {
              parsed.example = line.replace(/^[0-9]+[.)]\s*|^[-*•]\s*/, "").replace(/^["“”]|["“”]$/g, "").trim();
            }
          } else if (section === "translations") {
            parsed.translations.push(line.replace(/^[-*•]\s*/, ""));
          }
        }

        if (!parsed.definition) {
          parsed.definition = rawResponse;
        }

        // Create popup card
        const popup = document.createElement("div");
        popup.id = "lumen-popup";

        Object.assign(popup.style, {
          position: "fixed",
          zIndex: "2147483647",
          width: "320px",
          maxWidth: "calc(100vw - 32px)",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          color: "#1e293b",
          padding: "14px 16px",
          fontSize: "13px",
          lineHeight: "1.5",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          borderTop: "3px solid #3b82f6",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 4px 8px -2px rgba(15, 23, 42, 0.06)",
          boxSizing: "border-box",
          visibility: "hidden"
        });

        // Pill button styles
        const activeTabStyle = "background-color: #3b82f6; color: #ffffff; font-weight: 600; padding: 2px 7px; border-radius: 4px; border: none; cursor: default; font-size: 11px;";
        const inactiveTabStyle = "background: transparent; color: #64748b; font-weight: 500; padding: 2px 7px; border-radius: 4px; border: none; cursor: pointer; font-size: 11px;";

        // Header: English Word + Part of Speech + Interactive Language Switcher
        let html = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="display: flex; align-items: baseline; gap: 6px; overflow: hidden; text-overflow: ellipsis;">
              <span style="font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;">${escapeHtml(parsed.word)}</span>
              ${parsed.partOfSpeech ? `<span style="font-size: 11px; font-style: italic; color: #2563eb; background-color: #eff6ff; padding: 1px 6px; border-radius: 5px; font-weight: 500; border: 1px solid #dbeafe;">${escapeHtml(parsed.partOfSpeech)}</span>` : ""}
            </div>
            <div style="display: flex; background-color: #f1f5f9; padding: 2px; border-radius: 6px; border: 1px solid #e2e8f0; flex-shrink: 0; margin-left: 8px;">
              <button id="lumen-btn-en" style="${!isTamil ? activeTabStyle : inactiveTabStyle}">EN</button>
              <button id="lumen-btn-ta" style="${isTamil ? activeTabStyle : inactiveTabStyle}">தமிழ்</button>
            </div>
          </div>
        `;

        // Definition (English or Tamil)
        html += `
          <div style="margin-bottom: 10px; font-size: 13px; color: #334155; line-height: 1.5;">
            ${escapeHtml(parsed.definition)}
          </div>
        `;

        // Synonyms chips
        const topSynonyms = parsed.synonyms.slice(0, 3);
        const synLabel = isTamil ? "ஒத்த சொற்கள்" : "Synonyms";
        if (topSynonyms.length > 0) {
          html += `
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; align-items: center;">
              <span style="font-size: 11px; color: #94a3b8; margin-right: 2px;">${synLabel}:</span>
              ${topSynonyms.map(syn => `
                <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-size: 11.5px; padding: 2px 8px; border-radius: 12px; border: 1px solid #dbeafe; font-weight: 500;">
                  ${escapeHtml(syn)}
                </span>
              `).join("")}
            </div>
          `;
        }

        // Example sentence
        if (parsed.example) {
          html += `
            <div style="margin-bottom: 10px; font-size: 12px; color: #475569; font-style: italic; border-left: 2px solid #93c5fd; background-color: rgba(239, 246, 255, 0.45); padding: 5px 8px; border-radius: 0 6px 6px 0; line-height: 1.45;">
              “${escapeHtml(parsed.example)}”
            </div>
          `;
        }

        // Translations / Extra Details
        const detailsLabel = isTamil ? "கூடுதல் விவரங்கள் (தமிழ் அர்த்தம்)" : "View translations";
        if (parsed.translations.length > 0) {
          html += `
            <details style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
              <summary style="cursor: pointer; user-select: none; font-size: 12px; font-weight: 500; color: #2563eb; outline: none;">
                ${detailsLabel}
              </summary>
              <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; padding-left: 4px;">
                ${parsed.translations.map(t => {
                  const split = t.split(/:\s*(.+)/);
                  if (split.length >= 2) {
                    return `<div style="display: flex; justify-content: space-between; gap: 8px;"><span style="color: #64748b;">${escapeHtml(split[0])}</span><span style="font-weight: 500; color: #0f172a;">${escapeHtml(split[1])}</span></div>`;
                  }
                  return `<div style="color: #334155;">${escapeHtml(t)}</div>`;
                }).join("")}
              </div>
            </details>
          `;
        }

        popup.innerHTML = html;
        document.body.appendChild(popup);

        // Language toggle event listeners
        document.getElementById("lumen-btn-en")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isTamil) {
            chrome.storage.local.set({ lumen_lang: "en" });
            popup.innerHTML = `<div style="padding: 12px; text-align: center; color: #64748b; font-size: 12px;">Loading English...</div>`;
            chrome.runtime.sendMessage({ word: word, coords: coords, lang: "en" });
          }
        });

        document.getElementById("lumen-btn-ta")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!isTamil) {
            chrome.storage.local.set({ lumen_lang: "ta" });
            popup.innerHTML = `<div style="padding: 12px; text-align: center; color: #64748b; font-size: 12px;">தமிழில் பெறுகிறது...</div>`;
            chrome.runtime.sendMessage({ word: word, coords: coords, lang: "ta" });
          }
        });

        // Viewport bounds & positioning
        const rect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 12;

        let top = 0;
        let left = 0;

        if (coords) {
          top = coords.bottom + 8;
          left = coords.left;

          // Horizontal bounds
          if (left + rect.width > viewportWidth - margin) {
            left = viewportWidth - rect.width - margin;
          }
          if (left < margin) {
            left = margin;
          }

          // Vertical bounds
          if (top + rect.height > viewportHeight - margin) {
            if (coords.top - rect.height - 8 > margin) {
              top = coords.top - rect.height - 8;
            } else {
              top = Math.max(margin, viewportHeight - rect.height - margin);
            }
          }
        } else {
          top = viewportHeight - rect.height - 20;
          left = viewportWidth - rect.width - 20;
        }

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        popup.style.visibility = "visible";

        // Dismiss on clicking outside or pressing Escape
        const cleanup = () => {
          popup.remove();
          document.removeEventListener("pointerdown", onPointerDown, true);
          document.removeEventListener("keydown", onKeyDown, true);
        };

        const onPointerDown = (e) => {
          if (!popup.contains(e.target)) {
            cleanup();
          }
        };

        const onKeyDown = (e) => {
          if (e.key === "Escape") {
            cleanup();
          }
        };

        setTimeout(() => {
          document.addEventListener("pointerdown", onPointerDown, true);
          document.addEventListener("keydown", onKeyDown, true);
        }, 10);
      },
      args: [word, definition, coords, lang]
    });
  } catch (e) {
    console.error("Failed to get definition from Flask:", e);
  }
});
