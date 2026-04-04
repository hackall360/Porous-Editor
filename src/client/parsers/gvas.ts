// This Source Code Form is subject to the terms of the Mozilla Public
// License, v.2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * GVAS (Game Value And Save) Parser
 *
 * Parses Unreal Engine save files in GVAS format.
 * Handles compression (zlib, gzip) and property serialization.
 * Supports round-trip editing for standard uncompressed GVAS files.
 *
 * Based on research from:
 * - uesave-rs (Rust implementation)
 * - PalworldSaveEditor (JavaScript/WASM usage)
 * - Unreal Engine serialization documentation
 */

import { BaseParser, ParseResult, toUint8Array, safeDecode } from "./index";

// ====================== GVAS Constants ======================

const GVAS_MAGIC = new Uint8Array([0x47, 0x56, 0x41, 0x53]); // "GVAS"

// UE version strings that may follow the magic

// ====================== Type Definitions ======================

export interface GvasHeader {
  magic: string;

  version?: string;

  package: string | undefined;
}

export interface GvasProperty {
  name: string;
  type: string;
  value: unknown;
  arrayIndex?: number;
}

export interface GvasData {
  header: GvasHeader;
  properties: Record<string, GvasProperty>;
  unknownData?: Uint8Array;
}

// ====================== GVAS Parser Implementation ======================

export class GvasParser extends BaseParser<ArrayBuffer, GvasData> {
  readonly id = "gvas";
  readonly extensions = ["sav"];
  readonly magicBytes?: number[] = Array.from(GVAS_MAGIC);

  private maxDecompressedBytes = 64 * 1024 * 1024; // 64MB safety limit

  matchesHeader(bytes: Uint8Array): boolean {
    if (bytes.length < GVAS_MAGIC.length) return false;
    for (let i = 0; i < GVAS_MAGIC.length; i++) {
      if (bytes[i] !== GVAS_MAGIC[i]) return false;
    }
    return true;
  }

  protected async doParse(
    input: ArrayBuffer,
    fileName: string,
  ): Promise<ParseResult<GvasData>> {
    let bytes = toUint8Array(input);
    const originalSize = bytes.byteLength;
    let compression: "none" | "zlib" | "gzip" | "unknown" = "none";
    let wasDecompressed = false;

    try {
      // Check if file is compressed
      const compressionCheck = this.detectCompression(bytes);
      if (compressionCheck) {
        const decompressed = this.decompressWithLimit(bytes, compressionCheck);
        if (decompressed) {
          bytes = decompressed;
          compression = compressionCheck;
          wasDecompressed = true;
        }
      }

      // Verify GVAS header after decompression
      if (!this.matchesHeader(bytes)) {
        return {
          data: {
            header: { magic: "GVAS", package: undefined },
            properties: {},
          },
          roundTripSupport: "none",
          metadata: {
            extension: fileName.split(".").pop() || "sav",
            formatLabel: "Unreal GVAS",
            fileSize: originalSize,
            wasDecompressed,
            warnings: [
              `File does not have valid GVAS header after ${wasDecompressed ? compression + " " : ""}decompression`,
            ],
          },
        };
      }

      // Parse GVAS structure
      const result = this.parseGvas(bytes);

      return {
        data: result,
        roundTripSupport: this.getRoundTripSupport(compression, result),
        metadata: {
          extension: fileName.split(".").pop() || "sav",
          formatLabel: "Unreal GVAS",
          fileSize: originalSize,
          wasDecompressed,
          warnings: wasDecompressed ? [`Decompressed from ${compression}`] : [],
          ...(wasDecompressed && { compression }),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        data: {
          header: { magic: "GVAS", package: undefined },
          properties: {},
        },
        roundTripSupport: "none",
        metadata: {
          extension: fileName.split(".").pop() || "sav",
          formatLabel: "Unreal GVAS",
          fileSize: originalSize,
          wasDecompressed,
          warnings: [`Parse error: ${message}`],
        },
      };
    }
  }

  /**
   * Detect compression type from file header
   */
  private detectCompression(
    bytes: Uint8Array,
  ): "zlib" | "gzip" | "unknown" | null {
    if (bytes.length < 2) return null;

    // Gzip magic: 0x1f 0x8b
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      return "gzip";
    }

    // Zlib magic: CMF 0x08 + FLG (checksum)
    const cmf = bytes[0]!;
    const flg = bytes[1]!;
    if ((cmf & 0x0f) === 0x08) {
      const check = ((cmf << 8) + flg) % 31;
      if (check === 0) {
        return "zlib";
      }
    }

    // Raw deflate detection (heuristic)
    // If it starts with compressed data pattern but not gzip/zlib headers
    if (this.looksLikeDeflate(bytes)) {
      return "unknown";
    }

    return null;
  }

