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
 * Auto-detects format based on content
 */
async function parseUnityPlist(
  input: ArrayBuffer | string,
): Promise<UnityParseResult> {
  // Check if input is binary (ArrayBuffer)
  if (input instanceof ArrayBuffer) {
    const bytes = new Uint8Array(input);
    // Binary plist starts with "bplist00"
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x62 &&
      bytes[1] === 0x70 &&
      bytes[2] === 0x6c &&
      bytes[3] === 0x69 &&
      bytes[4] === 0x73 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x30 &&
      bytes[7] === 0x30
    ) {
      return parseBinaryPlist(bytes);
    }
  }

  // Fall back to XML parsing
  const text =
    typeof input === "string"
      ? input
      : new TextDecoder().decode(input as ArrayBuffer);
  return parseXmlPlist(text);
}

/**
 * Parse Apple binary plist format (bplist00)
 * Based on the Apple binary plist specification
 */
function parseBinaryPlist(bytes: Uint8Array): UnityParseResult {
  const result: Record<string, unknown> = {};
  const keyOrder: string[] = [];

  // Read trailer (last 32 bytes)
  if (bytes.length < 32) {
    throw new Error("Binary plist too small to contain trailer");
  }

  const trailerOffset = bytes.length - 32;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const offsetSize = view.getUint8(trailerOffset + 6);
  const objectRefSize = view.getUint8(trailerOffset + 7);
  const numObjects = view.getUint32(trailerOffset + 24, false);
  const topObjectRef = readUIntValue(
    view,
    trailerOffset + 28,
    objectRefSize,
    false,
  );
  const offsetTableOffset = readUIntValue(
    view,
    trailerOffset + 16,
    offsetSize,
    false,
  );

  // Read offset table
  const offsets: number[] = [];
  for (let i = 0; i < numObjects; i++) {
    offsets.push(
      readUIntValue(
        view,
        offsetTableOffset + i * offsetSize,
        offsetSize,
        false,
      ),
    );
  }

  // Parse objects
  const objectCache: Map<number, unknown> = new Map();

  function parseObject(ref: number): unknown {
    if (objectCache.has(ref)) {
      return objectCache.get(ref);
    }

    const offset = offsets[ref];
    if (offset === undefined) return null;
    let pos: number = offset;
    const marker = view.getUint8(pos);
    pos += 1;

    const type = (marker >> 4) & 0x0f;
    const info = marker & 0x0f;

    let value: unknown;

    switch (type) {
      case 0x0: // Null/bool/int
        if (info === 0x0) {
          value = null;
        } else if (info === 0x8) {
          value = false;
        } else if (info === 0x9) {
          value = true;
        } else if (info === 0xf) {
          value = null; // Fill byte
        } else {
          value = null;
        }
        break;

      case 0x1: // Integer
        const intBytes = 1 << info;
        let intVal = 0n;
        for (let i = 0; i < intBytes; i++) {
          intVal = (intVal << 8n) | BigInt(view.getUint8(pos + i));
        }
        value =
          intVal <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(intVal) : intVal;
        break;

      case 0x2: // Real
        if (info === 2) {
          value = view.getFloat32(pos, false);
        } else if (info === 3) {
          value = view.getFloat64(pos, false);
        }
        break;

      case 0x3: // Date (not commonly used in Unity plists)
        value = null;
        break;

      case 0x4: {
        // Data
        const dataLen =
          info === 0xf ? readUIntValue(view, pos, 1, false) : info;
        const dataStart = info === 0xf ? pos + 1 : pos;
        value = Array.from(bytes.slice(dataStart, dataStart + dataLen));
        break;
      }

      case 0x5: {
        // ASCII string
        const asciiLen =
          info === 0xf ? readUIntValue(view, pos, 1, false) : info;
        const asciiStart = info === 0xf ? pos + 1 : pos;
        value = String.fromCharCode(
          ...bytes.slice(asciiStart, asciiStart + asciiLen),
        );
        break;
      }

      case 0x6: {
        // UTF-16 string
        const utf16Len =
          info === 0xf ? readUIntValue(view, pos, 1, false) : info;
        const utf16Start = info === 0xf ? pos + 1 : pos;
        const utf16Bytes = bytes.slice(utf16Start, utf16Start + utf16Len * 2);
        value = new TextDecoder("utf-16be").decode(utf16Bytes);
        break;
      }

      case 0x8: {
        // UID (usually for keyed archiver, treat as number)
        const uidBytes = info + 1;
        let uidVal = 0;
        for (let i = 0; i < uidBytes; i++) {
          uidVal = (uidVal << 8) | view.getUint8(pos + i);
        }
        value = uidVal;
        break;
      }

      case 0xa: {
        // Array
        const arrayLen =
          info === 0xf ? readUIntValue(view, pos, 1, false) : info;
        const arrayStart = info === 0xf ? pos + 1 : pos;
        const arrayItems: unknown[] = [];
        for (let i = 0; i < arrayLen; i++) {
          const itemRef = readUIntValue(
            view,
            arrayStart + i * objectRefSize,
            objectRefSize,
            false,
          );
          arrayItems.push(parseObject(itemRef));
        }
        value = arrayItems;
        break;
      }

      case 0xd: {
        // Dictionary
        const dictLen =
          info === 0xf ? readUIntValue(view, pos, 1, false) : info;
        const dictStart = info === 0xf ? pos + 1 : pos;
        const dictObj: Record<string, unknown> = {};
        for (let i = 0; i < dictLen; i++) {
          const keyRef = readUIntValue(
            view,
            dictStart + i * objectRefSize,
            objectRefSize,
            false,
          );
          const valRef = readUIntValue(
            view,
            dictStart + (dictLen + i) * objectRefSize,
            objectRefSize,
            false,
          );
          const key = parseObject(keyRef) as string;
          dictObj[key] = parseObject(valRef);
        }
        value = dictObj;
        break;
      }

      default:
        value = null;
        break;
    }

    objectCache.set(ref, value);
    return value;
  }

  // Parse top-level object (should be a dictionary)
  const topObj = parseObject(topObjectRef);

  if (typeof topObj === "object" && topObj !== null && !Array.isArray(topObj)) {
    const dict = topObj as Record<string, unknown>;
    for (const [key, val] of Object.entries(dict)) {
      result[key] = val;
      keyOrder.push(key);
    }
  }

  if (keyOrder.length === 0) {
    throw new Error("Invalid binary plist: no key-value pairs found");
  }

  return {
    data: result,
    meta: {
      inputFormat: "unity-plist",
      keyOrder,
      valueTypes: Object.fromEntries(
        Object.entries(result).map(([key, val]) => [key, inferUnityType(val)]),
      ),
    },
  };
}

