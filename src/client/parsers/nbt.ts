// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * NBT (Named Binary Tag) Parser
 *
 * Parses Minecraft NBT (Named Binary Tag) format files.
 * Supports both Java Edition (big-endian) and Bedrock (little-endian) formats.
 * Handles gzip compression automatically.
 *
 * Based on research from:
 * - nbt-js (sjmulder)
 * - prismarine-nbt (PrismarineJS)
 * - Minecraft NBT specification: http://wiki.vg/NBT
 */

import { BaseParser, ParseResult, safeDecode } from "./index";

// ====================== NBT Tag Types ======================

/**
 * NBT tag type identifiers
 */
const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_LONG = 4;
const TAG_FLOAT = 5;
const TAG_DOUBLE = 6;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;
const TAG_LONG_ARRAY = 12;

// ====================== NBT Parser Implementation ======================

export class NBTParser extends BaseParser<ArrayBuffer, NbtData> {
  readonly id = "nbt";
  readonly extensions = ["nbt", "mca", "mcr"];
  readonly magicBytes?: number[] = undefined; // NBT has no fixed magic bytes

  private format: "big" | "little" | "littleVarint";
  private decompress: boolean;

  constructor(
    format: "big" | "little" | "littleVarint" = "big",
    decompress: boolean = true,
  ) {
    super();
    this.format = format;
    this.decompress = decompress;
  }

  matchesHeader(bytes: Uint8Array): boolean {
    // NBT doesn't have a magic number, but we can check for valid tag types
    // The first byte should be a valid tag type (0-12, though 0 is only for end)
    if (bytes.length === 0) return false;
    const firstByte = bytes[0]!;
    return firstByte >= 1 && firstByte <= 12;
  }