  /**
   * Heuristic to detect raw deflate streams
   */
  private looksLikeDeflate(bytes: Uint8Array): boolean {
    // Very basic heuristic: check for typical deflate block headers
    // This is not foolproof but works for many UE saves
    if (bytes.length < 2) return false;
    const firstByte = bytes[0]!;
    // Check for BFINAL (bit 0) and BTYPE (bits 1-2)
    // BTYPE values: 00=stored, 01=static, 10=dynamic, 11=reserved

    const btype = (firstByte >> 1) & 0x03;
    return btype !== 0x03; // Not reserved
  }

  /**
   * Decompress with safety limit
   */
  private decompressWithLimit(
    bytes: Uint8Array,
    kind: "zlib" | "gzip" | "unknown",
  ): Uint8Array | null {
    try {
      // Try pako first (if available)
      const pako =
        window.pako || (typeof require !== "undefined" && require("pako"));

      if (pako) {
        const inflated =
          kind === "gzip"
            ? pako.ungzip(bytes, { to: "string" })
            : kind === "zlib"
              ? pako.inflate(bytes, { to: "string" })
              : pako.inflateRaw(bytes, { to: "string" });

        if (typeof inflated === "string") {
          const encoded = new TextEncoder().encode(inflated);

          if (encoded.byteLength > this.maxDecompressedBytes) {
            throw new Error(
              `Decompressed size (${encoded.byteLength} bytes) exceeds limit`,
            );
          }

          return encoded;
        }

        if (inflated.byteLength > this.maxDecompressedBytes) {
          throw new Error(
            `Decompressed size (${inflated.byteLength} bytes) exceeds limit`,
          );
        }

        return inflated;
      }

      // Fallback: use browser's CompressionStream if available (modern browsers)
      if (kind === "gzip" && typeof CompressionStream !== "undefined") {
        // This is more complex to implement properly, skip for now
      }

      return null;
    } catch (error) {
      console.warn(`Decompression failed for ${kind}:`, error);
      return null;
    }
  }

  /**
   * Parse GVAS structure from bytes
   */
  private parseGvas(bytes: Uint8Array): GvasData {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    // Read magic
    const magic = safeDecode(bytes.slice(offset, offset + 4));
    if (magic !== "GVAS") {
      throw new Error(`Invalid GVAS magic: expected "GVAS", got "${magic}"`);
    }
    offset += 4;

    // Read version string (null-terminated)
    const versionEnd = bytes.indexOf(0, offset);
    if (versionEnd === -1)
      throw new Error("Invalid GVAS: no version string terminator");
    const version = safeDecode(bytes.slice(offset, versionEnd));
    offset = versionEnd + 1;

    // Read package name (null-terminated, optional)
    const packageEnd = bytes.indexOf(0, offset);
    const packageName =
      packageEnd !== -1
        ? safeDecode(bytes.slice(offset, packageEnd))
        : undefined;
    if (packageEnd !== -1) offset = packageEnd + 1;

    // Parse properties using proper offset tracking
    const properties: Record<string, GvasProperty> = {};
    let propertyCount = 0;

    try {
      while (offset < bytes.byteLength) {
        const result = this.parseProperty(view, offset);
        if (!result) break;

        const { value: prop, bytesRead } = result;
        properties[prop.name] = prop;
        offset += bytesRead;
        propertyCount++;

        // Safety limit on properties
        if (propertyCount > 10000) {
          console.warn("GVAS parse: property count exceeded safety limit");
          break;
        }
      }
    } catch (error) {
      console.warn("Error parsing GVAS properties:", error);
    }

    return {
      header: {
        magic: "GVAS",
        version,
        package: packageName || undefined,
      },
      properties,
      unknownData:
        offset < bytes.byteLength
          ? bytes.slice(offset)
          : (undefined as unknown as Uint8Array),
    };
  }

