// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Parser Registry Tests
 *
 * Tests for the ParserRegistry class and parser registration system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ParserRegistry,
  BaseParser,
  ParseResult,
  toUint8Array,
  concatBuffers,
  safeDecode,
  createSaveData,
} from "../index";

// ====================== Test Fixtures ======================

class MockParser extends BaseParser<ArrayBuffer, Record<string, unknown>> {
  readonly id: string;
  readonly extensions: string[];
  readonly magicBytes?: number[];

  constructor(id: string, extensions: string[], magicBytes?: number[]) {
    super();
    this.id = id;
    this.extensions = extensions;
    this.magicBytes = magicBytes;
  }

  protected async doParse(
    _input: ArrayBuffer,
    _fileName: string,
  ): Promise<ParseResult<Record<string, unknown>>> {
    return {
      data: { parsed: true, parserId: this.id },
      roundTripSupport: "stable",
      metadata: {
        extension: this.extensions[0] || "mock",
        formatLabel: "Mock Parser",
        fileSize: 0,
        wasDecompressed: false,
        warnings: [],
      },
    };
  }
}

// ====================== Tests ======================

describe("ParserRegistry", () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    registry = new ParserRegistry();
  });

  describe("register()", () => {
    it("should register a parser and make it retrievable by ID", () => {
      const parser = new MockParser("test", ["test"]);
      registry.register(parser);

      const retrieved = registry.get("test");
      expect(retrieved).toBe(parser);
      expect(retrieved?.id).toBe("test");
    });

    it("should index parser by all its extensions", () => {
      const parser = new MockParser("multi", ["ext1", "ext2", "ext3"]);
      registry.register(parser);

      expect(registry.getByExtension("ext1")).toContain(parser);
      expect(registry.getByExtension("ext2")).toContain(parser);
      expect(registry.getByExtension("ext3")).toContain(parser);
    });

    it("should normalize extensions (lowercase, no dot)", () => {
      const parser = new MockParser("norm", [".EXT", "MixedCase"]);
      registry.register(parser);

      expect(registry.getByExtension("ext")).toContain(parser);
      expect(registry.getByExtension("mixedcase")).toContain(parser);
      expect(registry.getByExtension(".EXT")).toContain(parser);
    });

    it("should overwrite existing parser with warning", () => {
      const parser1 = new MockParser("dup", ["dup"]);
      const parser2 = new MockParser("dup", ["dup"]);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      registry.register(parser1);
      registry.register(parser2);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("already registered"),
      );
      expect(registry.get("dup")).toBe(parser2);

      warnSpy.mockRestore();
    });
  });

  describe("get()", () => {
    it("should return undefined for unregistered parser ID", () => {
      expect(registry.get("nonexistent")).toBeUndefined();
    });

    it("should return the correct parser by ID", () => {
      const parser = new MockParser("unique", ["unique"]);
      registry.register(parser);

      expect(registry.get("unique")).toBe(parser);
      expect(registry.get("other")).toBeUndefined();
    });
  });

  describe("getByExtension()", () => {
    it("should return empty array for unknown extension", () => {
      expect(registry.getByExtension("unknown")).toEqual([]);
    });

    it("should return all parsers that handle an extension", () => {
      const parser1 = new MockParser("a", ["shared"]);
      const parser2 = new MockParser("b", ["shared", "other"]);
      const parser3 = new MockParser("c", ["unique"]);

      registry.register(parser1);
      registry.register(parser2);
      registry.register(parser3);

      const sharedParsers = registry.getByExtension("shared");
      expect(sharedParsers).toHaveLength(2);
      expect(sharedParsers).toContain(parser1);
      expect(sharedParsers).toContain(parser2);
      expect(sharedParsers).not.toContain(parser3);
    });

    it("should handle case-insensitive extension lookup", () => {
      const parser = new MockParser("case", ["SAVE"]);
      registry.register(parser);

      expect(registry.getByExtension("save")).toContain(parser);
      expect(registry.getByExtension("SAVE")).toContain(parser);
      expect(registry.getByExtension("Save")).toContain(parser);
    });
  });

  describe("findByHeader()", () => {
    it("should return undefined when no parser has magic bytes", () => {
      const parser = new MockParser("nomagic", ["nomagic"]);
      registry.register(parser);

      const bytes = new Uint8Array([0x01, 0x02, 0x03]);
      expect(registry.findByHeader(bytes)).toBeUndefined();
    });

    it("should find parser by matching magic bytes", () => {
      const parser = new MockParser(
        "magic",
        ["magic"],
        [0xde, 0xad, 0xbe, 0xef],
      );
      registry.register(parser);

      const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01]);
      expect(registry.findByHeader(bytes)).toBe(parser);
    });

    it("should return undefined when magic bytes do not match", () => {
      const parser = new MockParser("magic", ["magic"], [0xde, 0xad]);
      registry.register(parser);

      const bytes = new Uint8Array([0xca, 0xfe, 0x00, 0x01]);
      expect(registry.findByHeader(bytes)).toBeUndefined();
    });

    it("should return undefined when input bytes are shorter than magic", () => {
      const parser = new MockParser(
        "magic",
        ["magic"],
        [0xde, 0xad, 0xbe, 0xef],
      );
      registry.register(parser);

      const bytes = new Uint8Array([0xde, 0xad]);
      expect(registry.findByHeader(bytes)).toBeUndefined();
    });

    it("should prioritize extension-specific parsers when extension provided", () => {
      const genericParser = new MockParser("generic", ["ext"], [0x01]);
      const specificParser = new MockParser("specific", ["ext"], [0x02]);

      registry.register(genericParser);
      registry.register(specificParser);

      // Bytes match specificParser, extension matches both
      const bytes = new Uint8Array([0x02, 0x00]);
      const found = registry.findByHeader(bytes, "ext");

      expect(found).toBe(specificParser);
    });

    it("should fallback to all parsers when extension does not match", () => {
      const parser = new MockParser("fallback", ["other"], [0xaa, 0xbb]);
      registry.register(parser);

      const bytes = new Uint8Array([0xaa, 0xbb, 0xcc]);
      expect(registry.findByHeader(bytes, "nomatch")).toBe(parser);
    });
  });

  describe("listParserIds()", () => {
    it("should return empty array when no parsers registered", () => {
      expect(registry.listParserIds()).toEqual([]);
    });

    it("should return all registered parser IDs", () => {
      registry.register(new MockParser("a", ["a"]));
      registry.register(new MockParser("b", ["b"]));
      registry.register(new MockParser("c", ["c"]));

      const ids = registry.listParserIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
      expect(ids).toContain("c");
    });
  });

  describe("has()", () => {
    it("should return true for registered parser", () => {
      registry.register(new MockParser("exists", ["exists"]));
      expect(registry.has("exists")).toBe(true);
    });

    it("should return false for unregistered parser", () => {
      expect(registry.has("missing")).toBe(false);
    });
  });
});

