// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// ====================== src/client/types/index.ts ======================

/**
 * Supported save file formats
 */
export type SaveFormat =
  // JSON-based structured formats
  | "json"
  | "save"
  // RPG Maker series
  | "rmmzsave"
  | "rpgsave"
  | "rvdata2"
  | "rxdata"
  | "lsd"
  // Unreal Engine / Generic
  | "sav"
  // Additional supported formats
  | "srm" // Emulator save (bsnes, SNES9x)
  | "dat" // Generic data file
  | "ess" // Bethesda Elder Scrolls save
  | "mca" // Minecraft region (Anvil)
  | "nbt" // Named Binary Tag (Minecraft)
  | "dsv" // DeSmuME save
  | "mcr" // Minecraft region (Beta)
  | "sc2save" // StarCraft 2 save
  | "wld" // Terraria world
  | "plr" // Terraria player
  | "gam" // GameMaker save
  | "ps2" // PlayStation 2 memory card
  | "p2s" // PlayStation 2 save
  | "mpk" // Mario Party save
  | "eep" // EEPROM save
  | "bess" // BESS emulator save
  | "mgz" // Age of Empires
  | "sqlite" // SQLite database
  | "db" // SQLite database (alternate)
  | "xml" // XML-based (Unity PlayerPrefs)
  | "bin" // Generic binary
  | "frz" // SNES9x state
  | "es3" // ES3 (Unity)
  | "plist" // Apple property list
  | "raw"; // Fallback for unknown formats

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
 * Metadata for formats that require special parsing
 */
export interface FormatMetadata {
  /** Parser module name (e.g., 'nbt', 'gvas', 'ess') */
  parser?: string;
  /** Magic bytes for header detection (optional) */
  magicBytes?: number[];
  /** Compression type if known */
  compression?:
    | "none"
    | "zlib"
    | "gzip"
    | "lzstring"
    | "raw-deflate"
    | "custom";
  /** Whether this format supports round-trip editing */
  roundTrip?: "stable" | "experimental" | "none";
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
  parserId: string | null;
}

/**
 * Editor state in memory
 */
export interface EditorState {
  currentData: SaveData | null;
  originalName: string;
  originalExt: string;
  storedType: "json" | "raw";
  parserId: string | null;
}

/**
 * Configuration for format detection
 */
export interface FormatDetection {
  jsonExtensions: string[];
  rawExtensions: string[];
  formatLabels: Record<string, string>;
  /** Optional metadata for each format (keyed by extension without dot) */
  formatMetadata?: Record<string, FormatMetadata>;
}

/**
 * Default format detection configuration
 */