  /**
   * Parse a single property from the GVAS stream
   * Returns { value, bytesRead } for proper offset tracking
   */
  private parseProperty(
    view: DataView,
    offset: number,
  ): { value: GvasProperty; bytesRead: number } | null {
    let pos = offset;

    // Read property name length (int32 LE)
    const nameLength = view.getUint32(pos, true);
    if (nameLength === 0 || nameLength > 256) return null;
    pos += 4;

    // Read name
    const nameBytes = new Uint8Array(view.buffer, pos, nameLength);
    const name = safeDecode(nameBytes);
    pos += nameLength;

    // Read type length (int32 LE)
    const typeLength = view.getUint32(pos, true);
    if (typeLength === 0 || typeLength > 128) return null;
    pos += 4;

    // Read type
    const typeBytes = new Uint8Array(view.buffer, pos, typeLength);
    const type = safeDecode(typeBytes);
    pos += typeLength;

    // Read value size (int32 LE)
    const valueSize = view.getUint32(pos, true);
    pos += 4;

    // Parse value based on type
    let value: unknown;
    if (valueSize > 0) {
      const valueBytes = new Uint8Array(view.buffer, pos, valueSize);
      value = this.decodeValue(type, valueBytes, view, pos);
      pos += valueSize;
    } else {
      value = null;
    }

    return {
      value: { name, type, value },
      bytesRead: pos - offset,
    };
  }

  /**
   * Decode property value based on type
   */
  private decodeValue(
    type: string,
    bytes: Uint8Array,
    view: DataView,
    offset: number,
  ): unknown {
    const typeLower = type.toLowerCase();

    // Primitive types
    if (typeLower === "intproperty" || typeLower === "int32property") {
      return view.getInt32(offset, true);
    }

    if (typeLower === "int64property" || typeLower === "int64") {
      const low = view.getUint32(offset, true);
      const high = view.getUint32(offset + 4, true);
      return (BigInt(high) << BigInt(32)) | BigInt(low);
    }

    if (typeLower === "floatproperty") {
      return view.getFloat32(offset, true);
    }

    if (typeLower === "doubleproperty") {
      return view.getFloat64(offset, true);
    }

    if (typeLower === "boolproperty") {
      return view.getUint8(offset) !== 0;
    }

    if (typeLower === "byteproperty") {
      return view.getUint8(offset);
    }

    if (typeLower === "nameproperty") {
      // FName: index (int32) + number (int32)
      const index = view.getInt32(offset, true);
      const number = view.getInt32(offset + 4, true);
      return { _fNameIndex: index, _fNameNumber: number };
    }

    // String types
    if (typeLower === "strproperty" || typeLower === "textproperty") {
      const length = view.getInt32(offset, true);
      if (length > 0 && length < 100000) {
        // UE strings may have encoding flag
        const hasEncoding = length < 0;
        const strOffset = hasEncoding ? offset + 5 : offset + 4;
        const strBytes = new Uint8Array(
          view.buffer,
          strOffset,
          Math.abs(length) - (hasEncoding ? 1 : 0),
        );
        return safeDecode(strBytes);
      }
      return "";
    }

    // Array types
    if (typeLower === "arrayproperty") {
      return this.parseArrayProperty(view, offset, bytes.byteLength);
    }

    // Struct types
    if (typeLower === "structproperty") {
      return this.parseStructProperty(view, offset, bytes.byteLength);
    }

    // Map types
    if (typeLower === "mapproperty") {
      return this.parseMapProperty(view, offset, bytes.byteLength);
    }

    // Set types
    if (typeLower === "setproperty") {
      return this.parseSetProperty(view, offset, bytes.byteLength);
    }

    // Fallback: return raw bytes with metadata
    return {
      _type: "unknown",
      _rawSize: bytes.byteLength,
      _rawPreview: Array.from(bytes.slice(0, Math.min(32, bytes.byteLength))),
      _note: `Type '${type}' requires specialized parser`,
    };
  }

