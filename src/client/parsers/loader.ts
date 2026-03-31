// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Parser Loader and Integration Module
 *
 * This module initializes all parsers and provides a unified interface
 * for parsing save files using the appropriate parser based on file type.
 */

import { parserRegistry } from "./index";
import { createNbtParser } from "./nbt";
import { createUnityParser } from "./unity";
import { createGvasParser } from "./gvas";
import { createRPGMakerParser } from "./rpgmaker";
import type { SaveData, JsonSaveData, RawSaveData } from "../types";
import type { ParseResult } from "./index";

/**
 * Initialize all available parsers and register them
 */
export function initializeParsers(): void {
  // Register NBT parser
  const nbtParser = createNbtParser();
  parserRegistry.register(nbtParser);

  // Register Unity parser
  const unityParser = createUnityParser();
  parserRegistry.register(unityParser);

  // Register GVAS parser
  const gvasParser = createGvasParser();
  parserRegistry.register(gvasParser);

  // Register RPG Maker parser
  const rpgMakerParser = createRPGMakerParser();
  parserRegistry.register(rpgMakerParser);

  console.log(
    `%c✓ Parser system initialized with ${parserRegistry.listParserIds().length} parsers`,
    "color:#00ff9d; font-family:monospace",
  );
}

/**
 * Parse a file using the appropriate parser
 * Falls back to raw text if no suitable parser is found
 */
export async function parseFile(file: File): Promise<{
  data: SaveData;
  type: "json" | "raw";
  parserId?: string;
  metadata?: any;
}> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Try to find a parser by extension first
  const extensionParsers = parserRegistry.getByExtension(ext);

  for (const parser of extensionParsers) {
    try {
      const result: ParseResult = await parser.parse(arrayBuffer, file.name);

      if (result.data !== null) {
        // Convert parsed result to SaveData
        const saveData = convertToSaveData(result.data, parser.id);
        return {
          data: saveData,
          type: "json", // Parser-produced data is structured
          parserId: parser.id,
          metadata: result.metadata,
        };
      }
    } catch (error) {
      console.warn(`Parser '${parser.id}' failed for ${file.name}:`, error);
      continue;
    }
  }

  // Try header-based detection for formats with magic bytes
  const headerParser = parserRegistry.findByHeader(bytes, ext);
  if (headerParser) {
    try {
      const result: ParseResult = await headerParser.parse(arrayBuffer, file.name);

      if (result.data !== null) {
        const saveData = convertToSaveData(result.data, headerParser.id);
        return {
          data: saveData,
          type: "json",
          parserId: headerParser.id,
          metadata: result.metadata,
        };
      }
    } catch (error) {
      console.warn(`Header-matched parser '${headerParser.id}' failed:`, error);
    }
  }

  // Fallback: treat as raw text
  try {
    const text = await file.text();
    return {
      data: { raw: text } as RawSaveData,
      type: "raw",
    };
  } catch (error) {
    // If even reading as text fails, return empty raw data
    return {
      data: { raw: "" } as RawSaveData,
      type: "raw",
    };
  }
}

/**
 * Convert parser-specific output to our SaveData type
 */
function convertToSaveData(parsedData: any, parserId: string): SaveData {
  // If the parser already returns something that looks like our JsonSaveData
  if (typeof parsedData === "object" && parsedData !== null && !Array.isArray(parsedData)) {
    // Check if it has a 'data' property (our wrapper format)
    if (parsedData.data && typeof parsedData.data === "object") {
      return parsedData.data as JsonSaveData;
    }

    // Check if it has a 'properties' field (GVAS format)
    if (parsedData.properties && typeof parsedData.properties === "object") {
      // Convert GVAS properties to a more usable format
      const result: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(parsedData.properties)) {
        result[key] = prop.value;
      }
      // Preserve metadata
      (result as any)._parser = parserId;
      (result as any)._gvasHeader = parsedData.header;
      return result as JsonSaveData;
    }

    // Check if it's a simplified NBT structure
    if (parsedData.type === "compound" || parsedData.name !== undefined) {
      // NBT data - convert to plain object
      return simplifyNbtData(parsedData) as JsonSaveData;
    }

    // Check if it's Unity PlayerPrefs format
    if (parsedData.data !== undefined && parsedData.meta !== undefined) {
      return parsedData.data as JsonSaveData;
    }

    // Assume it's already a usable JSON-like object
    (parsedData as any)._parser = parserId;
    return parsedData as JsonSaveData;
  }

  // Fallback: wrap in raw data
  return {
    raw: JSON.stringify(parsedData, null, 2),
  } as RawSaveData;
}

/**
 * Simplify NBT compound data to plain JavaScript object
 */
function simplifyNbtData(nbtData: any): Record<string, unknown> {
  if (!nbtData) return {};

  // If it's already a simplified structure (from our simplifyNbt function)
  if (typeof nbtData === "object" && nbtData !== null && !Array.isArray(nbtData)) {
    if (nbtData.type === "compound") {
      const result: Record<string, unknown> = {};
      for (const entry of nbtData.entries || []) {
        result[entry.name] = simplifyNbtData(entry.value);
      }
      return result;
    }
    return nbtData as Record<string, unknown>;
  }

  return { value: nbtData };
}

/**
 * Get the appropriate parser ID for a file extension
 */
export function getParserIdForExtension(ext: string): string | undefined {
  const parsers = parserRegistry.getByExtension(ext);
  return parsers.length > 0 ? parsers[0].id : undefined;
}

/**
 * Check if a file extension has specialized parsing support
 */
export function hasSpecializedParser(ext: string): boolean {
  return parserRegistry.getByExtension(ext).length > 0;
}

/**
 * Get list of all supported specialized formats
 */
export function getSupportedSpecializedFormats(): string[] {
  const allParsers = parserRegistry.listParserIds();
  const extensions: string[] = [];
  for (const parserId of allParsers) {
    const parser = parserRegistry.get(parserId);
    if (parser) {
      extensions.push(...parser.extensions);
    }
  }
  return [...new Set(extensions)];
}
