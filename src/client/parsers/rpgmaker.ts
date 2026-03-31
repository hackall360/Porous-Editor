// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * RPG Maker MV/MZ Save Parser
 *
 * Parses RPG Maker MV (2015) and RPG Maker MZ (2020) save files.
 * These are compressed JSON files, typically using LZString or zlib compression.
 *
 * Supports round-trip editing with compression preservation.
 * Based on research from saveeditor (paradoxie) and RPG Maker file format analysis.
 */

import { BaseParser, ParseResult, toUint8Array } from "./index";

// ====================== Type Definitions ======================

export interface RPGMakerSave {
  /** Gold/money amount */
  gold: number;
  /** Player level */
  level: number;
  /** Game variables */
  variables: Record<string, unknown>;
  /** Switches (boolean flags) */
  switches: boolean[];
  /** Inventory items */
  items: Array<{ id: number; amount: number }> | Record<string, number>;
  /** Party data */
  party: unknown;
  /** Actors (characters) */
  actors: unknown;
  /** System data */
  system: unknown;
  [key: string]: unknown;
}

export type RPGMakerCompressionType =
  | "lzstring"
  | "none"
  | "pako"
  | "fflate"
  | "pako-mojibake-fix"
  | "fflate-mojibake-fix"
  | "pako-raw"
  | "pako-gzip";

/**
 * Check if a value is a known compression type
 */
function isKnownCompressionType(input: unknown): input is RPGMakerCompressionType {
  return (
    input === "lzstring" ||
    input === "none" ||
    input === "pako" ||
    input === "fflate" ||
    input === "pako-mojibake-fix" ||
    input === "fflate-mojibake-fix" ||
    input === "pako-raw" ||
    input === "pako-gzip"
  );
}

// ====================== Compression Utilities ======================

/**
 * Try to decompress data using various algorithms
 * Returns the decompressed string or null if none work
 */
function tryDecompressAll(data: Uint8Array): { result: string | null; compression: RPGMakerCompressionType } {
  // Try LZString (base64)
  try {
    // @ts-ignore - LZString may be available globally
    const LZString = window.LZString || (typeof require !== 'undefined' && require('lz-string'));
    if (LZString) {
      const textData = new TextDecoder().decode(data);
      const decompressed = LZString.decompressFromBase64(textData);
      if (decompressed) {
        return { result: decompressed, compression: "lzstring" };
      }
    }
  } catch {
    // Continue to next method
  }

  // Try LZString (binary)
  try {
    // @ts-ignore
    const LZString = window.LZString || (typeof require !== 'undefined' && require('lz-string'));
    if (LZString) {
      const binaryString = binaryToString(data);
      const decompressed = LZString.decompress(binaryString);
      if (decompressed) {
        return { result: decompressed, compression: "lzstring" };
      }
    }
  } catch {
    // Continue
  }

  // Try pako (zlib)
  try {
    // @ts-ignore
    const pako = window.pako || (typeof require !== 'undefined' && require('pako'));
    if (pako) {
      const inflated = pako.inflate(data);
      const decompressed = new TextDecoder().decode(inflated);
      if (decompressed && isValidJson(decompressed)) {
        return { result: decompressed, compression: "pako" };
      }
    }
  } catch {
    // Continue
  }

  // Try fflate
  try {
    // @ts-ignore
    const fflate = window.fflate || (typeof require !== 'undefined' && require('fflate'));
    if (fflate) {
      const inflated = fflate.inflateSync(data);
      const decompressed = new TextDecoder().decode(inflated);
      if (decompressed && isValidJson(decompressed)) {
        return { result: decompressed, compression: "fflate" };
      }
    }
  } catch {
    // Continue
  }

  // Try raw deflate with pako
  try {
    // @ts-ignore
    const pako = window.pako || (typeof require !== 'undefined' && require('pako'));
    if (pako) {
      const rawBuffer = data.slice(2); // Skip zlib header
      const inflated = pako.inflateRaw(rawBuffer);
      const decompressed = new TextDecoder().decode(inflated);
      if (decompressed && isValidJson(decompressed)) {
        return { result: decompressed, compression: "pako-raw" };
      }
    }
  } catch {
    // Continue
  }

  // Try gzip
  try {
    // @ts-ignore
    const pako = window.pako || (typeof require !== 'undefined' && require('pako'));
    if (pako) {
      const inflated = pako.ungzip(data);
      const decompressed = new TextDecoder().decode(inflated);
      if (decompressed && isValidJson(decompressed)) {
        return { result: decompressed, compression: "pako-gzip" };
      }
    }
  } catch {
    // Continue
  }

  return { result: null, compression: "none" };
}

/**
 * Convert Uint8Array to binary string for LZString
 */
function binaryToString(data: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return binary;
}

/**
 * Check if a string is valid JSON
 */
function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// ====================== RPG Maker Parser Implementation ======================

export class RPGMakerParser extends BaseParser<ArrayBuffer, RPGMakerSave> {
  readonly id = "rpgmaker";
  readonly extensions = ["rpgsave", "rmmzsave"];
  readonly magicBytes?: number[] = undefined; // No fixed magic bytes