  protected async doParse(
    input: ArrayBuffer,
    fileName: string,
  ): Promise<ParseResult<NbtData>> {
    let data: Uint8Array = new Uint8Array(input);

    // Try to decompress if it looks compressed
    let wasDecompressed = false;
    if (this.decompress) {
      const decompressionCheck = this.tryDecompress(data);
      if (decompressionCheck) {
        data = decompressionCheck;
        wasDecompressed = true;
      }
    }

    try {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const format = this.format === "littleVarint" ? "little" : this.format;
      const { value: result } = this.parseTag(view, 0, format);

      return {
        data: result,
        roundTripSupport: "stable",
        metadata: {
          extension: fileName.split(".").pop() || "nbt",
          formatLabel: "NBT (Minecraft)",
          wasDecompressed,
          fileSize: input.byteLength,
          warnings: wasDecompressed
            ? ["File was compressed and decompressed"]
            : [],
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        data: { type: "error", name: "error", value: message },
        roundTripSupport: "none",
        metadata: {
          extension: fileName.split(".").pop() || "nbt",
          formatLabel: "NBT (Minecraft)",
          wasDecompressed,
          fileSize: input.byteLength,
          warnings: [`Parse error: ${message}`],
        },
      };
    }
  }

  /**
   * Try to decompress gzip or zlib data
   */
  private tryDecompress(data: Uint8Array): Uint8Array | null {
    // Check for gzip magic bytes (0x1f 0x8b)
    if (data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b) {
      // Use pako if available, otherwise return null
      try {
        const pako =
          window.pako || (typeof require !== "undefined" && require("pako"));
        if (pako) {
          const inflated = pako.ungzip(data, { to: "string" });
          if (typeof inflated === "string") {
            const encoded = new TextEncoder().encode(inflated);
            return new Uint8Array(encoded.buffer as ArrayBuffer);
          }
          return inflated;
        }
      } catch {
        // pako not available or decompression failed
      }
    }

    // Check for zlib (not gzip)
    if (data.length >= 2) {
      try {
        const pako =
          window.pako || (typeof require !== "undefined" && require("pako"));
        if (pako) {
          const inflated = pako.inflate(data, { to: "string" });
          if (typeof inflated === "string") {
            const encoded = new TextEncoder().encode(inflated);
            return new Uint8Array(encoded.buffer as ArrayBuffer);
          }
          return inflated;
        }
      } catch {
        // Not zlib or pako not available
      }
    }

    return null;
  }

  /**
   * Parse a single NBT tag and return its value plus bytes consumed
   */
  private parseTag(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): { value: NbtData; bytesRead: number } {
    const tagType = view.getUint8(offset);
    let pos = offset + 1;

    if (tagType === TAG_END) {
      throw new Error("Unexpected TAG_END at root level");
    }

    // Read name (string)
    const nameLength = this.readShort(view, pos, format);
    pos += 2;
    const name = this.readNbtString(view, pos, nameLength);
    pos += nameLength;

    // Parse payload based on tag type
    const { value, bytesRead } = this.parseTagPayload(
      view,
      pos,
      tagType,
      format,
    );
    pos += bytesRead;

    return {
      value: {
        type: this.tagTypeToString(tagType),
        name,
        value,
      },
      bytesRead: pos - offset,
    };
  }

  /**
   * Parse a tag's payload based on its type, returning value and bytes consumed
   */
  private parseTagPayload(
    view: DataView,
    offset: number,
    tagType: number,
    format: "big" | "little",
  ): { value: NbtValue; bytesRead: number } {
    switch (tagType) {
      case TAG_BYTE:
        return { value: view.getInt8(offset), bytesRead: 1 };

      case TAG_SHORT:
        return { value: this.readShort(view, offset, format), bytesRead: 2 };

      case TAG_INT:
        return { value: this.readInt(view, offset, format), bytesRead: 4 };

      case TAG_LONG:
        return { value: this.readLong(view, offset, format), bytesRead: 8 };

      case TAG_FLOAT:
        return {
          value: view.getFloat32(offset, format === "big" ? false : true),
          bytesRead: 4,
        };

      case TAG_DOUBLE:
        return {
          value: view.getFloat64(offset, format === "big" ? false : true),
          bytesRead: 8,
        };

      case TAG_BYTE_ARRAY:
        return this.parseByteArray(view, offset, format);

      case TAG_STRING:
        return this.parseString(view, offset, format);

      case TAG_LIST:
        return this.parseList(view, offset, format);

      case TAG_COMPOUND:
        return this.parseCompound(view, offset, format);

      case TAG_INT_ARRAY:
        return this.parseIntArray(view, offset, format);

      case TAG_LONG_ARRAY:
        return this.parseLongArray(view, offset, format);

      default:
        throw new Error(`Unknown NBT tag type: ${tagType}`);
    }
  }

  private readShort(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): number {
    return format === "big"
      ? view.getInt16(offset, false)
      : view.getInt16(offset, true);
  }

  private readInt(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): number {
    return format === "big"
      ? view.getInt32(offset, false)
      : view.getInt32(offset, true);
  }

  private readLong(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): bigint {
    const low =
      format === "big"
        ? view.getUint32(offset, false)
        : view.getUint32(offset, true);
    const high =
      format === "big"
        ? view.getUint32(offset + 4, false)
        : view.getUint32(offset + 4, true);
    return (BigInt(high) << BigInt(32)) | BigInt(low);
  }

  /**
   * Read an NBT string given its length
   */
  private readNbtString(
    view: DataView,
    offset: number,
    length: number,
  ): string {
    const bytes = new Uint8Array(view.buffer, offset, length);
    return safeDecode(bytes);
  }

  private parseString(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): { value: string; bytesRead: number } {
    const length = this.readShort(view, offset, format);
    const bytes = new Uint8Array(view.buffer, offset + 2, length);
    return { value: safeDecode(bytes), bytesRead: 2 + length };
  }

  private parseByteArray(
    view: DataView,
    offset: number,
    _format: "big" | "little",
  ): { value: number[]; bytesRead: number } {
    const length = this.readInt(view, offset, _format);
    const result: number[] = [];
    for (let i = 0; i < length; i++) {
      result.push(view.getInt8(offset + 4 + i));
    }
    return { value: result, bytesRead: 4 + length };
  }

  private parseIntArray(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): { value: number[]; bytesRead: number } {
    const length = this.readInt(view, offset, format);
    const result: number[] = [];
    for (let i = 0; i < length; i++) {
      result.push(this.readInt(view, offset + 4 + i * 4, format));
    }
    return { value: result, bytesRead: 4 + length * 4 };
  }

  private parseLongArray(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): { value: bigint[]; bytesRead: number } {
    const length = this.readInt(view, offset, format);
    const result: bigint[] = [];
    for (let i = 0; i < length; i++) {
      result.push(this.readLong(view, offset + 4 + i * 8, format));
    }
    return { value: result, bytesRead: 4 + length * 8 };
  }

  private parseList(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): { value: NbtList; bytesRead: number } {
    const tagType = view.getUint8(offset);
    let pos = offset + 1;
    const length = this.readInt(view, pos, format);
    pos += 4;

    const items: NbtValue[] = [];
    for (let i = 0; i < length; i++) {
      const { value, bytesRead } = this.parseTagPayload(
        view,
        pos,
        tagType,
        format,
      );
      items.push(value);
      pos += bytesRead;
    }

    return {
      value: {
        type: this.tagTypeToString(tagType),
        values: items,
      },
      bytesRead: pos - offset,
    };
  }

  private parseCompound(
    view: DataView,
    offset: number,
    format: "big" | "little",
  ): { value: NbtCompound; bytesRead: number } {
    const entries: NbtData[] = [];
    let pos = offset;

    while (true) {
      const tagType = view.getUint8(pos);
      if (tagType === TAG_END) {
        pos += 1;
        break;
      }

      const nameLength = this.readShort(view, pos + 1, format);
      const name = this.readNbtString(view, pos + 3, nameLength);
      const payloadOffset = pos + 3 + nameLength;
      const { value, bytesRead } = this.parseTagPayload(
        view,
        payloadOffset,
        tagType,
        format,
      );

      entries.push({
        type: this.tagTypeToString(tagType),
        name,
        value,
      });

      pos = payloadOffset + bytesRead;
    }

    return {
      value: { type: "compound", entries },
      bytesRead: pos - offset,
    };
  }

  // parseTagValue removed - use parseTagPayload directly which now returns { value, bytesRead }
  // advanceOffset removed - offset tracking is now handled by bytesRead return values

  private tagTypeToString(tagType: number): string {
    const types: Record<number, string> = {
      [TAG_END]: "end",
      [TAG_BYTE]: "byte",
      [TAG_SHORT]: "short",
      [TAG_INT]: "int",
      [TAG_LONG]: "long",
      [TAG_FLOAT]: "float",
      [TAG_DOUBLE]: "double",
      [TAG_BYTE_ARRAY]: "byte-array",
      [TAG_STRING]: "string",
      [TAG_LIST]: "list",
      [TAG_COMPOUND]: "compound",
      [TAG_INT_ARRAY]: "int-array",
      [TAG_LONG_ARRAY]: "long-array",
    };
    return types[tagType] || `unknown-${tagType}`;
  }
}

// ====================== NBT Data Types ======================

export type NbtValue =
  | number
  | bigint
  | string
  | boolean
  | NbtList
  | NbtCompound
  | number[] // byte-array, int-array
  | bigint[]; // long-array

export interface NbtList {
  type: string;
  values: NbtValue[];
}

export interface NbtCompound {
  type: "compound";
  entries: NbtData[];
}

export interface NbtData {
  type: string;
  name: string;
  value: NbtValue;
}

// ====================== Serialization ======================

/**
 * Serialize NBT data back to binary format
 * This is a simplified implementation - full serialization would require
 * tracking original format details and proper byte ordering
 */
export function serializeNbt(
  data: NbtData,
  format: "big" | "little" = "big",
): ArrayBuffer {
  const parts: Uint8Array[] = [];
  serializeTag(data, format, parts);
  const totalSize = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result.buffer;
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function writeShort(value: number, format: "big" | "little"): Uint8Array {
  const buf = new ArrayBuffer(2);
  const view = new DataView(buf);
  view.setInt16(0, value, format !== "big");
  return new Uint8Array(buf);
}

function writeInt(value: number, format: "big" | "little"): Uint8Array {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setInt32(0, value, format !== "big");
  return new Uint8Array(buf);
}

function writeLong(value: bigint, format: "big" | "little"): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const low = Number(value & BigInt(0xffffffff));
  const high = Number((value >> BigInt(32)) & BigInt(0xffffffff));
  if (format === "big") {
    view.setUint32(0, high);
    view.setUint32(4, low >>> 0);
  } else {
    view.setUint32(0, low >>> 0, true);
    view.setUint32(4, high, true);
  }
  return new Uint8Array(buf);
}

function tagTypeToByte(type: string): number {
  const map: Record<string, number> = {
    end: 0,
    byte: 1,
    short: 2,
    int: 3,
    long: 4,
    float: 5,
    double: 6,
    "byte-array": 7,
    string: 8,
    list: 9,
    compound: 10,
    "int-array": 11,
    "long-array": 12,
  };
  return map[type] ?? 0;
}

function serializeTag(
  data: NbtData,
  format: "big" | "little",
  parts: Uint8Array[],
): void {
  const tagType = tagTypeToByte(data.type);
  parts.push(new Uint8Array([tagType]));
  const nameBytes = stringToBytes(data.name);
  parts.push(writeShort(nameBytes.byteLength, format));
  parts.push(nameBytes);
  serializeTagPayload(data.type, data.value, format, parts);
}

function serializeTagPayload(
  type: string,
  value: NbtValue,
  format: "big" | "little",
  parts: Uint8Array[],
): void {
  switch (type) {
    case "byte":
      parts.push(new Uint8Array([value as number]));
      break;

    case "short":
      parts.push(writeShort(value as number, format));
      break;

    case "int":
      parts.push(writeInt(value as number, format));
      break;

    case "long":
      parts.push(writeLong(value as bigint, format));
      break;

    case "float": {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, value as number, format !== "big");
      parts.push(new Uint8Array(buf));
      break;
    }

    case "double": {
      const buf = new ArrayBuffer(8);
      new DataView(buf).setFloat64(0, value as number, format !== "big");
      parts.push(new Uint8Array(buf));
      break;
    }

    case "string": {
      const strBytes = stringToBytes(value as string);
      parts.push(writeShort(strBytes.byteLength, format));
      parts.push(strBytes);
      break;
    }

    case "byte-array": {
      const arr = value as number[];
      parts.push(writeInt(arr.length, format));
      parts.push(new Uint8Array(arr));
      break;
    }

    case "int-array": {
      const arr = value as number[];
      parts.push(writeInt(arr.length, format));
      for (const v of arr) {
        parts.push(writeInt(v, format));
      }
      break;
    }

    case "long-array": {
      const arr = value as bigint[];
      parts.push(writeInt(arr.length, format));
      for (const v of arr) {
        parts.push(writeLong(v, format));
      }
      break;
    }

    case "list": {
      const list = value as NbtList;
      const elemType = tagTypeToByte(list.type);
      parts.push(new Uint8Array([elemType]));
      parts.push(writeInt(list.values.length, format));
      for (const elem of list.values) {
        serializeListElement(list.type, elem, format, parts);
      }
      break;
    }

    case "compound": {
      const compound = value as NbtCompound;
      for (const entry of compound.entries) {
        serializeTag(entry, format, parts);
      }
      parts.push(new Uint8Array([TAG_END]));
      break;
    }

    default:
      throw new Error(`Cannot serialize unknown NBT type: ${type}`);
  }
}