describe("BaseParser", () => {
  describe("getSize()", () => {
    class TestParser extends BaseParser<ArrayBuffer, unknown> {
      readonly id = "test";
      readonly extensions = ["test"];

      protected async doParse(
        _input: ArrayBuffer,
        _fileName: string,
      ): Promise<ParseResult<unknown>> {
        throw new Error("Not implemented");
      }

      public testGetSize(input: ArrayBuffer | Uint8Array | string): number {
        return this.getSize(input);
      }
    }

    it("should return byteLength for ArrayBuffer", () => {
      const parser = new TestParser();
      const buffer = new ArrayBuffer(100);
      expect(parser.testGetSize(buffer)).toBe(100);
    });

    it("should return byteLength for Uint8Array", () => {
      const parser = new TestParser();
      const arr = new Uint8Array(50);
      expect(parser.testGetSize(arr)).toBe(50);
    });

    it("should return encoded byte length for string", () => {
      const parser = new TestParser();
      // "hello" is 5 bytes in UTF-8
      expect(parser.testGetSize("hello")).toBe(5);
      // Unicode characters may be multiple bytes
      expect(parser.testGetSize("🎮")).toBe(4);
    });

    it("should return 0 for unknown input types", () => {
      const parser = new TestParser();
      expect(parser.testGetSize(42 as unknown as ArrayBuffer)).toBe(0);
      expect(parser.testGetSize(null as unknown as ArrayBuffer)).toBe(0);
    });
  });

  describe("matchesHeader()", () => {
    class TestParserWithMagic extends BaseParser<ArrayBuffer, unknown> {
      readonly id = "test";
      readonly extensions = ["test"];
      readonly magicBytes = [0x01, 0x02, 0x03];

      protected async doParse(
        _input: ArrayBuffer,
        _fileName: string,
      ): Promise<ParseResult<unknown>> {
        throw new Error("Not implemented");
      }
    }

    class TestParserNoMagic extends BaseParser<ArrayBuffer, unknown> {
      readonly id = "test";
      readonly extensions = ["test"];

      protected async doParse(
        _input: ArrayBuffer,
        _fileName: string,
      ): Promise<ParseResult<unknown>> {
        throw new Error("Not implemented");
      }
    }

    it("should return false when no magic bytes defined", () => {
      const parser = new TestParserNoMagic();
      expect(parser.matchesHeader(new Uint8Array([0x01, 0x02, 0x03]))).toBe(
        false,
      );
    });

    it("should return true when magic bytes match", () => {
      const parser = new TestParserWithMagic();
      expect(
        parser.matchesHeader(new Uint8Array([0x01, 0x02, 0x03, 0x04])),
      ).toBe(true);
    });

    it("should return false when magic bytes do not match", () => {
      const parser = new TestParserWithMagic();
      expect(parser.matchesHeader(new Uint8Array([0xff, 0xff, 0xff]))).toBe(
        false,
      );
    });

    it("should return false when input is shorter than magic bytes", () => {
      const parser = new TestParserWithMagic();
      expect(parser.matchesHeader(new Uint8Array([0x01, 0x02]))).toBe(false);
    });

    it("should return false when input is empty", () => {
      const parser = new TestParserWithMagic();
      expect(parser.matchesHeader(new Uint8Array([]))).toBe(false);
    });
  });
});

