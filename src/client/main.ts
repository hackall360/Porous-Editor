// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// ====================== src/client/main.ts ======================
import {
  SaveData,
  JsonSaveData,
  RawSaveData,
  StoredSave,
  EditorState,
  getFormatLabel,
  isJsonFormat,
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

function renderJSONEditor(): void {
  const data = editorState.getCurrentData() as JsonSaveData;
  if (!data) return;

  const moneyVal = data.money || data.gold || 999999;
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
            <th>ITEM</th>
            <th>QTY</th>
          </tr>
        </thead>
        <tbody id="itemsBody">
  `;

  if (items.length > 0) {
    items.forEach((item: InventoryItem, i: number) => {
      const itemName = item.name || `Item ${i}`;
      const itemQty = item.qty || item.amount || 1;
      html += `
        <tr class="border-b">
          <td>${itemName}</td>
          <td>
            <input
              type="number"
              value="${itemQty}"
              class="bg-transparent w-20 text-center"
              onchange="updateItem(${i}, this.value)"
            >
          </td>
        </tr>
      `;
    });
  } else {
    html += `<tr><td colspan="2" class="text-center py-8 text-[#00ff9d]/50">No items detected</td></tr>`;
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  // Stats/Vars section
  html += `
    <div class="grid grid-cols-2 gap-4">
      <div>
        <h4 class="mb-3 text-[#ff00aa]">STATS / VARS</h4>
  `;

  Object.keys(data)
    .filter((key) => !["items", "money", "gold"].includes(key))
    .forEach((key) => {
      const value = data[key];
      if (typeof value === "number" || typeof value === "string") {
        html += `
          <div class="flex justify-between mb-2">
            <span>${key.toUpperCase()}</span>
            <input
              type="text"
              value="${value}"
              class="bg-transparent border border-[#00ff9d]/70 px-4 py-1 w-1/2"
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
      <textarea
        id="rawEditor"
        class="w-full h-96 bg-black border border-[#00ff9d]/40 p-6 font-mono text-xs text-[#00ff9d] rounded-3xl"
      >${data.raw}</textarea>
      <p class="text-xs text-[#ff00aa] mt-4">
        Raw mode — edit freely and download. Perfect for binary/text saves.
      </p>
    `;
  }
}

// ====================== Data Modification ======================
function updateMoney(value: string): void {
  const numValue = parseInt(value) || 0;
  const currentData = editorState.getCurrentData() as JsonSaveData;
  if (currentData) {
    currentData.money = numValue;
    currentData.gold = numValue;
    saveDataToMemory();
  }
}

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

function updateStat(key: string, value: string): void {
  const currentData = editorState.getCurrentData() as JsonSaveData;
  if (currentData) {
    currentData[key] = value;
    saveDataToMemory();
  }
}

function saveDataToMemory(): void {
  // Data is already mutated in memory through references
  // This function exists for API compatibility
}

function downloadSave(): void {
  const currentData = editorState.getCurrentData();
  const originalName = editorState.getOriginalName();
  const originalExt = editorState.getOriginalExt();

  let blob: Blob;
  if (currentData && "raw" in currentData) {
    blob = new Blob([currentData.raw], { type: "application/octet-stream" });
  } else if (currentData) {
    blob = new Blob([JSON.stringify(currentData, null, 2)], {
      type: "application/json",
    });
  } else {
    console.error("No data to download");
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = originalName || `edited_save.${originalExt}`;
  a.click();
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

// ====================== Initialization ======================
function init(): void {
  // Initialize - all CDN resources auto-initialize
  console.log(
    "%c🔧 SaveForge loaded – editing ready",
    "color:#ff00aa; font-family:monospace",
  );
}

// Export functions for global HTML access
(window as any).handleUpload = handleUpload;
(window as any).loadEditorData = loadEditorData;
(window as any).downloadSave = downloadSave;
(window as any).showFormats = showFormats;
(window as any).hideFormats = hideFormats;
(window as any).updateMoney = updateMoney;
(window as any).updateItem = updateItem;
(window as any).updateStat = updateStat;

// Auto-initialize on load
if (typeof window !== "undefined") {
  window.addEventListener("load", init);
}

export { editorState };
