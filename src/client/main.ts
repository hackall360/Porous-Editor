// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  SaveData,
  JsonSaveData,
  RawSaveData,
  StoredSave,
  EditorState,
  getFormatLabel,
  isJsonFormat,
  isRawSaveData,
  InventoryItem,
} from "./types";

// ====================== Type Declarations ======================
declare global {
  interface Window {
    handleUpload: (file: File | null) => void;
    loadEditorData: () => void;
    downloadSave: () => void;
    showFormats: () => void;
    hideFormats: () => void;
    clearData: () => void;
    showAbout: () => void;
    hideAbout: () => void;
    formatRaw: () => void;
    clearRaw: () => void;
    updateMoney: (value: string) => void;
    updateItem: (index: number, value: string) => void;
    updateStat: (key: string, value: string) => void;
  }
}

// ====================== State Management ======================
class EditorStateManager {
  private state: EditorState = {
    currentData: null,
    originalName: "",
    originalExt: "",
    storedType: "json",
  };

  getCurrentData(): SaveData | null {
    return this.state.currentData;
  }

  getOriginalName(): string {
    return this.state.originalName;
  }

  getOriginalExt(): string {
    return this.state.originalExt;
  }

  getStoredType(): "json" | "raw" {
    return this.state.storedType;
  }

  setState(data: Partial<EditorState>): void {
    this.state = { ...this.state, ...data };
  }

  reset(): void {
    this.state = {
      currentData: null,
      originalName: "",
      originalExt: "",
      storedType: "json",
    };
  }
}

const editorState = new EditorStateManager();

// ====================== LocalStorage Utilities ======================
const STORAGE_KEY = "saveforge_current";

function saveToLocalStorage(
  name: string,
  ext: string,
  data: SaveData,
  type: "json" | "raw",
): void {
  const payload: StoredSave = {
    name,
    ext,
    data,
    type,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadFromLocalStorage(): StoredSave | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSave;
  } catch {
    return null;
  }
}