/**
 * Read an unsigned integer value of arbitrary byte size
 */
function readUIntValue(
  view: DataView,
  offset: number,
  byteSize: number,
  littleEndian: boolean,
): number {
  if (byteSize === 1) return view.getUint8(offset);
  if (byteSize === 2) return view.getUint16(offset, littleEndian);
  if (byteSize === 4) return view.getUint32(offset, littleEndian);
  if (byteSize === 8) {
    // For 8-byte values, use BigInt then convert if safe
    const high = view.getUint32(offset, littleEndian);
    const low = view.getUint32(offset + 4, littleEndian);
    const val = littleEndian
      ? BigInt(low) | (BigInt(high) << 32n)
      : (BigInt(high) << 32n) | BigInt(low);
    return val <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(val) : Number(val);
  }
  return 0;
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

// ====================== Binary Plist Serialization ======================

/**
 * Serialize UnityParseResult to bplist00 binary format
 * Produces a valid Apple binary property list that mirrors parseBinaryPlist
 */
export function serializeBinaryPlist(data: UnityParseResult): ArrayBuffer {
  const { data: payload } = data;
  const encoder = new TextEncoder();

  // Object table: each object gets an index
  const objects: Uint8Array[] = [];
  const objectOffsets: number[] = [];

  // Track string objects to deduplicate keys
  const stringCache = new Map<string, number>();

  function addObject(bytes: Uint8Array): number {
    const idx = objects.length;
    objects.push(bytes);
    return idx;
  }

  function getStringObjectIndex(str: string): number {
    if (stringCache.has(str)) {
      return stringCache.get(str)!;
    }
    // UTF-16 string: 0x6n where n=length, or 0x6f + length byte for extended
    const utf16Bytes = new Uint8Array(
      new TextEncoder().encode(str).byteLength * 2,
    );
    // Encode as UTF-16BE
    const view = new DataView(utf16Bytes.buffer);
    for (let i = 0; i < str.length; i++) {
      view.setUint16(i * 2, str.charCodeAt(i), false);
    }
    const len = str.length;
    let header: Uint8Array;
    if (len < 0xf) {
      header = new Uint8Array([0x60 | len]);
    } else {
      header = new Uint8Array([0x6f, len]);
    }
    const objBytes = new Uint8Array(header.byteLength + utf16Bytes.byteLength);
    objBytes.set(header, 0);
    objBytes.set(utf16Bytes, header.byteLength);
    const idx = addObject(objBytes);
    stringCache.set(str, idx);
    return idx;
  }

  function getValueObjectIndex(value: unknown): number {
    if (value === null || value === undefined) {
      return addObject(new Uint8Array([0x00]));
    }
    if (typeof value === "boolean") {
      return addObject(new Uint8Array([value ? 0x09 : 0x08]));
    }
    if (typeof value === "number") {
      if (Number.isInteger(value)) {
        const num = value;
        if (num >= 0 && num <= 0xff) {
          return addObject(new Uint8Array([0x10, num]));
        } else if (num >= -0x80 && num <= 0x7fff) {
          const buf = new Uint8Array(3);
          buf[0] = 0x11;
          buf[1] = (num >> 8) & 0xff;
          buf[2] = num & 0xff;
          return addObject(buf);
        } else if (num >= -0x8000 && num <= 0xffffffff) {
          const buf = new Uint8Array(5);
          buf[0] = 0x12;
          const v = new DataView(buf.buffer);
          v.setUint32(1, num >>> 0, false);
          return addObject(buf);
        } else {
          const buf = new Uint8Array(9);
          buf[0] = 0x13;
          const v = new DataView(buf.buffer);
          // Write as 64-bit big-endian
          const high = Math.floor(num / 0x100000000);
          const low = num >>> 0;
          v.setUint32(1, high >>> 0, false);
          v.setUint32(5, low, false);
          return addObject(buf);
        }
      } else {
        // Float64
        const buf = new Uint8Array(9);
        buf[0] = 0x23;
        new DataView(buf.buffer).setFloat64(1, value, false);
        return addObject(buf);
      }
    }
    if (typeof value === "string") {
      return getStringObjectIndex(value);
    }
    if (Array.isArray(value)) {
      const len = value.length;
      const itemRefs = value.map((v) => getValueObjectIndex(v));
      const refSize = Math.max(1, Math.ceil(Math.log2(objects.length + 1) / 8));
      let header: Uint8Array;
      if (len < 0xf) {
        header = new Uint8Array([0xa0 | len]);
      } else {
        header = new Uint8Array([0xaf, len]);
      }
      const refs = new Uint8Array(itemRefs.length * refSize);
      const refView = new DataView(refs.buffer);
      for (let i = 0; i < itemRefs.length; i++) {
        refView.setUint32(i * refSize, itemRefs[i]!, false);
      }
      const objBytes = new Uint8Array(header.byteLength + refs.byteLength);
      objBytes.set(header, 0);
      objBytes.set(refs, header.byteLength);
      return addObject(objBytes);
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      const len = entries.length;
      const keyRefs = entries.map(([k]) => getStringObjectIndex(k));
      const valRefs = entries.map(([, v]) => getValueObjectIndex(v));
      const refSize = Math.max(1, Math.ceil(Math.log2(objects.length + 1) / 8));
      let header: Uint8Array;
      if (len < 0xf) {
        header = new Uint8Array([0xd0 | len]);
      } else {
        header = new Uint8Array([0xdf, len]);
      }
      const refs = new Uint8Array(entries.length * 2 * refSize);
      const refView = new DataView(refs.buffer);
      for (let i = 0; i < entries.length; i++) {
        refView.setUint32(i * refSize, keyRefs[i]!, false);
        refView.setUint32((entries.length + i) * refSize, valRefs[i]!, false);
      }
      const objBytes = new Uint8Array(header.byteLength + refs.byteLength);
      objBytes.set(header, 0);
      objBytes.set(refs, header.byteLength);
      return addObject(objBytes);
    }
    // Fallback: null
    return addObject(new Uint8Array([0x00]));
  }

  // Build the top-level dictionary
  const topDictRef = getValueObjectIndex(payload);

  // Calculate offsets
  let currentOffset = 0;
  for (const obj of objects) {
    objectOffsets.push(currentOffset);
    currentOffset += obj.byteLength;
  }

  const offsetTableOffset = currentOffset;
  const offsetSize = Math.max(
    1,
    Math.ceil(Math.log2(offsetTableOffset + 1) / 8),
  );
  const objectRefSize = Math.max(
    1,
    Math.ceil(Math.log2(objects.length + 1) / 8),
  );
  const numObjects = objects.length;

  // Build offset table
  const offsetTable = new Uint8Array(numObjects * offsetSize);
  const offsetView = new DataView(offsetTable.buffer);
  for (let i = 0; i < numObjects; i++) {
    offsetView.setUint32(i * offsetSize, objectOffsets[i]!, false);
  }

  // Build trailer (32 bytes)
  const trailer = new Uint8Array(32);
  const trailerView = new DataView(trailer.buffer);
  // unused(6) = 0
  trailer[6] = offsetSize;
  trailer[7] = objectRefSize;
  // numObjects (8 bytes, big-endian)
  trailerView.setUint32(24, 0, false); // high 4 bytes
  trailerView.setUint32(28, numObjects, false); // low 4 bytes
  // topObjectRef (8 bytes, big-endian)
  trailerView.setUint32(16, 0, false); // high 4 bytes
  trailerView.setUint32(20, topDictRef, false); // low 4 bytes
  // offsetTableOffset (8 bytes, big-endian)
  trailerView.setUint32(8, 0, false); // high 4 bytes
  trailerView.setUint32(12, offsetTableOffset, false); // low 4 bytes
  // unused(4) at end = 0

  // Combine: header + objects + offset table + trailer
  const header = encoder.encode("bplist00");
  const totalSize =
    header.byteLength +
    objects.reduce((s, o) => s + o.byteLength, 0) +
    offsetTable.byteLength +
    trailer.byteLength;

  const result = new Uint8Array(totalSize);
  let pos = 0;

  result.set(header, pos);
  pos += header.byteLength;

  for (const obj of objects) {
    result.set(obj, pos);
    pos += obj.byteLength;
  }

  result.set(offsetTable, pos);
  pos += offsetTable.byteLength;

  result.set(trailer, pos);

  return result.buffer;
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
          bytes.length >= 8 &&
          bytes[0] === 0x62 &&
          bytes[1] === 0x70 &&
          bytes[2] === 0x6c &&
          bytes[3] === 0x69 &&
          bytes[4] === 0x73 &&
          bytes[5] === 0x74 &&
          bytes[6] === 0x30 &&
          bytes[7] === 0x30
        ) {
          data = await parseUnityPlist(input);
        } else {
          throw new Error("Unrecognized Unity PlayerPrefs format.");
        }
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