  private detectedCompression: RPGMakerCompressionType | null = null;

  async parse(input: ArrayBuffer, fileName: string): Promise<ParseResult<RPGMakerSave>> {
    const startTime = performance.now();
    const data = new Uint8Array(input);

    try {
      // Try to detect if it's already plain JSON
      const asText = new TextDecoder().decode(data);
      if (isValidJson(asText)) {
        this.detectedCompression = "none";
        const parsed = JSON.parse(asText) as RPGMakerSave;
        return {
          data: parsed,
          roundTripSupport: "stable",
          metadata: {
            extension: fileName.split(".").pop() || "rpgsave",
            formatLabel: "RPG Maker MV/MZ",
            fileSize: input.byteLength,
            wasDecompressed: false,
            warnings: undefined,
          },
        };
      }

      // Try various decompression methods
      const { result, compression } = tryDecompressAll(data);
      if (!result) {
        throw new Error("Unable to decompress save file. Unknown or unsupported compression format.");
      }

      this.detectedCompression = compression;
      const parsed = JSON.parse(result) as RPGMakerSave;

      // Add compression metadata to parsed data (for round-trip)
      (parsed as any)._compressionType = compression;

      const duration = performance.now() - startTime;

      return {
        data: parsed,
        roundTripSupport: this.getRoundTripSupport(compression),
        metadata: {
          extension: fileName.split(".").pop() || "rpgsave",
          formatLabel: "RPG Maker MV/MZ",
          compression,
          fileSize: input.byteLength,
          wasDecompressed: true,
          warnings: this.getWarnings(compression),
        },
      };
    } catch (error: any) {
      return {
        data: null,
        roundTripSupport: "none",
        metadata: {
          extension: fileName.split(".").pop() || "rpgsave",
          formatLabel: "RPG Maker MV/MZ",
          fileSize: input.byteLength,
          wasDecompressed: false,
          warnings: [`Parse error: ${error.message}`],
        },
      };
    }
  }

  /**
   * Determine round-trip support based on compression type
   */
  private getRoundTripSupport(compression: RPGMakerCompressionType): "stable" | "experimental" | "none" {
    switch (compression) {
      case "lzstring":
      case "none":
        return "stable";
      case "pako":
      case "fflate":
      case "pako-raw":
      case "pako-gzip":
        return "experimental";
      default:
        return "none";
    }
  }

  /**
   * Get warnings based on compression type
   */
  private getWarnings(compression: RPGMakerCompressionType): string[] | undefined {
    const warnings: string[] = [];
    if (compression.includes("mojibake")) {
      warnings.push("File used mojibake encoding fix for character encoding.");
    }
    if (compression === "pako-raw") {
      warnings.push("Used raw deflate compression (no zlib header).");
    }
    return warnings.length > 0 ? warnings : undefined;
  }

  /**
   * Serialize RPG Maker save data back to file format
   */
  serialize(data: RPGMakerSave): ArrayBuffer {
    const compression = this.detectedCompression || "lzstring";

    // Remove internal metadata
    const { _compressionType, ...saveData } = data as any;

    const json = JSON.stringify(saveData);

    switch (compression) {
      case "lzstring": {
        // @ts-ignore
        const LZString = window.LZString || (typeof require !== 'undefined' && require('lz-string'));
        if (LZString) {
          const compressed = LZString.compressToBase64(json);
          return new TextEncoder().encode(compressed).buffer;
        }
        // Fallback to uncompressed
        return new TextEncoder().encode(json).buffer;
      }

      case "pako": {
        // @ts-ignore
        const pako = window.pako || (typeof require !== 'undefined' && require('pako'));
        if (pako) {
          const compressed = pako.deflate(new TextEncoder().encode(json));
          return compressed.buffer;
        }
        return new TextEncoder().encode(json).buffer;
      }

      case "fflate": {
        // @ts-ignore
        const fflate = window.fflate || (typeof require !== 'undefined' && require('fflate'));
        if (fflate) {
          const compressed = fflate.deflateSync(new TextEncoder().encode(json));
          return (compressed as Uint8Array).buffer;
        }
        return new TextEncoder().encode(json).buffer;
      }

      case "pako-raw": {
        // @ts-ignore
        const pako = window.pako || (typeof require !== 'undefined' && require('pako'));
        if (pako) {
          const compressed = pako.deflateRaw(new TextEncoder().encode(json));
          return compressed.buffer;
        }
        return new TextEncoder().encode(json).buffer;
      }

      case "pako-gzip": {
        // @ts-ignore
        const pako = window.pako || (typeof require !== 'undefined' && require('pako'));
        if (pako) {
          const compressed = pako.gzip(new TextEncoder().encode(json));
          return compressed.buffer;
        }
        return new TextEncoder().encode(json).buffer;
      }

      case "none":
      default:
        return new TextEncoder().encode(json).buffer;
    }
  }
}

// ====================== Factory Function ======================

/**
 * Create an RPG Maker parser instance
 */
export function createRPGMakerParser(): RPGMakerParser {
  return new RPGMakerParser();
}
