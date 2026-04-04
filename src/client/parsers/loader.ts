// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Parser Loader and Integration Module
 *
 * This module initializes all parsers and provides a unified interface
 * for parsing save files using the appropriate parser based on file type.
 */

import { parserRegistry, ParseMetadata } from "./index";

// Re-export parserRegistry for use in main.ts
export { parserRegistry };
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
  metadata?: ParseMetadata;
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
      const result: ParseResult = await headerParser.parse(
        arrayBuffer,
        file.name,
      );

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
function convertToSaveData(parsedData: unknown, parserId: string): SaveData {
  // If the parser already returns something that looks like our JsonSaveData
  if (
    typeof parsedData === "object" &&
    parsedData !== null &&
    !Array.isArray(parsedData)
  ) {
    const obj = parsedData as Record<string, unknown>;
    // Check if it has a 'data' property (our wrapper format)
    if (obj["data"] && typeof obj["data"] === "object") {
      return obj["data"] as JsonSaveData;
    }

    // Check if it has a 'properties' field (GVAS format)
    if (obj["properties"] && typeof obj["properties"] === "object") {
      // Convert GVAS properties to a more usable format
      const result: Record<string, unknown> = {};
      const props = obj["properties"] as Record<string, { value: unknown }>;
      for (const [key, prop] of Object.entries(props)) {
        result[key] = prop.value;
      }

      // Preserve metadata
      result["_parser"] = parserId;
      result["_gvasHeader"] = obj["header"];

      return result as JsonSaveData;
    }

    // Check if it's a simplified NBT structure
    if (obj["type"] === "compound" || obj["name"] !== undefined) {
      // NBT data - convert to plain object
      return simplifyNbtData(obj) as JsonSaveData;
    }

    // Check if it's Unity PlayerPrefs format
    if (obj["data"] !== undefined && obj["meta"] !== undefined) {
      return obj["data"] as JsonSaveData;
    }

    // Assume it's already a usable JSON-like object
    obj["_parser"] = parserId;
    return obj as JsonSaveData;
  }

  // Fallback: wrap in raw data
  return {
    raw: JSON.stringify(parsedData, null, 2),
  } as RawSaveData;
}

/**
 * Simplify NBT compound data to plain JavaScript object
 */
function simplifyNbtData(nbtData: unknown): Record<string, unknown> {
  if (!nbtData) return {};

  // If it's already a simplified structure (from our simplifyNbt function)
  if (
    typeof nbtData === "object" &&
    nbtData !== null &&
    !Array.isArray(nbtData)
  ) {
    const obj = nbtData as Record<string, unknown>;
    if (obj["type"] === "compound") {
      const result: Record<string, unknown> = {};
      const entries =
        (obj["entries"] as Array<{ name: string; value: unknown }>) || [];
      for (const entry of entries) {
        result[entry.name] = simplifyNbtData(entry.value);
      }
      return result;
    }
    return obj;
  }

  return { value: nbtData };
}

/**
 * Get the appropriate parser ID for a file extension
 */
export function getParserIdForExtension(ext: string): string | undefined {
  const parsers = parserRegistry.getByExtension(ext);
  return parsers.length > 0 ? parsers[0]!.id : undefined;
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