  /**
   * Parse array property
   */
  private parseArrayProperty(
    view: DataView,
    offset: number,
    size: number,
  ): unknown {
    // Array header: element type name length + element type name + element count
    let pos = offset;
    const elemTypeNameLen = view.getUint32(pos, true);
    pos += 4;
    const elemTypeName = safeDecode(
      new Uint8Array(view.buffer, pos, elemTypeNameLen),
    );
    pos += elemTypeNameLen;

    const elementCount = view.getInt32(pos, true);
    pos += 4;

    const elements: unknown[] = [];
    const elemSize = Math.max(
      0,
      (size - (pos - offset)) / Math.max(1, elementCount),
    );

    for (let i = 0; i < elementCount; i++) {
      const elemOffset = pos + Math.floor(i * elemSize);
      elements.push(this.decodeArrayElement(elemTypeName, view, elemOffset));
    }

    return { _type: "array", _elementType: elemTypeName, values: elements };
  }

  /**
   * Decode a single array element
   */
  private decodeArrayElement(
    typeName: string,
    view: DataView,
    offset: number,
  ): unknown {
    const typeLower = typeName.toLowerCase();
    if (typeLower.includes("int") || typeLower === "intproperty") {
      return view.getInt32(offset, true);
    }
    if (typeLower.includes("float")) {
      return view.getFloat32(offset, true);
    }
    if (typeLower.includes("bool")) {
      return view.getUint8(offset) !== 0;
    }
    if (typeLower.includes("byte")) {
      return view.getUint8(offset);
    }
    if (typeLower.includes("name")) {
      const index = view.getInt32(offset, true);
      const number = view.getInt32(offset + 4, true);
      return { _fNameIndex: index, _fNameNumber: number };
    }
    // For complex types, return raw preview
    return {
      _type: "array_element",
      _elementType: typeName,
      _raw: Array.from(
        new Uint8Array(
          view.buffer,
          offset,
          Math.min(16, view.byteLength - offset),
        ),
      ),
    };
  }

  /**
   * Parse struct property
   */
  private parseStructProperty(
    view: DataView,
    offset: number,
    size: number,
  ): unknown {
    // Struct header: struct type name + GUID (16 bytes) + data
    let pos = offset;
    const structTypeNameLen = view.getUint32(pos, true);
    pos += 4;
    const structTypeName = safeDecode(
      new Uint8Array(view.buffer, pos, structTypeNameLen),
    );
    pos += structTypeNameLen;

    // Skip GUID (16 bytes)
    pos += 16;

    // Remaining bytes are struct data
    const dataBytes = new Uint8Array(view.buffer, pos, size - (pos - offset));

    return {
      _type: "struct",
      _structType: structTypeName,
      _rawSize: dataBytes.byteLength,
      _rawPreview: Array.from(
        dataBytes.slice(0, Math.min(32, dataBytes.byteLength)),
      ),
    };
  }

