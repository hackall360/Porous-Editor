// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// ====================== src/client/types/index.ts ======================

/**
 * Supported save file formats
 */
export type SaveFormat =
  | "json"
  | "save"
  | "rmmzsave"
  | "rpgsave"
  | "rvdata2"
  | "rxdata"
  | "lsd"
  | "sav"
  | "raw";

/**
 * Inventory item structure
 */
export interface InventoryItem {
  name: string;
  qty: number;
  amount?: number; // Alternative field name used in some formats
}

/**
 * Raw text data (for non-JSON formats)
 */
export interface RawSaveData {
  raw: string;
}

/**
 * Parsed JSON save data
 * Uses Record<string, unknown> for flexibility with any JSON structure
 * Known properties are typed for better IntelliSense and safety
 */
export interface JsonSaveData extends Record<string, unknown> {
  money?: number;
  gold?: number;
  items?: InventoryItem[];
}

/**
 * Union type for all possible save data
 */
export type SaveData = RawSaveData | JsonSaveData;

/**
 * Detected format label for UI display
 */
export interface FormatInfo {
  extension: string;
  label: string;
  type: "json" | "raw";
}

/**
 * Stored save data in localStorage
 */
export interface StoredSave {
  name: string;
  ext: string;
  data: SaveData;
  type: "json" | "raw";
  timestamp: number;
}

/**
 * Editor state in memory
 */
export interface EditorState {
  currentData: SaveData | null;
  originalName: string;
  originalExt: string;
  storedType: "json" | "raw";
}

/**
 * Configuration for format detection
 */
export interface FormatDetection {
  jsonExtensions: string[];
  rawExtensions: string[];
  formatLabels: Record<string, string>;
}

/**
 * Default format detection configuration
 */
export const DEFAULT_FORMATS: FormatDetection = {
  jsonExtensions: ["json", "save"],
  rawExtensions: ["rmmzsave", "rpgsave", "rvdata2", "rxdata", "lsd", "sav"],
  formatLabels: {
    json: "JSON / UNITY",
    save: "JSON / UNITY",
    rmmzsave: "RPG MAKER MV/MZ",
    rpgsave: "RPG MAKER MV/MZ",
    rvdata2: "RPG MAKER VX",
    rxdata: "RPG MAKER VX",
    lsd: "RPG MAKER 2000",
    sav: "RAW / UNKNOWN",
  },
};

/**
 * Utility function to detect format from extension
 */
export function detectFormat(ext: string): SaveFormat {
  const normalizedExt = ext.toLowerCase().replace(/^\./, "");

  if (DEFAULT_FORMATS.jsonExtensions.includes(normalizedExt)) {
    return normalizedExt as SaveFormat;
  }
  if (DEFAULT_FORMATS.rawExtensions.includes(normalizedExt)) {
    return normalizedExt as SaveFormat;
  }
  return "raw";
}

/**
 * Get display label for a format
 */
export function getFormatLabel(ext: string): string {
  const normalizedExt = ext.toLowerCase().replace(/^\./, "");
  return DEFAULT_FORMATS.formatLabels[normalizedExt] || "RAW / UNKNOWN";
}

/**
 * Check if a format is JSON-based
 */
export function isJsonFormat(ext: string): boolean {
  return DEFAULT_FORMATS.jsonExtensions.includes(
    ext.toLowerCase().replace(/^\./, ""),
  );
}

/**
 * Type guard to check if data is RawSaveData
 */
export function isRawSaveData(data: SaveData): data is RawSaveData {
  return "raw" in data;
}

/**
 * Type guard to check if data is JsonSaveData
 */
export function isJsonSaveData(data: SaveData): data is JsonSaveData {
  return !("raw" in data) && typeof data === "object" && data !== null;
}
