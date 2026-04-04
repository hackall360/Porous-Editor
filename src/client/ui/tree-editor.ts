// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Generic recursive JSON tree editor.
 * Renders any JSON object as an expandable/collapsible tree with inline editing,
 * add/delete operations, and search/filter support.
 */

// ====================== Types ======================

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonObject
  | JsonArray;

interface JsonObject {
  [key: string]: JsonValue;
}

interface JsonArray extends Array<JsonValue> {}

type ValueType = "string" | "number" | "boolean" | "null" | "object" | "array";

// ====================== Helpers ======================

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getType(value: JsonValue): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function createDefaultValue(type: ValueType): JsonValue {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    case "object":
      return {};
    case "array":
      return [];
    default:
      return "";
  }
}

// ====================== Tree Node Rendering ======================

interface TreeNodeOptions {
  value: JsonValue;
  path: (string | number)[];
  depth: number;
  expanded: boolean;
  searchTerm: string;
  onChange: (newData: Record<string, unknown>) => void;
  rootData: Record<string, unknown>;
  onUpdatePath: (path: (string | number)[], newValue: JsonValue) => void;
  onDeletePath: (path: (string | number)[]) => void;
  onToggleExpand: (path: (string | number)[]) => void;
}

function renderTreeNode(opts: TreeNodeOptions): string {
  const {
    value,
    path,
    depth,
    expanded,
    searchTerm,
    onChange,
    rootData,
    onUpdatePath,
    onDeletePath,
    onToggleExpand,
  } = opts;

  const indent = depth * 16;
  const pathStr = JSON.stringify(path);
  const type = getType(value);
  const isExpandable = type === "object" || type === "array";

  // Search filtering: check if this node or any descendant matches
  const matchesSearch =
    searchTerm === "" || nodeMatchesSearch(value, path, searchTerm);

  if (!matchesSearch && !isExpandable) {
    return "";
  }

  const pathKey = pathStr;
  const expandArrow = isExpandable ? (expanded ? "▼" : "▶") : " ";
  const expandClass = isExpandable
    ? "cursor-pointer hover:text-white"
    : "text-[#00ff9d]/30";

  let html = `<div class="tree-node" data-path="${escapeHtml(pathKey)}" style="padding-left:${indent}px">`;

  // Key display (for root-level, skip key label)
  const keyLabel = path.length > 0 ? path[path.length - 1] : "";
  const keyDisplay =
    typeof keyLabel === "number"
      ? `<span class="text-[#00ff9d]/60">[${keyLabel}]</span>`
      : `<span class="text-[#ff00aa]">${escapeHtml(String(keyLabel))}</span>`;

  // Type badge
  const typeBadge = `<span class="text-xs text-[#00ff9d]/40 ml-2">${type}</span>`;

  if (isExpandable) {
    const entryCount =
      type === "array"
        ? (value as JsonArray).length
        : Object.keys(value as JsonObject).length;
    const summary = `<span class="text-[#00ff9d]/50 ml-1">${entryCount} ${entryCount === 1 ? "entry" : "entries"}</span>`;

    html += `
      <div class="flex items-center py-1 hover:bg-[#111] rounded group">
        <span class="${expandClass} mr-1 select-none w-4 text-center" onclick="window.__treeToggle(${pathStr})">${expandArrow}</span>
        ${depth > 0 ? keyDisplay : ""}
        ${typeBadge}
        ${summary}
        ${depth > 0 ? `<button class="ml-auto text-[#ff4444]/60 hover:text-[#ff4444] opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2" onclick="window.__treeDelete(${pathStr})">✕</button>` : ""}
      </div>
    `;

    // Render children only if expanded
    if (expanded) {
      html += `<div class="tree-children">`;
      if (type === "array") {
        const arr = value as JsonArray;
        for (let i = 0; i < arr.length; i++) {
          html += renderTreeNode({
            value: arr[i],
            path: [...path, i],
            depth: depth + 1,
            expanded: isPathExpanded(path.concat(i)),
            searchTerm,
            onChange,
            rootData,
            onUpdatePath,
            onDeletePath,
            onToggleExpand,
          });
        }
        // Add item button
        html += `
          <div style="padding-left:${(depth + 1) * 16}px" class="py-1">
            <button class="text-[#00ff9d]/60 hover:text-[#00ff9d] text-xs" onclick="window.__treeAddItem(${pathStr})">+ Add Item</button>
          </div>
        `;
      } else {
        const obj = value as JsonObject;
        const keys = Object.keys(obj);
        for (const key of keys) {
          html += renderTreeNode({
            value: obj[key],
            path: [...path, key],
            depth: depth + 1,
            expanded: isPathExpanded(path.concat(key)),
            searchTerm,
            onChange,
            rootData,
            onUpdatePath,
            onDeletePath,
            onToggleExpand,
          });
        }
        // Add key button
        html += `
          <div style="padding-left:${(depth + 1) * 16}px" class="py-1">
            <button class="text-[#00ff9d]/60 hover:text-[#00ff9d] text-xs" onclick="window.__treeAddKey(${pathStr})">+ Add Key</button>
          </div>
        `;
      }
      html += `</div>`;
    }
  } else {
    // Primitive value rendering
    let valueDisplay = "";
    if (value === null) {
      valueDisplay = `<span class="text-[#00ff9d]/30 italic">null</span>`;
    } else if (value === undefined) {
      valueDisplay = `<span class="text-[#00ff9d]/30 italic">undefined</span>`;
    } else if (typeof value === "boolean") {
      valueDisplay = `
        <input type="checkbox" ${value ? "checked" : ""}
          class="ml-2 accent-[#00ff9d] cursor-pointer"
          onchange="window.__treeUpdatePrimitive(${pathStr}, this.checked)">
      `;
    } else if (typeof value === "number") {
      valueDisplay = `
        <input type="number" value="${value}"
          class="ml-2 bg-transparent border border-[#00ff9d]/40 rounded px-2 py-0.5 w-32 font-mono text-[#00ff9d] focus:outline-none focus:border-[#00ff9d]"
          onchange="window.__treeUpdatePrimitive(${pathStr}, this.value === '' ? 0 : Number(this.value))"
          onkeydown="if(event.key==='Enter'){this.blur()}">
      `;
    } else {
      valueDisplay = `
        <input type="text" value="${escapeHtml(String(value))}"
          class="ml-2 bg-transparent border border-[#00ff9d]/40 rounded px-2 py-0.5 w-48 font-mono text-[#00ff9d] focus:outline-none focus:border-[#00ff9d]"
          onchange="window.__treeUpdatePrimitive(${pathStr}, this.value)"
          onkeydown="if(event.key==='Enter'){this.blur()}">
      `;
    }

    html += `
      <div class="flex items-center py-1 hover:bg-[#111] rounded group">
        <span class="text-[#00ff9d]/30 mr-1 w-4 text-center select-none">${expandArrow}</span>
        ${depth > 0 ? keyDisplay : ""}
        ${typeBadge}
        ${valueDisplay}
        ${depth > 0 ? `<button class="ml-auto text-[#ff4444]/60 hover:text-[#ff4444] opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2" onclick="window.__treeDelete(${pathStr})">✕</button>` : ""}
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

// ====================== Expanded State Tracking ======================

let expandedPaths: Set<string> = new Set();

function isPathExpanded(path: (string | number)[]): boolean {
  return expandedPaths.has(JSON.stringify(path));
}

function togglePath(path: (string | number)[]): void {
  const key = JSON.stringify(path);
  if (expandedPaths.has(key)) {
    expandedPaths.delete(key);
  } else {
    expandedPaths.add(key);
  }
}

// ====================== Search ======================

function nodeMatchesSearch(
  value: JsonValue,
  path: (string | number)[],
  term: string,
): boolean {
  const lower = term.toLowerCase();

  // Check path keys
  for (const p of path) {
    if (String(p).toLowerCase().includes(lower)) return true;
  }

  // Check primitive value
  if (typeof value === "string" && value.toLowerCase().includes(lower))
    return true;
  if (typeof value === "number" && String(value).includes(lower)) return true;
  if (typeof value === "boolean" && String(value).toLowerCase().includes(lower))
    return true;

  return false;
}

// ====================== Path Operations ======================

function getValueAtPath(
  data: Record<string, unknown>,
  path: (string | number)[],
): JsonValue | undefined {
  let current: unknown = data;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      if (typeof key === "number" && key >= 0 && key < current.length) {
        current = current[key];
      } else {
        return undefined;
      }
    } else {
      if (key in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
  }
  return current as JsonValue;
}

function setValueAtPath(
  data: Record<string, unknown>,
  path: (string | number)[],
  newValue: JsonValue,
): void {
  if (path.length === 0) return;

  let current: unknown = data;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (Array.isArray(current)) {
      current = current[key as number];
    } else if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[key as string];
    } else {
      return;
    }
  }

  const lastKey = path[path.length - 1];
  if (Array.isArray(current)) {
    current[lastKey as number] = newValue;
  } else if (typeof current === "object" && current !== null) {
    (current as Record<string, unknown>)[lastKey as string] = newValue;
  }
}

function deleteValueAtPath(
  data: Record<string, unknown>,
  path: (string | number)[],
): void {
  if (path.length === 0) return;

  let current: unknown = data;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (Array.isArray(current)) {
      current = current[key as number];
    } else if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[key as string];
    } else {
      return;
    }
  }

  const lastKey = path[path.length - 1];
  if (Array.isArray(current)) {
    current.splice(lastKey as number, 1);
  } else if (typeof current === "object" && current !== null) {
    delete (current as Record<string, unknown>)[lastKey as string];
  }
}

// ====================== Main Render Function ======================

let currentRootData: Record<string, unknown> = {};
let currentOnChange: ((data: Record<string, unknown>) => void) | null = null;
let currentSearchTerm = "";

export function renderTreeEditor(
  container: HTMLElement,
  data: Record<string, unknown>,
  onChange: (data: Record<string, unknown>) => void,
): void {
  currentRootData = data;
  currentOnChange = onChange;
  currentSearchTerm = "";
  expandedPaths = new Set();

  renderEditor(container);
}

function renderEditor(container: HTMLElement): void {
  const data = currentRootData;
  const onChange = currentOnChange;
  if (!onChange) return;

  let html = `
    <div class="tree-editor font-mono text-sm">
      <!-- Search Bar -->
      <div class="mb-4 flex items-center gap-2">
        <span class="text-[#00ff9d]/60">🔍</span>
        <input
          id="treeSearchInput"
          type="text"
          placeholder="Filter by key or value..."
          value="${escapeHtml(currentSearchTerm)}"
          class="flex-1 bg-[#111] border border-[#00ff9d]/40 rounded-3xl px-4 py-2 text-[#00ff9d] placeholder-[#00ff9d]/30 focus:outline-none focus:border-[#00ff9d]"
          oninput="window.__treeSearch(this.value)"
        >
        ${currentSearchTerm ? `<button class="text-[#00ff9d]/60 hover:text-[#00ff9d] text-xs px-2" onclick="window.__treeClearSearch()">Clear</button>` : ""}
      </div>

      <!-- Tree Content -->
      <div class="tree-content border border-[#00ff9d]/40 rounded-3xl p-4 bg-black max-h-[70vh] overflow-y-auto">
  `;

  // Render root-level keys
  const keys = Object.keys(data);
  if (keys.length === 0) {
    html += `
      <div class="text-center py-8 text-[#00ff9d]/50">
        <p>Empty object</p>
        <button class="mt-2 text-[#00ff9d] hover:text-white text-xs" onclick="window.__treeAddRootKey()">+ Add Key</button>
      </div>
    `;
  } else {
    for (const key of keys) {
      html += renderTreeNode({
        value: data[key] as JsonValue,
        path: [key],
        depth: 0,
        expanded: isPathExpanded([key]),
        searchTerm: currentSearchTerm,
        onChange,
        rootData: data,
        onUpdatePath: handleUpdatePath,
        onDeletePath: handleDeletePath,
        onToggleExpand: handleToggleExpand,
      });
    }
    html += `
      <div class="py-2">
        <button class="text-[#00ff9d]/60 hover:text-[#00ff9d] text-xs" onclick="window.__treeAddRootKey()">+ Add Key</button>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Restore search input focus if there's a search term
  if (currentSearchTerm) {
    const searchInput = document.getElementById("treeSearchInput");
    if (searchInput) {
      (searchInput as HTMLInputElement).focus();
    }
  }
}

// ====================== Event Handlers ======================

function handleUpdatePath(
  path: (string | number)[],
  newValue: JsonValue,
): void {
  setValueAtPath(currentRootData, path, newValue);
  currentOnChange?.(currentRootData);
  // Re-render to reflect changes
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
}

function handleDeletePath(path: (string | number)[]): void {
  const keyLabel = path[path.length - 1];
  if (!confirm(`Delete "${keyLabel}"?`)) return;

  deleteValueAtPath(currentRootData, path);
  currentOnChange?.(currentRootData);
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
}

function handleToggleExpand(path: (string | number)[]): void {
  togglePath(path);
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
}

// ====================== Global Window Functions ======================

declare global {
  interface Window {
    __treeToggle: (path: (string | number)[]) => void;
    __treeDelete: (path: (string | number)[]) => void;
    __treeUpdatePrimitive: (
      path: (string | number)[],
      value: JsonValue,
    ) => void;
    __treeAddItem: (path: (string | number)[]) => void;
    __treeAddKey: (path: (string | number)[]) => void;
    __treeAddRootKey: () => void;
    __treeSearch: (term: string) => void;
    __treeClearSearch: () => void;
  }
}

window.__treeToggle = (path: (string | number)[]) => {
  handleToggleExpand(path);
};

window.__treeDelete = (path: (string | number)[]) => {
  handleDeletePath(path);
};

window.__treeUpdatePrimitive = (
  path: (string | number)[],
  value: JsonValue,
) => {
  handleUpdatePath(path, value);
};

window.__treeAddItem = (path: (string | number)[]) => {
  const type = promptForType();
  if (!type) return;

  const parentValue = getValueAtPath(currentRootData, path);
  if (!Array.isArray(parentValue)) return;

  parentValue.push(createDefaultValue(type));
  currentOnChange?.(currentRootData);
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
};

window.__treeAddKey = (path: (string | number)[]) => {
  const keyName = prompt("Key name:");
  if (!keyName || keyName.trim() === "") return;

  const type = promptForType();
  if (!type) return;

  const parentValue = getValueAtPath(currentRootData, path);
  if (
    typeof parentValue !== "object" ||
    parentValue === null ||
    Array.isArray(parentValue)
  )
    return;

  (parentValue as Record<string, unknown>)[keyName.trim()] =
    createDefaultValue(type);
  currentOnChange?.(currentRootData);
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
};

window.__treeAddRootKey = () => {
  const keyName = prompt("Key name:");
  if (!keyName || keyName.trim() === "") return;

  const type = promptForType();
  if (!type) return;

  currentRootData[keyName.trim()] = createDefaultValue(type);
  currentOnChange?.(currentRootData);
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
};

window.__treeSearch = (term: string) => {
  currentSearchTerm = term;
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
};

window.__treeClearSearch = () => {
  currentSearchTerm = "";
  const container = document.getElementById("editorContent");
  if (container) {
    renderEditor(container);
  }
};

// ====================== Type Prompt ======================

function promptForType(): ValueType | null {
  const choice = prompt(
    "Select value type:\n1. string\n2. number\n3. boolean\n4. null\n5. object {}\n6. array []",
  );
  if (!choice) return null;

  const map: Record<string, ValueType> = {
    "1": "string",
    "2": "number",
    "3": "boolean",
    "4": "null",
    "5": "object",
    "6": "array",
    string: "string",
    number: "number",
    boolean: "boolean",
    null: "null",
    object: "object",
    array: "array",
  };

  return map[choice.toLowerCase()] || null;
}