  /**
   * Parse map property
   */
  private parseMapProperty(
    view: DataView,
    offset: number,
    size: number,
  ): unknown {
    let pos = offset;
    const keyTypeNameLen = view.getUint32(pos, true);
    pos += 4;
    const keyTypeName = safeDecode(
      new Uint8Array(view.buffer, pos, keyTypeNameLen),
    );
    pos += keyTypeNameLen;

    const valueTypeNameLen = view.getUint32(pos, true);
    pos += 4;
    const valueTypeName = safeDecode(
      new Uint8Array(view.buffer, pos, valueTypeNameLen),
    );
    pos += valueTypeNameLen;

    const elementCount = view.getInt32(pos, true);
    pos += 4;

    const entries: Array<{ key: unknown; value: unknown }> = [];
    const elemSize = Math.max(
      0,
      (size - (pos - offset)) / Math.max(1, elementCount),
    );

    for (let i = 0; i < elementCount; i++) {
      const elemOffset = pos + Math.floor(i * elemSize);
      entries.push({
        key: this.decodeArrayElement(keyTypeName, view, elemOffset),
        value: this.decodeArrayElement(
          valueTypeName,
          view,
          elemOffset + Math.floor(elemSize / 2),
        ),
      });
    }

    return {
      _type: "map",
      _keyType: keyTypeName,
      _valueType: valueTypeName,
      entries,
    };
  }

  /**
   * Parse set property
   */
  private parseSetProperty(
    view: DataView,
    offset: number,
    size: number,
  ): unknown {
    let pos = offset;
    const elemTypeNameLen = view.getUint32(pos, true);
    pos += 4;
    const elemTypeName = safeDecode(
      new Uint8Array(view.buffer, pos, elemTypeNameLen),
    );
    pos += elemTypeNameLen;

    const elementCount = view.getInt32(pos, true);
    pos += 4;

    const elements: unknown[] = [];
    const elemSize = Math.max(
      0,
      (size - (pos - offset)) / Math.max(1, elementCount),
    );

    for (let i = 0; i < elementCount; i++) {
      const elemOffset = pos + Math.floor(i * elemSize);
      elements.push(this.decodeArrayElement(elemTypeName, view, elemOffset));
    }

    return { _type: "set", _elementType: elemTypeName, values: elements };
  }

  // advanceToNextProperty removed - offset tracking is now handled by bytesRead return values

  /**
   * Determine round-trip support based on compression and file structure
   */
  private getRoundTripSupport(
    compression: string,
    result: GvasData,
  ): "stable" | "experimental" | "none" {
    if (
      compression !== "none" &&
      compression !== "zlib" &&
      compression !== "gzip"
    ) {
      return "none";
    }

    // Check if we have all properties parsed
    const propCount = Object.keys(result.properties).length;
    if (propCount === 0) {
      return "none";
    }

    // If compressed but we successfully decompressed, we can recompress
    if (compression !== "none") {
      return "experimental";
    }

    return "stable";
  }

  /**
   * Serialize GVAS data back to binary format
   */
  serialize(data: GvasData): ArrayBuffer {
    const { header, properties } = data;
    const encoder = new TextEncoder();

    // Build header bytes (matches parseGvas format)
    const headerBytes: Uint8Array[] = [];

    // Magic (4 bytes)
    headerBytes.push(encoder.encode(header.magic || "GVAS"));

    // Version (null-terminated string)
    if (header.version) {
      headerBytes.push(encoder.encode(header.version));
    }
    headerBytes.push(new Uint8Array([0]));

    // Package (null-terminated string, optional)
    if (header.package) {
      headerBytes.push(encoder.encode(header.package));
    }
    headerBytes.push(new Uint8Array([0]));

    // Build property bytes (matches parseProperty format)
    const propBytes: Uint8Array[] = [];
    for (const prop of Object.values(properties)) {
      const nameBytes = encoder.encode(prop.name);
      const typeBytes = encoder.encode(prop.type);

      // Name length (int32 LE) + name bytes
      const nameLenBuf = new Uint8Array(4);
      new DataView(nameLenBuf.buffer).setUint32(0, nameBytes.byteLength, true);
      propBytes.push(nameLenBuf);
      propBytes.push(nameBytes);

      // Type length (int32 LE) + type bytes
      const typeLenBuf = new Uint8Array(4);
      new DataView(typeLenBuf.buffer).setUint32(0, typeBytes.byteLength, true);
      propBytes.push(typeLenBuf);
      propBytes.push(typeBytes);

      // Encode value based on type
      const valueBytes = this.encodeValue(prop.type, prop.value);

      // Value size (int32 LE) + value bytes
      const valueSizeBuf = new Uint8Array(4);
      new DataView(valueSizeBuf.buffer).setUint32(
        0,
        valueBytes.byteLength,
        true,
      );
      propBytes.push(valueSizeBuf);
      propBytes.push(valueBytes);
    }

    // Combine all parts into final buffer
    const allParts = [...headerBytes, ...propBytes];
    const totalSize = allParts.reduce((sum, arr) => sum + arr.byteLength, 0);
    const result = new Uint8Array(totalSize);

    let offset = 0;
    for (const part of allParts) {
      result.set(part, offset);
      offset += part.byteLength;
    }

    return result.buffer;
  }

