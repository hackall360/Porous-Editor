// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Loader and Type Utility Tests
 *
 * Tests for the parser loader module (initializeParsers, parseFile,
 * convertToSaveData, simplifyNbtData) and the type utility functions
 * from types/index.ts (format detection, guards, metadata).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initializeParsers,
  parseFile,
  getParserIdForExtension,
  hasSpecializedParser,
  getSupportedSpecializedFormats,
} from "../loader";
import {
  DEFAULT_FORMATS,
  getFormatMetadata,
  detectFormat,
  getFormatLabel,
  isJsonFormat,
  isRawSaveData,
  isJsonSaveData,
  requiresParser,
  getParserForFormat,
  detectFormatByHeader,
  SaveData,
  JsonSaveData,
  RawSaveData,
} from "../../types";

// ====================== Loader Tests ======================

describe("Loader - initializeParsers", () => {
  beforeEach(() => {
    // Re-initialize before each test to ensure clean state
    initializeParsers();
  });

  it("should register all expected parsers", () => {
    const nbtId = getParserIdForExtension("nbt");
    const unityId = getParserIdForExtension("xml");
    const gvasId = getParserIdForExtension("sav");
    const rpgId = getParserIdForExtension("rpgsave");

    expect(nbtId).toBe("nbt");
    expect(unityId).toBe("unity");
    expect(gvasId).toBe("gvas");
    expect(rpgId).toBe("rpgmaker");
  });

  it("should register parsers for all expected extensions", () => {
    expect(hasSpecializedParser("nbt")).toBe(true);
    expect(hasSpecializedParser("mca")).toBe(true);
    expect(hasSpecializedParser("mcr")).toBe(true);
    expect(hasSpecializedParser("sav")).toBe(true);
    expect(hasSpecializedParser("xml")).toBe(true);
    expect(hasSpecializedParser("plist")).toBe(true);
    expect(hasSpecializedParser("rpgsave")).toBe(true);
    expect(hasSpecializedParser("rmmzsave")).toBe(true);
  });

  it("should return false for unsupported extensions", () => {
    expect(hasSpecializedParser("unknown")).toBe(false);
    expect(hasSpecializedParser("txt")).toBe(false);
    expect(hasSpecializedParser("exe")).toBe(false);
  });

  it("should list all supported specialized formats", () => {
    const formats = getSupportedSpecializedFormats();

    expect(formats).toContain("nbt");
    expect(formats).toContain("mca");
    expect(formats).toContain("mcr");
    expect(formats).toContain("sav");
    expect(formats).toContain("xml");
    expect(formats).toContain("plist");
    expect(formats).toContain("rpgsave");
    expect(formats).toContain("rmmzsave");
  });

  it("should not have duplicate formats in the list", () => {
    const formats = getSupportedSpecializedFormats();
    const uniqueFormats = [...new Set(formats)];

    expect(formats.length).toBe(uniqueFormats.length);
  });
});

