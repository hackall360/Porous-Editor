// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Unity PlayerPrefs Parser
 *
 * Parses Unity PlayerPrefs save files in two formats:
 * - XML: Legacy text format with <map> entries
 * - PLIST: Binary or XML property list format (macOS/iOS)
 *
 * Supports round-trip editing with type preservation.
 * Based on research from saveeditor (paradoxie) and Unity documentation.
 */

import { BaseParser, ParseResult } from "./index";

// ====================== Type Definitions ======================

export type UnityInputFormat = "unity-xml" | "unity-plist";

export interface UnityParseMeta {
  inputFormat: UnityInputFormat;
  keyOrder: string[];
  valueTypes: Record<string, UnityValueType>;
}

export type UnityValueType = "int" | "long" | "float" | "string" | "boolean";

export interface UnityParseResult {
  data: Record<string, unknown>;
  meta: UnityParseMeta;
}

// ====================== Unity XML Parser ======================

/**
 * Parse Unity XML PlayerPrefs format
 * Format: <?xml version="1.0" encoding="utf-8"?>
 * <map>
 *   <int name="gold" value="100" />
 *   <string name="playerName" value="Hero" />
 *   ...
 * </map>
 */
function parseUnityXml(text: string): UnityParseResult {
  const result: Record<string, unknown> = {};
  const valueTypes: Record<string, UnityValueType> = {};
  const keyOrder: string[] = [];

  // Regex to match Unity XML tags
  // Matches: <int name="key" value="123" />, <string name="key" value="text" />, etc.
  const tagPattern = /<(int|long|float|string|boolean)\b([^>]*)\/?>/gi;
  let matched = false;

  for (const match of text.matchAll(tagPattern)) {
    const tag = match[1] as UnityValueType;
    const attrs = match[2] || "";
    const textValue = match[3] ?? "";

    // Extract name attribute
    const nameMatch = attrs.match(/\bname\s*=\s*"([^"]+)"/i);
    if (!nameMatch) continue;

    const rawName = decodeXmlEntities(nameMatch[1]!);

    // Extract value attribute or use text content
    const valueMatch = attrs.match(/\bvalue\s*=\s*"([^"]*)"/i);
    const attrValue = valueMatch ? decodeXmlEntities(valueMatch[1]!) : null;
    const fallbackValue = decodeXmlEntities(textValue.trim());
    const rawValue = attrValue ?? fallbackValue;

    // Parse based on tag type
    let parsedValue: unknown;
    if (tag === "int" || tag === "long") {
      parsedValue = parseInt(rawValue || "0", 10);
    } else if (tag === "float") {
      parsedValue = parseFloat(rawValue || "0");
    } else if (tag === "boolean") {
      parsedValue = rawValue === "true" || rawValue === "1";
    } else {
      parsedValue = rawValue;
    }

    result[rawName] = parsedValue;
    valueTypes[rawName] = tag;
    keyOrder.push(rawName);

    matched = true;
  }

  if (!matched) {
    throw new Error("Invalid Unity XML: No supported <map> entries found.");
  }

  return {
    data: result,
    meta: {
      inputFormat: "unity-xml",
      keyOrder,
      valueTypes,
    },
  };
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Encode XML entities
 */
function encodeXmlEntities(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Infer Unity value type from JavaScript value
 */
function inferUnityType(value: unknown): UnityValueType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "int" : "float";
  }
  return "string";
}

// ====================== Unity PLIST Parser ======================

/**
 * Parse binary or XML plist format
 * Uses the browser's built-in plist parser if available (from plist npm package)
 */