  /**
   * Encode a property value based on its UE type
   * Mirrors decodeValue logic in reverse
   */
  private encodeValue(type: string, value: unknown): Uint8Array {
    const typeLower = type.toLowerCase();

    // Complex types with raw bytes - write them back directly
    if (typeof value === "object" && value !== null && "_raw" in value) {
      const raw = (value as { _raw: number[] | Uint8Array })._raw;
      return new Uint8Array(raw);
    }

    // IntProperty / Int32Property (4 bytes LE)
    if (typeLower === "intproperty" || typeLower === "int32property") {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setInt32(0, value as number, true);
      return buf;
    }

    // Int64Property (8 bytes LE)
    if (typeLower === "int64property" || typeLower === "int64") {
      const buf = new Uint8Array(8);
      const view = new DataView(buf.buffer);
      const bigVal =
        typeof value === "bigint" ? value : BigInt(value as number | bigint);
      view.setUint32(0, Number(bigVal & 0xffffffffn), true);
      view.setUint32(4, Number((bigVal >> 32n) & 0xffffffffn), true);
      return buf;
    }

    // FloatProperty (4 bytes LE)
    if (typeLower === "floatproperty") {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setFloat32(0, value as number, true);
      return buf;
    }

    // DoubleProperty (8 bytes LE)
    if (typeLower === "doubleproperty") {
      const buf = new Uint8Array(8);
      new DataView(buf.buffer).setFloat64(0, value as number, true);
      return buf;
    }

    // BoolProperty (1 byte)
    if (typeLower === "boolproperty") {
      const buf = new Uint8Array(1);
      buf[0] = value ? 1 : 0;
      return buf;
    }

    // ByteProperty (1 byte)
    if (typeLower === "byteproperty") {
      const buf = new Uint8Array(1);
      buf[0] = value as number;
      return buf;
    }

    // NameProperty (index: int32 LE + number: int32 LE)
    if (typeLower === "nameproperty") {
      const buf = new Uint8Array(8);
      const view = new DataView(buf.buffer);
      const nameObj = value as {
        _fNameIndex?: number;
        _fNameNumber?: number;
      };
      view.setInt32(0, nameObj._fNameIndex ?? 0, true);
      view.setInt32(4, nameObj._fNameNumber ?? 0, true);
      return buf;
    }

    // StrProperty / TextProperty (length: int32 LE + UTF-8 bytes + null terminator)
    if (typeLower === "strproperty" || typeLower === "textproperty") {
      const str = String(value ?? "");
      const strBytes = new TextEncoder().encode(str);
      // Length includes null terminator
      const buf = new Uint8Array(4 + strBytes.byteLength + 1);
      const view = new DataView(buf.buffer);
      view.setInt32(0, strBytes.byteLength + 1, true);
      buf.set(strBytes, 4);
      buf[buf.byteLength - 1] = 0; // null terminator
      return buf;
    }

    // Fallback: empty bytes for unknown types
    return new Uint8Array(0);
  }
}

// ====================== Factory Function ======================

/**
 * Create a GVAS parser instance
 */
export function createGvasParser(): GvasParser {
  return new GvasParser();
}