describe("Loader - parseFile", () => {
  beforeEach(() => {
    initializeParsers();
  });

  it("should parse a JSON file as json type via raw fallback", async () => {
    // .json has no registered parser, so it falls through to raw text
    const jsonContent = JSON.stringify({ gold: 100, level: 5 });
    const blob = new Blob([jsonContent], { type: "application/json" });
    const file = new File([blob], "save.json", { type: "application/json" });

    const result = await parseFile(file);

    expect(result.type).toBe("raw");
    expect((result.data as RawSaveData).raw).toBe(jsonContent);
    expect(result.parserId).toBeUndefined();
  });

  it("should parse an RPG Maker save with the rpgmaker parser", async () => {
    const saveData = {
      gold: 500,
      level: 10,
      variables: {},
      switches: [],
      items: [],
      party: null,
      actors: null,
      system: null,
    };
    const blob = new Blob([JSON.stringify(saveData)]);
    const file = new File([blob], "save.rpgsave");

    const result = await parseFile(file);

    expect(result.type).toBe("json");
    expect(result.parserId).toBe("rpgmaker");
    expect((result.data as JsonSaveData).gold).toBe(500);
  });

  it("should parse a Unity XML PlayerPrefs file", async () => {
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<map>
  <int name="score" value="999" />
  <string name="name" value="Player" />
</map>`;
    const blob = new Blob([xmlContent]);
    const file = new File([blob], "prefs.xml");

    const result = await parseFile(file);

    expect(result.type).toBe("json");
    expect(result.parserId).toBe("unity");
    expect((result.data as JsonSaveData).score).toBe(999);
    expect((result.data as JsonSaveData).name).toBe("Player");
  });

  it("should parse a GVAS file with the gvas parser", async () => {
    // Minimal valid GVAS structure
    const gvasBytes = new Uint8Array([
      0x47,
      0x56,
      0x41,
      0x53, // "GVAS"
      0x00, // Null terminator
      0x56,
      0x31,
      0x00, // "V1"
      0x00, // Empty package
      0x00,
      0x00,
      0x00,
      0x00, // End marker
    ]);
    const blob = new Blob([gvasBytes]);
    const file = new File([blob], "save.sav");

    const result = await parseFile(file);

    expect(result.type).toBe("json");
    expect(result.parserId).toBe("gvas");
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.formatLabel).toBe("Unreal GVAS");
  });

  it("should fall back to raw type for unknown binary files", async () => {
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
    const blob = new Blob([binaryData]);
    const file = new File([blob], "data.bin");

    const result = await parseFile(file);

    expect(result.type).toBe("raw");
    expect(result.parserId).toBeUndefined();
  });

  it("should fall back to raw type for unknown text files", async () => {
    const textContent = "This is just plain text, not a known format.";
    const blob = new Blob([textContent]);
    const file = new File([blob], "notes.txt");

    const result = await parseFile(file);

    expect(result.type).toBe("raw");
    expect((result.data as RawSaveData).raw).toBe(textContent);
  });

  it("should include metadata when using a specialized parser", async () => {
    const saveData = {
      gold: 0,
      level: 1,
      variables: {},
      switches: [],
      items: [],
      party: null,
      actors: null,
      system: null,
    };
    const blob = new Blob([JSON.stringify(saveData)]);
    const file = new File([blob], "test.rpgsave");

    const result = await parseFile(file);

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.extension).toBe("rpgsave");
    expect(result.metadata?.formatLabel).toBe("RPG Maker MV/MZ");
  });

  it("should handle files with uppercase extensions", async () => {
    const jsonContent = JSON.stringify({ test: true });
    const blob = new Blob([jsonContent]);
    const file = new File([blob], "SAVE.JSON");

    const result = await parseFile(file);

    // .json has no registered parser, falls to raw
    expect(result.type).toBe("raw");
  });
});

describe("Loader - convertToSaveData", () => {
  // convertToSaveData is not exported, so we test it indirectly through parseFile
  // The behavior is verified in the parseFile tests above

  it("should convert NBT compound data to JsonSaveData", async () => {
    initializeParsers();

    // Minimal NBT compound
    const nbtBytes = new Uint8Array([
      0x0a, // TAG_Compound
      0x00,
      0x00, // Empty root name
      0x03, // TAG_Int
      0x00,
      0x05, // Name length: 5
      0x73,
      0x63,
      0x6f,
      0x72,
      0x65, // "score"
      0x00,
      0x00,
      0x00,
      0x2a, // Value: 42
      0x00, // TAG_End
    ]);
    const blob = new Blob([nbtBytes]);
    const file = new File([blob], "data.nbt");

    const result = await parseFile(file);

    expect(result.type).toBe("json");
    expect(result.parserId).toBe("nbt");
  });
});

describe("Loader - simplifyNbtData", () => {
  // simplifyNbtData is not exported, tested indirectly through NBT parsing
  it("should simplify NBT compound to plain object via parseFile", async () => {
    initializeParsers();

    const nbtBytes = new Uint8Array([
      0x0a, // TAG_Compound
      0x00,
      0x00, // Empty root name
      0x08, // TAG_String
      0x00,
      0x04, // Name length: 4
      0x6e,
      0x61,
      0x6d,
      0x65, // "name"
      0x00,
      0x04, // String length: 4
      0x54,
      0x65,
      0x73,
      0x74, // "Test"
      0x00, // TAG_End
    ]);
    const blob = new Blob([nbtBytes]);
    const file = new File([blob], "data.nbt");

    const result = await parseFile(file);

    expect(result.type).toBe("json");
    // The data should be a simplified object, not raw NBT structure
    expect(result.data).toBeDefined();
  });
});

// ====================== Type Utility Tests ======================

describe("Type Utilities - DEFAULT_FORMATS", () => {
  it("should have jsonExtensions defined", () => {
    expect(DEFAULT_FORMATS.jsonExtensions).toContain("json");
    expect(DEFAULT_FORMATS.jsonExtensions).toContain("save");
  });

  it("should have rawExtensions defined", () => {
    expect(DEFAULT_FORMATS.rawExtensions).toContain("rpgsave");
    expect(DEFAULT_FORMATS.rawExtensions).toContain("rmmzsave");
    expect(DEFAULT_FORMATS.rawExtensions).toContain("sav");
    expect(DEFAULT_FORMATS.rawExtensions).toContain("nbt");
    expect(DEFAULT_FORMATS.rawExtensions).toContain("xml");
    expect(DEFAULT_FORMATS.rawExtensions).toContain("plist");
  });

  it("should have formatLabels for all raw extensions", () => {
    for (const ext of DEFAULT_FORMATS.rawExtensions) {
      expect(DEFAULT_FORMATS.formatLabels[ext]).toBeDefined();
      expect(typeof DEFAULT_FORMATS.formatLabels[ext]).toBe("string");
    }
  });

  it("should have formatMetadata for specialized formats", () => {
    expect(DEFAULT_FORMATS.formatMetadata).toBeDefined();
    expect(DEFAULT_FORMATS.formatMetadata?.nbt).toBeDefined();
    expect(DEFAULT_FORMATS.formatMetadata?.sav).toBeDefined();
    expect(DEFAULT_FORMATS.formatMetadata?.ess).toBeDefined();
  });
});

describe("Type Utilities - getFormatMetadata", () => {
  it("should return metadata for known formats", () => {
    const nbtMeta = getFormatMetadata("nbt");
    expect(nbtMeta).toBeDefined();
    expect(nbtMeta?.parser).toBe("nbt");
    expect(nbtMeta?.magicBytes).toEqual([0x0a]);
  });

  it("should return metadata for GVAS format", () => {
    const savMeta = getFormatMetadata("sav");
    expect(savMeta).toBeDefined();
    expect(savMeta?.parser).toBe("gvas");
    expect(savMeta?.magicBytes).toEqual([0x47, 0x56, 0x41, 0x53]);
  });

  it("should return undefined for unknown formats", () => {
    expect(getFormatMetadata("unknown")).toBeUndefined();
    expect(getFormatMetadata("txt")).toBeUndefined();
  });

  it("should handle extensions with leading dot", () => {
    const meta = getFormatMetadata(".nbt");
    expect(meta).toBeDefined();
    expect(meta?.parser).toBe("nbt");
  });

  it("should be case-insensitive", () => {
    const meta1 = getFormatMetadata("NBT");
    const meta2 = getFormatMetadata("nbt");

    expect(meta1).toEqual(meta2);
  });
});

describe("Type Utilities - detectFormat", () => {
  it("should detect JSON formats", () => {
    expect(detectFormat("json")).toBe("json");
    expect(detectFormat("save")).toBe("save");
  });

  it("should detect raw formats", () => {
    expect(detectFormat("rpgsave")).toBe("rpgsave");
    expect(detectFormat("rmmzsave")).toBe("rmmzsave");
    expect(detectFormat("sav")).toBe("sav");
    expect(detectFormat("nbt")).toBe("nbt");
  });

  it("should return 'raw' for unknown formats", () => {
    expect(detectFormat("unknown")).toBe("raw");
    expect(detectFormat("txt")).toBe("raw");
    expect(detectFormat("dat")).toBe("dat");
  });

  it("should handle extensions with leading dot", () => {
    expect(detectFormat(".json")).toBe("json");
    expect(detectFormat(".rpgsave")).toBe("rpgsave");
  });

  it("should be case-insensitive", () => {
    expect(detectFormat("JSON")).toBe("json");
    expect(detectFormat("RPGSAVE")).toBe("rpgsave");
    expect(detectFormat("NBT")).toBe("nbt");
  });
});

describe("Type Utilities - getFormatLabel", () => {
  it("should return correct labels for known formats", () => {
    expect(getFormatLabel("json")).toBe("JSON / Unity");
    expect(getFormatLabel("save")).toBe("JSON / Unity");
    expect(getFormatLabel("rpgsave")).toBe("RPG Maker MV/MZ");
    expect(getFormatLabel("nbt")).toBe("NBT (Minecraft)");
    expect(getFormatLabel("sav")).toBe("Generic / Unreal GVAS");
    expect(getFormatLabel("xml")).toBe("XML / Unity PlayerPrefs");
    expect(getFormatLabel("plist")).toBe("PLIST (macOS/iOS)");
  });

  it("should return 'RAW / UNKNOWN' for unknown formats", () => {
    expect(getFormatLabel("unknown")).toBe("RAW / UNKNOWN");
    expect(getFormatLabel("txt")).toBe("RAW / UNKNOWN");
  });

  it("should handle extensions with leading dot", () => {
    expect(getFormatLabel(".json")).toBe("JSON / Unity");
  });

  it("should be case-insensitive", () => {
    expect(getFormatLabel("JSON")).toBe("JSON / Unity");
    expect(getFormatLabel("NBT")).toBe("NBT (Minecraft)");
  });
});

describe("Type Utilities - isJsonFormat", () => {
  it("should return true for JSON formats", () => {
    expect(isJsonFormat("json")).toBe(true);
    expect(isJsonFormat("save")).toBe(true);
  });

  it("should return false for raw formats", () => {
    expect(isJsonFormat("rpgsave")).toBe(false);
    expect(isJsonFormat("nbt")).toBe(false);
    expect(isJsonFormat("sav")).toBe(false);
  });

  it("should return false for unknown formats", () => {
    expect(isJsonFormat("unknown")).toBe(false);
  });

  it("should handle extensions with leading dot", () => {
    expect(isJsonFormat(".json")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(isJsonFormat("JSON")).toBe(true);
    expect(isJsonFormat("Json")).toBe(true);
  });
});

describe("Type Utilities - requiresParser", () => {
  it("should return true for formats with parser metadata", () => {
    expect(requiresParser("nbt")).toBe(true);
    expect(requiresParser("sav")).toBe(true);
    expect(requiresParser("ess")).toBe(true);
    expect(requiresParser("sqlite")).toBe(true);
  });

  it("should return false for formats without parser metadata", () => {
    expect(requiresParser("json")).toBe(false);
    expect(requiresParser("rpgsave")).toBe(false);
    expect(requiresParser("unknown")).toBe(false);
  });

  it("should handle extensions with leading dot", () => {
    expect(requiresParser(".nbt")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(requiresParser("NBT")).toBe(true);
    expect(requiresParser("SAV")).toBe(true);
  });
});

describe("Type Utilities - getParserForFormat", () => {
  it("should return parser name for formats with parser", () => {
    expect(getParserForFormat("nbt")).toBe("nbt");
    expect(getParserForFormat("sav")).toBe("gvas");
    expect(getParserForFormat("ess")).toBe("ess");
    expect(getParserForFormat("sqlite")).toBe("sqlite");
  });

  it("should return undefined for formats without parser", () => {
    expect(getParserForFormat("json")).toBeUndefined();
    expect(getParserForFormat("rpgsave")).toBeUndefined();
    expect(getParserForFormat("unknown")).toBeUndefined();
  });

  it("should handle extensions with leading dot", () => {
    expect(getParserForFormat(".nbt")).toBe("nbt");
  });

  it("should be case-insensitive", () => {
    expect(getParserForFormat("NBT")).toBe("nbt");
  });
});

describe("Type Utilities - detectFormatByHeader", () => {
  it("should detect NBT format by magic byte", () => {
    const nbtHeader = new Uint8Array([0x0a, 0x00, 0x00]);
    expect(detectFormatByHeader(nbtHeader)).toBe("nbt");
  });

  it("should detect GVAS format by magic bytes", () => {
    const gvasHeader = new Uint8Array([0x47, 0x56, 0x41, 0x53, 0x00]);
    expect(detectFormatByHeader(gvasHeader)).toBe("sav");
  });

  it("should detect ESS format by magic bytes", () => {
    const essHeader = new Uint8Array([0x54, 0x45, 0x53, 0x56, 0x00]);
    expect(detectFormatByHeader(essHeader)).toBe("ess");
  });

  it("should detect SQLite format by magic bytes", () => {
    const sqliteHeader = new TextEncoder().encode("SQLite format 3\0");
    expect(detectFormatByHeader(sqliteHeader)).toBe("sqlite");
  });

  it("should return null for unrecognized headers", () => {
    const unknownHeader = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(detectFormatByHeader(unknownHeader)).toBeNull();
  });

  it("should return null for empty headers", () => {
    expect(detectFormatByHeader(new Uint8Array([]))).toBeNull();
  });

  it("should return null for headers shorter than magic bytes", () => {
    // GVAS magic is 4 bytes, provide only 2
    const shortHeader = new Uint8Array([0x47, 0x56]);
    expect(detectFormatByHeader(shortHeader)).toBeNull();
  });
});

describe("Type Guards - isRawSaveData", () => {
  it("should return true for RawSaveData", () => {
    const raw: RawSaveData = { raw: "some text content" };
    expect(isRawSaveData(raw)).toBe(true);
  });

  it("should return false for JsonSaveData", () => {
    const json: JsonSaveData = { gold: 100, level: 5 };
    expect(isRawSaveData(json)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isRawSaveData(null as unknown as SaveData)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isRawSaveData(undefined as unknown as SaveData)).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isRawSaveData([1, 2, 3] as unknown as SaveData)).toBe(false);
  });

  it("should return false for objects without raw property", () => {
    const obj = { data: "test" };
    expect(isRawSaveData(obj as unknown as SaveData)).toBe(false);
  });
});

describe("Type Guards - isJsonSaveData", () => {
  it("should return true for JsonSaveData", () => {
    const json: JsonSaveData = { gold: 100, level: 5 };
    expect(isJsonSaveData(json)).toBe(true);
  });

  it("should return true for objects with arbitrary properties", () => {
    const obj = { foo: "bar", count: 42, nested: { a: 1 } };
    expect(isJsonSaveData(obj as unknown as SaveData)).toBe(true);
  });

  it("should return false for RawSaveData", () => {
    const raw: RawSaveData = { raw: "some text" };
    expect(isJsonSaveData(raw)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isJsonSaveData(null as unknown as SaveData)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isJsonSaveData(undefined as unknown as SaveData)).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isJsonSaveData("string" as unknown as SaveData)).toBe(false);
    expect(isJsonSaveData(42 as unknown as SaveData)).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isJsonSaveData([1, 2, 3] as unknown as SaveData)).toBe(false);
  });
});

describe("Type Guards - SaveData union", () => {
  it("should correctly distinguish between RawSaveData and JsonSaveData", () => {
    const raw: SaveData = { raw: "binary content" };
    const json: SaveData = { gold: 500, items: [] };

    expect(isRawSaveData(raw)).toBe(true);
    expect(isJsonSaveData(raw)).toBe(false);

    expect(isRawSaveData(json)).toBe(false);
    expect(isJsonSaveData(json)).toBe(true);
  });

  it("should handle objects with both raw and other properties", () => {
    // An object with 'raw' property is treated as RawSaveData
    const ambiguous: SaveData = { raw: "text", gold: 100 };
    expect(isRawSaveData(ambiguous)).toBe(true);
    expect(isJsonSaveData(ambiguous)).toBe(false);
  });
});
