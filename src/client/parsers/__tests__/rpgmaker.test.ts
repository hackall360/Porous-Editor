// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * RPG Maker Parser Tests
 *
 * Tests for the RPG Maker MV/MZ save file parser.
 * Covers JSON parsing, compression detection, round-trip serialization,
 * and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RPGMakerParser,
  RPGMakerSave,
  createRPGMakerParser,
} from "../rpgmaker";

// ====================== Test Fixtures ======================

function makePlainJsonSave(): ArrayBuffer {
  const saveData: RPGMakerSave = {
    gold: 1500,
    level: 25,
    variables: { "1": "Hero's Journey", "2": 42 },
    switches: [true, false, true, true],
    items: [
      { id: 1, amount: 5 },
      { id: 2, amount: 10 },
    ],
    party: { actors: [1, 2, 3] },
    actors: {
      "1": { name: "Hero", level: 25, hp: 500, mp: 120 },
      "2": { name: "Mage", level: 22, hp: 300, mp: 400 },
    },
    system: { gameTitle: "Test Game", version: "1.0.0" },
  };
  const encoded = new TextEncoder().encode(JSON.stringify(saveData));
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  );
}

function makeMinimalSave(): ArrayBuffer {
  const saveData: Partial<RPGMakerSave> = {
    gold: 0,
    level: 1,
    variables: {},
    switches: [],
    items: [],
  };
  const encoded = new TextEncoder().encode(JSON.stringify(saveData));
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  );
}

function makeInvalidData(): ArrayBuffer {
  const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

// ====================== Tests ======================

describe("RPGMakerParser", () => {
  let parser: RPGMakerParser;

  beforeEach(() => {
    parser = createRPGMakerParser();
  });

  describe("parser metadata", () => {
    it("should have correct parser ID", () => {
      expect(parser.id).toBe("rpgmaker");
    });

    it("should handle RPG Maker extensions", () => {
      expect(parser.extensions).toContain("rpgsave");
      expect(parser.extensions).toContain("rmmzsave");
    });

    it("should have no magic bytes (relies on extension)", () => {
      expect(parser.magicBytes).toBeUndefined();
    });
  });

  describe("parse() - plain JSON", () => {
    it("should parse uncompressed JSON save data", async () => {
      const input = makePlainJsonSave();
      const result = await parser.parse(input, "test.rpgsave");

      expect(result.data.gold).toBe(1500);
      expect(result.data.level).toBe(25);
      expect(result.data.variables).toEqual({ "1": "Hero's Journey", "2": 42 });
      expect(result.data.switches).toEqual([true, false, true, true]);
    });

    it("should mark round-trip support as stable for uncompressed data", async () => {
      const input = makePlainJsonSave();
      const result = await parser.parse(input, "test.rpgsave");

      expect(result.roundTripSupport).toBe("stable");
    });

    it("should include correct metadata for uncompressed parse", async () => {
      const input = makePlainJsonSave();
      const result = await parser.parse(input, "test.rpgsave");

      expect(result.metadata.extension).toBe("rpgsave");
      expect(result.metadata.formatLabel).toBe("RPG Maker MV/MZ");
      expect(result.metadata.wasDecompressed).toBe(false);
      expect(result.metadata.warnings).toEqual([]);
    });

    it("should parse minimal save data", async () => {
      const input = makeMinimalSave();
      const result = await parser.parse(input, "save.rmmzsave");

      expect(result.data.gold).toBe(0);
      expect(result.data.level).toBe(1);
      expect(result.metadata.extension).toBe("rmmzsave");
    });

    it("should handle file names without extension", async () => {
      const input = makePlainJsonSave();
      const result = await parser.parse(input, "nosavefile");

      expect(result.metadata.extension).toBe("nosavefile");
    });
  });

  describe("parse() - error handling", () => {
    it("should return error result for invalid binary data", async () => {
      const input = makeInvalidData();
      const result = await parser.parse(input, "test.rpgsave");

      expect(result.roundTripSupport).toBe("none");
      expect(result.metadata.wasDecompressed).toBe(false);
      expect(result.metadata.warnings.length).toBeGreaterThan(0);
      expect(result.metadata.warnings[0]).toContain("Parse error");
    });

    it("should return error result for malformed JSON", async () => {
      const input = new TextEncoder().encode("{ invalid json }").buffer;
      const result = await parser.parse(input, "test.rpgsave");

      expect(result.roundTripSupport).toBe("none");
      expect(result.metadata.warnings.length).toBeGreaterThan(0);
    });

    it("should return error result for empty file", async () => {
      const input = new ArrayBuffer(0);
      const result = await parser.parse(input, "test.rpgsave");

      expect(result.roundTripSupport).toBe("none");
    });
  });

  describe("serialize() - round-trip", () => {
    it("should serialize data with 'none' compression as JSON", () => {
      // Set detected compression to 'none' so serialize outputs plain JSON
      (parser as any).detectedCompression = "none";

      const saveData: RPGMakerSave = {
        gold: 500,
        level: 10,
        variables: { "1": "test" },
        switches: [true, false],
        items: [{ id: 1, amount: 3 }],
        party: null,
        actors: null,
        system: null,
      };

      const serialized = parser.serialize(saveData);
      expect(serialized.byteLength).toBeGreaterThan(0);

      // Should be valid JSON when decoded
      const text = new TextDecoder().decode(serialized);
      const parsed = JSON.parse(text);
      expect(parsed.gold).toBe(500);
      expect(parsed.level).toBe(10);
    });

    it("should preserve data integrity through serialize round-trip", () => {
      (parser as any).detectedCompression = "none";

      const original: RPGMakerSave = {
        gold: 9999,
        level: 99,
        variables: { "1": "value", "2": 123 },
        switches: [true, true, false],
        items: [
          { id: 1, amount: 10 },
          { id: 5, amount: 1 },
        ],
        party: { actors: [1, 2] },
        actors: { "1": { name: "Test", level: 99 } },
        system: { gameTitle: "Round Trip Test" },
      };

      const serialized = parser.serialize(original);
      const text = new TextDecoder().decode(serialized);
      const roundTripped = JSON.parse(text);

      expect(roundTripped.gold).toBe(original.gold);
      expect(roundTripped.level).toBe(original.level);
      expect(roundTripped.variables).toEqual(original.variables);
      expect(roundTripped.switches).toEqual(original.switches);
    });
  });

  describe("matchesHeader()", () => {
    it("should return false (no magic bytes defined)", () => {
      const bytes = new Uint8Array([0x00, 0x01, 0x02]);
      expect(parser.matchesHeader(bytes)).toBe(false);
    });

    it("should return false for empty input", () => {
      expect(parser.matchesHeader(new Uint8Array([]))).toBe(false);
    });
  });

  describe("getSize() (inherited from BaseParser)", () => {
    it("should return file size greater than zero for valid input", async () => {
      const input = makePlainJsonSave();
      const result = await parser.parse(input, "test.rpgsave");

      // fileSize should be set and greater than zero
      expect(result.metadata.fileSize).toBeGreaterThan(0);
    });
  });
});

describe("RPGMakerParser - factory", () => {
  it("should create a new parser instance via factory function", () => {
    const parser = createRPGMakerParser();
    expect(parser).toBeInstanceOf(RPGMakerParser);
    expect(parser.id).toBe("rpgmaker");
  });

  it("should create independent instances", () => {
    const parser1 = createRPGMakerParser();
    const parser2 = createRPGMakerParser();

    expect(parser1).not.toBe(parser2);
  });
});