function serializeListElement(
  type: string,
  value: NbtValue,
  format: "big" | "little",
  parts: Uint8Array[],
): void {
  // List elements don't have name/type headers, just raw payload
  switch (type) {
    case "byte":
      parts.push(new Uint8Array([value as number]));
      break;
    case "short":
      parts.push(writeShort(value as number, format));
      break;
    case "int":
      parts.push(writeInt(value as number, format));
      break;
    case "long":
      parts.push(writeLong(value as bigint, format));
      break;
    case "float": {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, value as number, format !== "big");
      parts.push(new Uint8Array(buf));
      break;
    }
    case "double": {
      const buf = new ArrayBuffer(8);
      new DataView(buf).setFloat64(0, value as number, format !== "big");
      parts.push(new Uint8Array(buf));
      break;
    }
    case "string": {
      const strBytes = stringToBytes(value as string);
      parts.push(writeShort(strBytes.byteLength, format));
      parts.push(strBytes);
      break;
    }
    case "compound": {
      const compound = value as NbtCompound;
      for (const entry of compound.entries) {
        serializeTag(entry, format, parts);
      }
      parts.push(new Uint8Array([TAG_END]));
      break;
    }
    case "list": {
      // Nested lists - serialize as compound-like structure
      const list = value as NbtList;
      const elemType = tagTypeToByte(list.type);
      parts.push(new Uint8Array([elemType]));
      parts.push(writeInt(list.values.length, format));
      for (const elem of list.values) {
        serializeListElement(list.type, elem, format, parts);
      }
      break;
    }
    default:
      throw new Error(`Cannot serialize list element of type: ${type}`);
  }
}