async function parseUnityPlist(text: string): Promise<UnityParseResult> {
  // Try to use plist library if available
  try {
    // Dynamic import of plist library (would need to be added as dependency)
    // For now, we'll implement a basic XML plist parser
    return parseXmlPlist(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse PLIST: ${message}`);
  }
}

/**
 * Parse XML-based plist format
 */
function parseXmlPlist(text: string): UnityParseResult {
  const result: Record<string, unknown> = {};
  const keyOrder: string[] = [];

  // Simple regex-based extraction (for basic plist files)
  // A full implementation would use DOMParser
  const dictPattern =
    /<key>([^<]+)<\/key>\s*<(string|integer|real|true|false)\b[^>]*>(?:([^<]*)<\/\2>)?/g;

  for (const match of text.matchAll(dictPattern)) {
    const key = match[1]!.trim();
    const type = match[2];
    const valueStr = match[3] ?? "";

    let value: unknown;
    switch (type) {
      case "integer":
        value = parseInt(valueStr, 10);
        break;
      case "real":
        value = parseFloat(valueStr);
        break;
      case "true":
        value = true;
        break;
      case "false":
        value = false;
        break;
      case "string":
      default:
        value = valueStr;
    }

    result[key] = value;
    keyOrder.push(key);
  }

  if (keyOrder.length === 0) {
    throw new Error("Invalid PLIST: No key-value pairs found.");
  }

  return {
    data: result,
    meta: {
      inputFormat: "unity-plist",
      keyOrder,
      valueTypes: Object.fromEntries(
        Object.entries(result).map(([key, value]) => [
          key,
          inferUnityType(value),
        ]),
      ),
    },
  };
}

// ====================== Unity Parser Implementation ======================

export class UnityParser extends BaseParser<ArrayBuffer, UnityParseResult> {
  readonly id = "unity";
  readonly extensions = ["xml", "plist"];
  readonly magicBytes?: number[] = undefined;

  protected async doParse(
    input: ArrayBuffer,

    fileName: string,
  ): Promise<ParseResult<UnityParseResult>> {
    let data: UnityParseResult;

    try {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(input);

      // Detect format
      if (text.trim().startsWith("<?xml") && text.includes("<!DOCTYPE plist")) {
        data = await parseUnityPlist(text);
      } else if (text.trim().startsWith("<?xml") || text.includes("<map>")) {
        data = parseUnityXml(text);
      } else {
        // Try binary plist detection
        const bytes = new Uint8Array(input);
        if (
          bytes.length >= 6 &&
          bytes[0] === 0x62 &&
          bytes[1] === 0x70 &&
          bytes[2] === 0x6c &&
          bytes[3] === 0x69 &&
          bytes[4] === 0x73 &&
          bytes[5] === 0x74
        ) {
          throw new Error(
            "Binary plist format is not supported. Please convert to XML plist.",
          );
        }
        throw new Error("Unrecognized Unity PlayerPrefs format.");
      }

      // duration tracking removed - was unused

      return {
        data,
        roundTripSupport: "stable",
        metadata: {
          extension: fileName.split(".").pop() || "xml",
          formatLabel: "Unity PlayerPrefs",
          fileSize: input.byteLength,
          wasDecompressed: false,
          warnings: [],
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        data: {
          data: {},
          meta: { inputFormat: "unity-xml", keyOrder: [], valueTypes: {} },
        },
        roundTripSupport: "none",
        metadata: {
          extension: fileName.split(".").pop() || "xml",
          formatLabel: "Unity PlayerPrefs",
          fileSize: input.byteLength,
          wasDecompressed: false,
          warnings: [`Parse error: ${message}`],
        },
      };
    }
  }

  serialize(data: UnityParseResult): ArrayBuffer {
    const { meta, data: payload } = data;
    const orderedEntries = Object.entries(payload);

    if (meta.inputFormat === "unity-plist") {
      // Generate XML plist
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml +=
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n';
      xml += '<plist version="1.0">\n';
      xml += "<dict>\n";

      for (const [key, value] of orderedEntries) {
        const safeKey = encodeXmlEntities(key);
        const valueType = meta.valueTypes[key] || inferUnityType(value);

        if (valueType === "boolean") {
          xml += `\t<key>${safeKey}</key>\n\t<${value} />\n`;
        } else if (valueType === "int" || valueType === "long") {
          xml += `\t<key>${safeKey}</key>\n\t<${valueType}>${value}</${valueType}>\n`;
        } else if (valueType === "float") {
          xml += `\t<key>${safeKey}</key>\n\t<real>${value}</real>\n`;
        } else {
          const safeValue = encodeXmlEntities(String(value ?? ""));
          xml += `\t<key>${safeKey}</key>\n\t<string>${safeValue}</string>\n`;
        }
      }

      xml += "</dict>\n";
      xml += "</plist>\n";

      return new TextEncoder().encode(xml).buffer;
    } else {
      // Generate Unity XML format
      let xml =
        "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n";

      for (const [key, value] of orderedEntries) {
        const safeKey = encodeXmlEntities(key);
        const valueType = meta.valueTypes[key] || inferUnityType(value);

        if (valueType === "boolean") {
          const boolValue =
            value === true || value === "true" || value === 1 || value === "1";
          xml += `    <${valueType} name="${safeKey}" value="${boolValue}" />\n`;
        } else if (valueType === "int" || valueType === "long") {
          const numericValue = parseInt(String(value ?? 0), 10);
          const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
          xml += `    <${valueType} name="${safeKey}" value="${safeValue}" />\n`;
        } else if (valueType === "float") {
          const numericValue = parseFloat(String(value ?? 0));
          const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
          xml += `    <${valueType} name="${safeKey}" value="${safeValue}" />\n`;
        } else {
          const safeValue = encodeXmlEntities(String(value ?? ""));
          xml += `    <string name="${safeKey}" value="${safeValue}" />\n`;
        }
      }

      xml += "</map>";
      return new TextEncoder().encode(xml).buffer;
    }
  }
}

// ====================== Factory Function ======================

/**
 * Create a Unity PlayerPrefs parser instance
 */
export function createUnityParser(): UnityParser {
  return new UnityParser();
}