function clearStoredSave(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ====================== File Upload Handler ======================
function handleUpload(file: File | null): void {
  if (!file) return;

  const originalName = file.name;
  const ext = originalName.split(".").pop()?.toLowerCase() || "";
  const reader = new FileReader();

  reader.onload = (e: ProgressEvent<FileReader>) => {
    try {
      let parsed: SaveData;
      let type: "json" | "raw";

      if (isJsonFormat(ext)) {
        parsed = JSON.parse(e.target?.result as string) as JsonSaveData;
        type = "json";
      } else {
        parsed = { raw: e.target?.result as string } as RawSaveData;
        type = "raw";
      }

      saveToLocalStorage(originalName, ext, parsed, type);
      window.location.href = "editor.html";
    } catch (err) {
      // If JSON parsing fails, treat as raw
      const rawData = { raw: e.target?.result as string } as RawSaveData;
      saveToLocalStorage(originalName, ext, rawData, "raw");
      window.location.href = "editor.html";
    }
  };

  reader.readAsText(file);
}

// ====================== Editor Rendering ======================
function loadEditorData(): void {
  const stored = loadFromLocalStorage();
  if (!stored) {
    window.location.href = "index.html";
    return;
  }

  editorState.setState({
    currentData: stored.data,
    originalName: stored.name,
    originalExt: stored.ext,
    storedType: stored.type,
  });

  renderInfoPanel();
  renderFileStats();

  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const formatBadge = document.getElementById("formatBadge");

  if (fileNameDisplay) {
    fileNameDisplay.textContent = stored.name;
  }

  if (formatBadge) {
    formatBadge.textContent = getFormatLabel(stored.ext);
  }

  if (stored.type === "json") {
    renderJSONEditor();
  } else {
    renderRawEditor();
  }
}

function renderInfoPanel(): void {
  const infoPanel = document.getElementById("infoPanel");
  if (!infoPanel) return;

  const stored = loadFromLocalStorage();
  if (!stored) return;

  const formatLabel = getFormatLabel(stored.ext);
  const fileSize = getFileSizeString(stored.data);
  const storedType = stored.type === "json" ? "Structured (JSON)" : "Raw Text";
  const timestamp = new Date(stored.timestamp).toLocaleString();

  const html = `

    <div class="bg-[#111] p-4 rounded-xl">
      <div class="text-xs text-[#00ff9d]/70 mb-1">FORMAT</div>
      <div class="text-sm font-bold">${escapeHtml(formatLabel)}</div>
    </div>
    <div class="bg-[#111] p-4 rounded-xl">
      <div class="text-xs text-[#00ff9d]/70 mb-1">FILE SIZE</div>
      <div class="text-sm font-bold">${fileSize}</div>
    </div>
    <div class="bg-[#111] p-4 rounded-xl">
      <div class="text-xs text-[#00ff9d]/70 mb-1">DATA TYPE</div>
      <div class="text-sm font-bold">${storedType}</div>
    </div>
    <div class="bg-[#111] p-4 rounded-xl">
      <div class="text-xs text-[#00ff9d]/70 mb-1">LOADED</div>
      <div class="text-sm font-bold">${timestamp}</div>
    </div>
    <div class="pt-4 border-t border-[#00ff9d]/20">
      <button onclick="clearData()" class="w-full px-4 py-2 bg-[#ff00aa] text-black text-xs font-bold rounded hover:scale-105 transition">
        CLEAR DATA
      </button>
    </div>
  `;

  infoPanel.innerHTML = html;
}

function renderFileStats(): void {
  // Additional file statistics can be added here
  const data = editorState.getCurrentData();
  if (!data) return;

  console.log("File loaded:", {
    name: editorState.getOriginalName(),
    extension: editorState.getOriginalExt(),
    type: editorState.getStoredType(),
    timestamp: new Date().toISOString(),
  });
}

function getFileSizeString(data: SaveData): string {
  let content: string;

  if (isRawSaveData(data)) {
    content = data.raw;
  } else {
    content = JSON.stringify(data);
  }

  const bytes = new Blob([content]).size;
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function renderJSONEditor(): void {
  const data = editorState.getCurrentData() as JsonSaveData;

  if (!data) return;

  const moneyVal = data.money || data.gold || 0;

  const items = data.items || [];

  let html = `<div class="space-y-8">`;

  // Quick gold/money section

  html += `

    <div class="flex items-center justify-between bg-[#111] p-6 rounded-2xl">
      <span class="font-bold">GOLD / MONEY</span>
      <input
        id="goldInput"
        type="number"
        value="${moneyVal}"
        class="bg-transparent border border-[#00ff9d] text-3xl text-center w-48 font-mono focus:outline-none"
        onchange="updateMoney(this.value)"
      >
    </div>
  `;

  // Inventory section
  html += `
    <div>
      <h4 class="mb-3 text-[#ff00aa]">INVENTORY</h4>
      <table class="w-full">
        <thead>
          <tr class="text-left border-b">
            <th class="pb-2">ITEM</th>
            <th class="pb-2 text-center">QTY</th>
          </tr>
        </thead>
        <tbody id="itemsBody">
  `;

  if (items.length > 0) {
    items.forEach((item: InventoryItem, i: number) => {
      const itemName = item.name || `Item ${i}`;
      const itemQty = item.qty || item.amount || 1;
      html += `
        <tr class="border-b border-[#00ff9d]/10">
          <td class="py-2">${escapeHtml(itemName)}</td>
          <td class="py-2 text-center">
            <input
              type="number"
              value="${itemQty}"
              min="0"
              class="bg-transparent w-20 text-center border border-[#00ff9d]/40 rounded px-2 py-1 focus:outline-none focus:border-[#00ff9d]"
              onchange="updateItem(${i}, this.value)"
            >
          </td>
        </tr>
      `;
    });
  } else {
    html += `<tr><td colspan="2" class="text-center py-8 text-[#00ff9d]/50">No inventory items detected</td></tr>`;
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  // Stats/Vars section
  const statsKeys = Object.keys(data).filter(
    (key) => !["items", "money", "gold"].includes(key),
  );

  if (statsKeys.length > 0) {
    html += `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 class="mb-3 text-[#ff00aa]">STATS / VARIABLES</h4>
    `;

    statsKeys.forEach((key) => {
      const value = data[key];
      if (typeof value === "number" || typeof value === "string") {
        const inputType = typeof value === "number" ? "number" : "text";
        html += `
          <div class="flex justify-between items-center mb-2 bg-[#111] p-3 rounded">
            <span class="text-sm">${escapeHtml(key.toUpperCase())}</span>
            <input
              type="${inputType}"
              value="${escapeHtml(String(value))}"
              class="bg-transparent border border-[#00ff9d]/40 px-3 py-1 w-32 text-right focus:outline-none focus:border-[#00ff9d] rounded"
              onchange="updateStat('${key}', this.value)"
            >
          </div>
        `;
      }
    });

    html += `
        </div>
      </div>
    </div>
    `;
  } else {
    html += `
      <div class="text-center py-8 text-[#00ff9d]/50">
        <i class="fa-solid fa-database text-2xl mb-2"></i>
        <p>No additional variables detected</p>
      </div>
    `;
  }

  const editorContent = document.getElementById("editorContent");
  if (editorContent) {
    editorContent.innerHTML = html;
  }
}

function renderRawEditor(): void {
  const data = editorState.getCurrentData() as RawSaveData;
  const editorContent = document.getElementById("editorContent");

  if (editorContent) {
    editorContent.innerHTML = `
      <div class="space-y-4">
        <textarea
          id="rawEditor"
          class="w-full h-96 bg-black border border-[#00ff9d]/40 p-6 font-mono text-xs text-[#00ff9d] rounded-3xl resize-y focus:outline-none focus:border-[#00ff9d]"
        >${escapeHtml(data.raw)}</textarea>
        <div class="flex items-center justify-between text-xs">
          <p class="text-[#ff00aa]">
            <i class="fa-solid fa-exclamation-triangle mr-1"></i>
            Raw mode — edit freely. Be careful with binary data.
          </p>
          <div class="flex gap-2">
            <button onclick="formatRaw()" class="px-3 py-1 border border-[#00ff9d] text-[#00ff9d] rounded hover:bg-[#00ff9d]/10 transition">
              FORMAT JSON
            </button>
            <button onclick="clearRaw()" class="px-3 py-1 border border-[#ff00aa] text-[#ff00aa] rounded hover:bg-[#ff00aa]/10 transition">
              CLEAR
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

// ====================== Raw Editor Utilities ======================
function formatRaw(): void {
  const rawEditor = document.getElementById("rawEditor") as HTMLTextAreaElement;
  if (!rawEditor) return;

  const data = editorState.getCurrentData() as RawSaveData;
  if (!data) return;

  try {
    const parsed = JSON.parse(data.raw);
    const formatted = JSON.stringify(parsed, null, 2);
    rawEditor.value = formatted;
    data.raw = formatted;
    saveDataToMemory();
  } catch (err) {
    alert("Cannot format: Invalid JSON data");
  }
}

function clearRaw(): void {
  const rawEditor = document.getElementById("rawEditor") as HTMLTextAreaElement;
  if (!rawEditor) return;

  if (confirm("Clear all content? This cannot be undone.")) {
    rawEditor.value = "";
    const data = editorState.getCurrentData() as RawSaveData;
    if (data) {
      data.raw = "";
      saveDataToMemory();
    }
  }
}

// ====================== Data Modification ======================
// These functions are called from HTML event handlers, so they appear unused to TypeScript
/* eslint-disable @typescript-eslint/no-unused-vars */
function updateMoney(value: string): void {
  const numValue = parseInt(value) || 0;
  const currentData = editorState.getCurrentData() as JsonSaveData;
  if (currentData) {
    currentData.money = numValue;
    currentData.gold = numValue;
    saveDataToMemory();
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function updateItem(index: number, value: string): void {
  const currentData = editorState.getCurrentData() as JsonSaveData;
  if (!currentData || !currentData.items) return;

  const numValue = parseInt(value) || 0;
  if (currentData.items[index]) {
    currentData.items[index].qty = numValue;
    currentData.items[index].amount = numValue;
    saveDataToMemory();
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function updateStat(key: string, value: string): void {
  const currentData = editorState.getCurrentData() as JsonSaveData;
  if (currentData) {
    // Try to convert to number if it was a number
    const numValue = parseInt(value);
    currentData[key] = isNaN(numValue) ? value : numValue;
    saveDataToMemory();
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function saveDataToMemory(): void {
  // Data is already mutated in memory through references
  // This function exists for API compatibility and future persistence
}

function clearData(): void {
  if (
    confirm("Clear all saved data? This will return you to the upload page.")
  ) {
    clearStoredSave();
    editorState.reset();
    window.location.href = "index.html";
  }
}

function downloadSave(): void {
  const currentData = editorState.getCurrentData();

  const originalName = editorState.getOriginalName();

  const originalExt = editorState.getOriginalExt();

  if (!currentData) {
    console.error("No data to download");

    alert("No data available to download.");

    return;
  }

  let blob: Blob;

  let filename: string;

  if (isRawSaveData(currentData)) {
    blob = new Blob([currentData.raw], { type: "application/octet-stream" });

    filename = originalName || `edited_save.${originalExt}`;
  } else {
    blob = new Blob([JSON.stringify(currentData, null, 2)], {
      type: "application/json",
    });

    filename = originalName?.replace(/\.[^/.]+$/, "") || "edited_save";

    filename += ".json";
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Mini celebration animation
  const panel = document.querySelector("#editorContent");
  const panelElement = panel as HTMLElement | null;

  if (panelElement) {
    panelElement.style.transition = "transform 0.3s";
    panelElement.style.transform = "scale(1.03)";
    setTimeout(() => {
      panelElement.style.transform = "scale(1)";
    }, 300);
  }

  showNotification("Download started!");
}

// ====================== Modal Helpers ======================
function showFormats(): void {
  const modal = document.getElementById("formatsModal");
  if (modal) {
    modal.classList.remove("hidden");
  }
}

function hideFormats(): void {
  const modal = document.getElementById("formatsModal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

function showAbout(): void {
  const modal = document.getElementById("aboutModal");
  if (modal) {
    modal.classList.remove("hidden");
  }
}

function hideAbout(): void {
  const modal = document.getElementById("aboutModal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// ====================== UI Utilities ======================
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message: string, duration: number = 2000): void {
  const notification = document.createElement("div");
  notification.className =
    "fixed top-20 right-6 bg-[#00ff9d] text-black px-6 py-3 rounded-lg font-bold shadow-lg z-50 animate-pulse";
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, duration);
}

// ====================== Initialization ======================
function init(): void {
  // Initialize - all CDN resources auto-initialize
  console.log(
    "%c🛠️ Porous Editor loaded – editing ready",
    "color:#00ff9d; font-family:monospace",
  );

  // Add keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      downloadSave();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      document.getElementById("fileInput")?.click();
    }
  });
}

// Assign functions to window for HTML inline event handlers

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).handleUpload = handleUpload;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).loadEditorData = loadEditorData;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).downloadSave = downloadSave;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).showFormats = showFormats;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).hideFormats = hideFormats;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).clearData = clearData;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).showAbout = showAbout;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).hideAbout = hideAbout;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).formatRaw = formatRaw;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).clearRaw = clearRaw;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).updateMoney = updateMoney;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).updateItem = updateItem;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).updateStat = updateStat;

/* eslint-enable @typescript-eslint/no-explicit-any */

// Auto-initialize on load
if (typeof window !== "undefined") {
  window.addEventListener("load", init);
}

export { editorState };