// ====================== Utility Functions ======================

/**
 * Convert NBT data to a simplified JSON-like structure
 * Removes type tags and makes the data more accessible
 */
export function simplifyNbt(data: NbtData | null): unknown {
  if (!data) return null;

  const { type, name: _name, value } = data;
  void _name;

  if (type === "compound") {
    const result: Record<string, unknown> = {};
    for (const entry of (value as NbtCompound).entries) {
      result[entry.name] = simplifyNbt(entry);
    }
    return result;
  }

  if (type === "list") {
    const list = value as NbtList;
    return list.values.map((v) => simplifyNbtValue(v));
  }

  return simplifyNbtValue(value);
}

function simplifyNbtValue(value: NbtValue): unknown {
  if (
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => simplifyNbtValue(v));
  }
  if (value && typeof value === "object" && "type" in value) {
    if (value.type === "compound") {
      const result: Record<string, unknown> = {};
      for (const entry of (value as NbtCompound).entries) {
        result[entry.name] = simplifyNbt(entry);
      }
      return result;
    }
    if (value.type === "list") {
      return (value as NbtList).values.map((v) => simplifyNbtValue(v));
    }
  }
  return value;
}

// ====================== Factory Function ======================

/**
 * Create an NBT parser instance
 */
export function createNbtParser(): NBTParser {
  return new NBTParser("big", true);
}