describe("Utility Functions", () => {
  describe("toUint8Array()", () => {
    it("should return Uint8Array as-is", () => {
      const arr = new Uint8Array([1, 2, 3]);
      const result = toUint8Array(arr);
      expect(result).toBe(arr);
    });

    it("should convert ArrayBuffer to Uint8Array", () => {
      const buffer = new ArrayBuffer(3);
      const view = new Uint8Array(buffer);
      view[0] = 10;
      view[1] = 20;
      view[2] = 30;

      const result = toUint8Array(buffer);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result).toEqual(new Uint8Array([10, 20, 30]));
    });
  });

  describe("concatBuffers()", () => {
    it("should concatenate multiple Uint8Arrays", () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5]);

      const result = concatBuffers([a, b, c]);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it("should return empty array for empty input", () => {
      expect(concatBuffers([])).toEqual(new Uint8Array([]));
    });

    it("should handle single buffer", () => {
      const a = new Uint8Array([42]);
      expect(concatBuffers([a])).toEqual(new Uint8Array([42]));
    });
  });

  describe("safeDecode()", () => {
    it("should decode valid UTF-8 bytes", () => {
      const bytes = new TextEncoder().encode("hello");
      expect(safeDecode(bytes)).toBe("hello");
    });

    it("should replace invalid bytes with replacement characters", () => {
      const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
      // TextDecoder with fatal:false replaces invalid bytes with U+FFFD
      const result = safeDecode(bytes, "[BINARY]");
      expect(result).toContain("\ufffd");
    });

    it("should use fallback only when TextDecoder throws (fatal:true path)", () => {
      // With fatal:false (current implementation), invalid bytes become replacement chars
      // The fallback is only used if TextDecoder itself throws
      const bytes = new TextEncoder().encode("valid");
      expect(safeDecode(bytes, "[BINARY]")).toBe("valid");
    });
  });

  describe("createSaveData()", () => {
    it("should return RawSaveData as-is", () => {
      const raw = { raw: "some text" };
      expect(createSaveData(raw)).toBe(raw);
    });

    it("should return plain objects as JsonSaveData", () => {
      const obj = { key: "value", count: 42 };
      const result = createSaveData(obj);
      expect(result).toEqual(obj);
    });

    it("should wrap arrays in RawSaveData", () => {
      const arr = [1, 2, 3];
      const result = createSaveData(arr);
      expect(result).toEqual({ raw: "[\n  1,\n  2,\n  3\n]" });
    });

    it("should wrap primitives in RawSaveData", () => {
      expect(createSaveData(42)).toEqual({ raw: "42" });
      expect(createSaveData("text")).toEqual({ raw: '"text"' });
      expect(createSaveData(null)).toEqual({ raw: "null" });
    });
  });
});