export const DEFAULT_FORMATS: FormatDetection = {
  jsonExtensions: ["json", "save"],
  rawExtensions: [
    "rmmzsave",
    "rpgsave",
    "rvdata2",
    "rxdata",
    "lsd",
    "sav",
    // Additional formats
    "srm", // Emulator save (bsnes, SNES9x)
    "dat", // Generic data
    "ess", // Bethesda Elder Scrolls
    "mca", // Minecraft region (Anvil)
    "nbt", // NBT data
    "dsv", // DeSmuME save
    "mcr", // Minecraft region (Beta)
    "sc2save", // StarCraft 2
    "wld", // Terraria world
    "plr", // Terraria player
    "gam", // GameMaker
    "ps2", // PS2 memory card
    "p2s", // PS2 save
    "mpk", // Mario Party
    "eep", // EEPROM
    "bess", // BESS emulator
    "mgz", // Age of Empires
    "sqlite", // SQLite DB
    "db", // SQLite DB alternate
    "xml", // XML (Unity PlayerPrefs)
    "bin", // Generic binary
    "frz", // SNES9x state
    "es3", // ES3 (Unity)
    "plist", // Apple property list
  ],
  formatLabels: {
    json: "JSON / Unity",
    save: "JSON / Unity",
    rmmzsave: "RPG Maker MV/MZ",
    rpgsave: "RPG Maker MV/MZ",
    rvdata2: "RPG Maker VX Ace",
    rxdata: "RPG Maker XP/VX",
    lsd: "RPG Maker 2000/2003",
    sav: "Generic / Unreal GVAS",
    srm: "SRM (Emulator Save)",
    dat: "Generic DAT",
    ess: "Bethesda ESS",
    mca: "Minecraft Region (Anvil)",
    nbt: "NBT (Minecraft)",
    dsv: "DSV (DeSmuME)",
    mcr: "Minecraft Region (Beta)",
    sc2save: "StarCraft 2 Save",
    wld: "Terraria World",
    plr: "Terraria Player",
    gam: "GameMaker Save",
    ps2: "PS2 Memory Card",
    p2s: "PS2 Save",
    mpk: "MPK (Mario Party)",
    eep: "EEPROM Save",
    bess: "BESS (Emulator)",
    mgz: "Age of Empires",
    sqlite: "SQLite Database",
    db: "SQLite Database",
    xml: "XML / Unity PlayerPrefs",
    bin: "Generic Binary",
    frz: "SNES9x State",
    es3: "ES3 (Unity)",
    plist: "PLIST (macOS/iOS)",
  },
  formatMetadata: {
    // Parser assignments for formats that need special handling
    nbt: {
      parser: "nbt",
      magicBytes: [0x0a],
      compression: "none",
      roundTrip: "stable",
    },
    mca: {
      parser: "nbt",
      magicBytes: [0, 0, 0, 0],
      compression: "zlib",
      roundTrip: "experimental",
    },
    mcr: {
      parser: "nbt",
      magicBytes: [0, 0, 0, 0],
      compression: "zlib",
      roundTrip: "experimental",
    },
    sav: {
      parser: "gvas",
      magicBytes: [0x47, 0x56, 0x41, 0x53], // "GVAS"
      compression: "none",
      roundTrip: "stable",
    },
    xml: { parser: "unity-xml", roundTrip: "stable" },
    plist: { parser: "unity-plist", roundTrip: "stable" },
    ess: {
      parser: "ess",
      magicBytes: [0x54, 0x45, 0x53, 0x56], // "TESV"
      compression: "zlib",
      roundTrip: "experimental",
    },
    sqlite: {
      parser: "sqlite",
      magicBytes: [
        0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61,
        0x74, 0x20, 0x33,
      ], // "SQLite format 3"
      roundTrip: "none",
    },
    db: {
      parser: "sqlite",
      magicBytes: [
        0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61,
        0x74, 0x20, 0x33,
      ],
      roundTrip: "none",
    },
    sc2save: { parser: "sc2save", roundTrip: "none" },
    wld: { parser: "terraria", roundTrip: "experimental" },
    plr: { parser: "terraria", roundTrip: "experimental" },
    // Additional parsers will be added as they are implemented
  },
};

/**
 * Get metadata for a specific format extension
 */
export function getFormatMetadata(ext: string): FormatMetadata | undefined {
  const normalizedExt = ext.toLowerCase().replace(/^\./, "");
  return DEFAULT_FORMATS.formatMetadata?.[normalizedExt];
}

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
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    "raw" in data
  );
}

/**
 * Type guard to check if data is JsonSaveData
 */
export function isJsonSaveData(data: SaveData): data is JsonSaveData {
  return (
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    !("raw" in data)
  );
}

/**
 * Check if a format requires a specialized parser
 */
export function requiresParser(ext: string): boolean {
  const metadata = getFormatMetadata(ext);
  return metadata?.parser !== undefined;
}

/**

 * Get the parser name for a format

 */

export function getParserForFormat(ext: string): string | undefined {
  return getFormatMetadata(ext)?.parser;
}

/**
 * Detect format by reading magic bytes from file header

 * Returns the detected format or null if no match
 */
export function detectFormatByHeader(bytes: Uint8Array): SaveFormat | null {
  const metadataEntries = Object.entries(DEFAULT_FORMATS.formatMetadata || {});

  for (const [ext, meta] of metadataEntries) {
    if (!meta.magicBytes) continue;

    const magic = meta.magicBytes;
    if (bytes.length >= magic.length) {
      const matches = magic.every((byte, index) => bytes[index] === byte);
      if (matches) {
        return ext as SaveFormat;
      }
    }
  }

  return null;
}
