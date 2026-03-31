// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Parser Infrastructure
 *
 * This module provides a unified interface for parsing various game save formats.
 * Each parser implements the Parser interface and is registered in the parser registry.
 */

import type { SaveData, JsonSaveData, RawSaveData } from "../types";

// ====================== Parser Interface ======================

/**
 * Result of a parse operation
 */
export interface ParseResult<T = unknown> {
  /** The parsed data in a JSON-serializable format */
  data: T;
  /** Whether the parser supports round-trip editing (save back to original format) */
  roundTripSupport: "stable" | "experimental" | "none";
  /** Metadata about the parsing process */
  metadata: ParseMetadata;
}

/**
 * Metadata about the parsed file
 */
export interface ParseMetadata {
  /** Original file extension */
  extension: string;
  /** Detected format label */
  formatLabel: string;
  /** Compression type if detected */
  compression?: string;
  /** File size in bytes */
  fileSize: number;
  /** Whether the file was decompressed during parsing */
  wasDecompressed: boolean;
  /** Any warnings from the parser */
  warnings?: string[];
}

/**
 * Parser interface that all format parsers must implement
 */
export interface Parser<TInput = ArrayBuffer, TOutput = unknown> {
  /** Unique parser identifier (e.g., 'nbt', 'gvas', 'ess') */
  readonly id: string;

  /** File extensions this parser handles (without dot) */
  readonly extensions: string[];

  /** Magic bytes that identify this format (optional, for header detection) */
  readonly magicBytes?: number[];

  /**
   * Parse the input data and return structured output
   * @param input - Raw file data as ArrayBuffer
   * @param fileName - Original filename for context
   * @returns ParseResult with structured data
   */
  parse(input: TInput, fileName: string): Promise<ParseResult<TOutput>>;

  /**
   * Serialize data back to the original format (if roundTripSupport !== 'none')
   * @param data - The parsed data to serialize
   * @returns Binary data as ArrayBuffer
   */
  serialize?(data: TOutput): ArrayBuffer | Promise<ArrayBuffer>;

  /**
   * Check if this parser can handle the given file based on header
   * @param bytes - First N bytes of the file
   * @returns true if the header matches this format
   */
  matchesHeader?(bytes: Uint8Array): boolean;
}

// ====================== Base Parser Class ======================

/**
 * Abstract base class providing common parser functionality
 */
export abstract class BaseParser<TInput = ArrayBuffer, TOutput = unknown>
  implements Parser<TInput, TOutput>
{
  abstract readonly id: string;
  abstract readonly extensions: string[];
  readonly magicBytes?: number[];

  async parse(input: TInput, fileName: string): Promise<ParseResult<TOutput>> {
    const startTime = performance.now();
    const result = await this.doParse(input, fileName);
    const duration = performance.now() - startTime;

    return {
      ...result,
      metadata: {
        ...result.metadata,
        fileSize: this.getSize(input),
      },
    };
  }

  /**
   * Get size of input data in bytes
   */
  protected getSize(input: TInput): number {
    if (input instanceof ArrayBuffer) {
      return input.byteLength;
    }
    if (input instanceof Uint8Array) {
      return input.byteLength;
    }
    if (typeof input === "string") {
      return new TextEncoder().encode(input).byteLength;
    }
    return 0;
  }

  /**
   * Subclasses implement this with actual parsing logic
   */
  protected abstract doParse(
    input: TInput,
    fileName: string,
  ): Promise<ParseResult<TOutput>>;

  /**
   * Default header matching based on magic bytes
   */
  matchesHeader(bytes: Uint8Array): boolean {
    if (!this.magicBytes) return false;
    if (bytes.length < this.magicBytes.length) return false;
    return this.magicBytes.every((byte, index) => bytes[index] === byte);
  }

  /**
   * Default serialize throws - subclasses must override if they support saving
   */
  serialize?(_data: TOutput): ArrayBuffer | Promise<ArrayBuffer> {
    throw new Error(
      `Parser '${this.id}' does not support serialization (round-trip editing)`,
    );
  }
}

// ====================== Parser Registry ======================

/**
 * Registry for managing and retrieving parsers
 */
export class ParserRegistry {
  private parsers: Map<string, Parser> = new Map();
  private byExtension: Map<string, Parser[]> = new Map();

  /**
   * Register a parser
   */
  register(parser: Parser): void {
    const existing = this.parsers.get(parser.id);
    if (existing) {
      console.warn(
        `Parser '${parser.id}' is already registered, overwriting...`,
      );
    }

    this.parsers.set(parser.id, parser);

    // Index by extension
    for (const ext of parser.extensions) {
      const normalized = ext.toLowerCase().replace(/^\./, "");
      if (!this.byExtension.has(normalized)) {
        this.byExtension.set(normalized, []);
      }
      this.byExtension.get(normalized)!.push(parser);
    }
  }

  /**
   * Get a parser by its ID
   */
  get(id: string): Parser | undefined {
    return this.parsers.get(id);
  }

  /**
   * Get all parsers that can handle a given file extension
   */
  getByExtension(ext: string): Parser[] {
    const normalized = ext.toLowerCase().replace(/^\./, "");
    return this.byExtension.get(normalized) || [];
  }

  /**
   * Find a parser that matches the given file header
   */
  findByHeader(bytes: Uint8Array, ext?: string): Parser | undefined {
    // First, try extension-specific parsers if extension provided
    if (ext) {
      const extensionParsers = this.getByExtension(ext);
      for (const parser of extensionParsers) {
        if (parser.matchesHeader && parser.matchesHeader(bytes)) {
          return parser;
        }
      }
    }

    // Fallback: check all parsers that have magic bytes
    for (const parser of this.parsers.values()) {
      if (parser.matchesHeader && parser.matchesHeader(bytes)) {
        return parser;
      }
    }

    return undefined;
  }

  /**
   * Get all registered parser IDs
   */
  listParserIds(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Check if a parser with the given ID exists
   */
  has(id: string): boolean {
    return this.parsers.has(id);
  }
}

// ====================== Global Registry Instance ======================

/**
 * Global parser registry instance
 */
export const parserRegistry = new ParserRegistry();

// ====================== Utility Functions ======================

/**
 * Convert ArrayBuffer to Uint8Array safely
 */
export function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

/**
 * Concatenate multiple Uint8Arrays
 */
export function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.byteLength;
  }
  return result;
}

/**
 * Safe string decoding with fallback for binary data
 */
export function safeDecode(
  bytes: Uint8Array,
  fallback: string = "[Binary Data]",
): string {
  try {
    // Try UTF-8 first
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return fallback;
  }
}

/**
 * Create a structured SaveData object from parsed content
 */
export function createSaveData(
  content: unknown,
  ext: string,
  roundTripSupport: "stable" | "experimental" | "none",
): SaveData {
  // If content is already a RawSaveData, return it
  if (isRawSaveData(content)) {
    return content;
  }

  // If content is a plain object, treat as JSON save data
  if (typeof content === "object" && content !== null && !Array.isArray(content)) {
    return content as JsonSaveData;
  }

  // Fallback: wrap in RawSaveData
  return {
    raw: JSON.stringify(content, null, 2),
  };
}

// Type guard for RawSaveData
function isRawSaveData(data: unknown): data is RawSaveData {
  return (
    typeof data === "object" &&
    data !== null &&
    "raw" in data &&
    typeof (data as any).raw === "string"
  );
}
