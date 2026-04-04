// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Minecraft NBT (Named Binary Tag) Parser
 *
 * Supports both Java Edition (big-endian) and Bedrock Edition (little-endian) formats.
 * Handles all 13 NBT tag types with full round-trip serialization support.
 *
 * Based on the NBT specification: https://wiki.vg/NBT
 */

import { BaseParser, type ParseResult } from "./index";

// ====================== NBT Tag Type Constants ======================

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

// ====================== NBT Data Type Definitions ======================

export interface NbtByte {
  type: "byte";
  name: string;
  value: number;
}
export interface NbtShort {
  type: "short";
  name: string;
  value: number;
}
export interface NbtInt {
  type: "int";
  name: string;
  value: number;
}
export interface NbtLong {
  type: "long";
  name: string;
  value: bigint;
}
export interface NbtFloat {
  type: "float";
  name: string;
  value: number;
}
export interface NbtDouble {
  type: "double";
  name: string;
  value: number;
}
export interface NbtByteArray {
  type: "byte-array";
  name: string;
  value: number[];
}
export interface NbtString {
  type: "string";
  name: string;
  value: string;
}
export interface NbtList {
  type: "list";
  name: string;
  value: { type: string; values: NbtValue[] };
}
export interface NbtCompound {
  type: "compound";
  name: string;
  value: { type: "compound"; entries: NbtValue[] };
}
export interface NbtIntArray {
  type: "int-array";
  name: string;
  value: number[];
}
export interface NbtLongArray {
  type: "long-array";
  name: string;
  value: bigint[];
}

export type NbtValue =
  | NbtByte
  | NbtShort
  | NbtInt
  | NbtLong
  | NbtFloat
  | NbtDouble
  | NbtByteArray
  | NbtString
  | NbtList
  | NbtCompound
  | NbtIntArray
  | NbtLongArray;

// ====================== Type Helpers ======================

function tagTypeToString(type: number): string {
  switch (type) {
    case TAG_END:
      return "end";
    case TAG_BYTE:
      return "byte";
    case TAG_SHORT:
      return "short";
    case TAG_INT:
      return "int";
    case TAG_LONG:
      return "long";
    case TAG_FLOAT:
      return "float";
    case TAG_DOUBLE:
      return "double";
    case TAG_BYTE_ARRAY:
      return "byte-array";
    case TAG_STRING:
      return "string";
    case TAG_LIST:
      return "list";
    case TAG_COMPOUND:
      return "compound";
    case TAG_INT_ARRAY:
      return "int-array";
    case TAG_LONG_ARRAY:
      return "long-array";
    default:
      return `unknown(${type})`;
  }
}

function stringToTagType(type: string): number {
  switch (type) {
    case "end":
      return TAG_END;
    case "byte":
      return TAG_BYTE;
    case "short":
      return TAG_SHORT;
    case "int":
      return TAG_INT;
    case "long":
      return TAG_LONG;
    case "float":
      return TAG_FLOAT;
    case "double":
      return TAG_DOUBLE;
    case "byte-array":
    case "byteArray":
      return TAG_BYTE_ARRAY;
    case "string":
      return TAG_STRING;
    case "list":
      return TAG_LIST;
    case "compound":
      return TAG_COMPOUND;
    case "int-array":
    case "intArray":
      return TAG_INT_ARRAY;
    case "long-array":
    case "longArray":
      return TAG_LONG_ARRAY;
    default:
      throw new Error(`Unknown NBT tag type: ${type}`);
  }
}

// ====================== NBT Binary Reader ======================

class NbtReader {
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;

  constructor(buffer: ArrayBuffer, littleEndian: boolean = false) {
    this.view = new DataView(buffer);
    this.offset = 0;
    this.littleEndian = littleEndian;
  }

  readByte(): number {
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUnsignedByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readShort(): number {
    const value = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  readInt(): number {
    const value = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readLong(): bigint {
    const high = BigInt(this.view.getInt32(this.offset, this.littleEndian));
    const low = BigInt(this.view.getUint32(this.offset + 4, this.littleEndian));
    this.offset += 8;
    return this.littleEndian ? (low << 32n) | high : (high << 32n) | low;
  }

  readFloat(): number {
    const value = this.view.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }

  readDouble(): number {
    const value = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }

  readString(): string {
    const length = this.readShort();
    if (length < 0) {
      throw new Error("Invalid string length in NBT data");
    }
    const bytes = new Uint8Array(this.view.buffer, this.offset, length);
    this.offset += length;
    return new TextDecoder("utf-8").decode(bytes);
  }

  readByteArray(): number[] {
    const length = this.readInt();
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push(this.readByte());
    }
    return bytes;
  }

  readIntArray(): number[] {
    const length = this.readInt();
    const ints: number[] = [];
    for (let i = 0; i < length; i++) {
      ints.push(this.readInt());
    }
    return ints;
  }

  readLongArray(): bigint[] {
    const length = this.readInt();
    const longs: bigint[] = [];
    for (let i = 0; i < length; i++) {
      longs.push(this.readLong());
    }
    return longs;
  }

  readTag(name: string = ""): NbtValue {
    const type = this.readUnsignedByte();
    return this.readTagPayload(type, name);
  }

  readTagPayload(type: number, name: string): NbtValue {
    switch (type) {
      case TAG_BYTE:
        return { type: "byte", name, value: this.readByte() };
      case TAG_SHORT:
        return { type: "short", name, value: this.readShort() };
      case TAG_INT:
        return { type: "int", name, value: this.readInt() };
      case TAG_LONG:
        return { type: "long", name, value: this.readLong() };
      case TAG_FLOAT:
        return { type: "float", name, value: this.readFloat() };
      case TAG_DOUBLE:
        return { type: "double", name, value: this.readDouble() };
      case TAG_BYTE_ARRAY:
        return { type: "byte-array", name, value: this.readByteArray() };
      case TAG_STRING:
        return { type: "string", name, value: this.readString() };
      case TAG_LIST: {
        const elementType = this.readUnsignedByte();
        const length = this.readInt();
        const elements: NbtValue[] = [];
        const elementTypeName = tagTypeToString(elementType);
        for (let i = 0; i < length; i++) {
          elements.push(this.readTagPayload(elementType, ""));
        }
        return {
          type: "list",
          name,
          value: { type: elementTypeName, values: elements },
        };
      }
      case TAG_COMPOUND: {
        const entries: NbtValue[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const entryType = this.readUnsignedByte();
          if (entryType === TAG_END) break;
          const entryName = this.readString();
          entries.push(this.readTagPayload(entryType, entryName));
        }
        return {
          type: "compound",
          name,
          value: { type: "compound", entries },
        };
      }
      case TAG_INT_ARRAY:
        return { type: "int-array", name, value: this.readIntArray() };
      case TAG_LONG_ARRAY:
        return { type: "long-array", name, value: this.readLongArray() };
      default:
        throw new Error(`Unknown NBT tag type: ${type}`);
    }
  }
}

// ====================== NBT Binary Writer ======================

class NbtWriter {
  private parts: Uint8Array[] = [];
  private littleEndian: boolean;

  constructor(littleEndian: boolean = false) {
    this.littleEndian = littleEndian;
  }

  writeByte(value: number): void {
    const buf = new Uint8Array(1);
    new DataView(buf.buffer).setInt8(0, value);
    this.parts.push(buf);
  }

  writeShort(value: number): void {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setInt16(0, value, this.littleEndian);
    this.parts.push(buf);
  }

  writeInt(value: number): void {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setInt32(0, value, this.littleEndian);
    this.parts.push(buf);
  }

  writeLong(value: bigint): void {
    const buf = new Uint8Array(8);
    const view = new DataView(buf.buffer);
    if (this.littleEndian) {
      view.setInt32(0, Number(value & 0xffffffffn), true);
      view.setInt32(4, Number((value >> 32n) & 0xffffffffn), true);
    } else {
      view.setInt32(0, Number((value >> 32n) & 0xffffffffn), false);
      view.setInt32(4, Number(value & 0xffffffffn), false);
    }
    this.parts.push(buf);
  }

  writeFloat(value: number): void {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setFloat32(0, value, this.littleEndian);
    this.parts.push(buf);
  }

  writeDouble(value: number): void {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setFloat64(0, value, this.littleEndian);
    this.parts.push(buf);
  }

  writeString(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.writeShort(encoded.length);
    this.parts.push(encoded);
  }

  writeRawBytes(bytes: Uint8Array): void {
    this.parts.push(bytes);
  }

  writeTag(tag: NbtValue): void {
    this.writeByte(stringToTagType(tag.type));
    this.writeTagPayload(tag);
  }

  writeTagPayload(tag: NbtValue): void {
    switch (tag.type) {
      case "byte":
        this.writeByte(tag.value);
        break;
      case "short":
        this.writeShort(tag.value);
        break;
      case "int":
        this.writeInt(tag.value);
        break;
      case "long":
        this.writeLong(tag.value);
        break;
      case "float":
        this.writeFloat(tag.value);
        break;
      case "double":
        this.writeDouble(tag.value);
        break;
      case "byte-array": {
        this.writeInt(tag.value.length);
        for (const byte of tag.value) {
          this.writeByte(byte);
        }
        break;
      }
      case "string":
        this.writeString(tag.value);
        break;
      case "list": {
        this.writeByte(stringToTagType(tag.value.type));
        this.writeInt(tag.value.values.length);
        for (const element of tag.value.values) {
          this.writeTagPayload(element);
        }
        break;
      }
      case "compound": {
        for (const entry of tag.value.entries) {
          this.writeByte(stringToTagType(entry.type));
          this.writeString(entry.name);
          this.writeTagPayload(entry);
        }
        this.writeByte(TAG_END);
        break;
      }
      case "int-array": {
        this.writeInt(tag.value.length);
        for (const int of tag.value) {
          this.writeInt(int);
        }
        break;
      }
      case "long-array": {
        this.writeInt(tag.value.length);
        for (const long of tag.value) {
          this.writeLong(long);
        }
        break;
      }
    }
  }

  toBuffer(): ArrayBuffer {
    const totalLength = this.parts.reduce(
      (sum, part) => sum + part.byteLength,
      0,
    );
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.byteLength;
    }
    return result.buffer;
  }
}

// ====================== NBT Parser Class ======================

export class NBTParser extends BaseParser<ArrayBuffer, NbtCompound> {
  readonly id = "nbt";
  readonly extensions = ["nbt", "dat", "mca", "mcr"];
  readonly magicBytes?: number[] = undefined;

  private format: "big" | "little" = "big";
  private decompress: boolean = true;

  constructor(format: "big" | "little" = "big", decompress: boolean = true) {
    super();
    this.format = format;
    this.decompress = decompress;
  }

  matchesHeader(bytes: Uint8Array): boolean {
    if (bytes.length < 3) return false;
    const firstByte = bytes[0];
    return firstByte === TAG_COMPOUND;
  }

  protected async doParse(
    input: ArrayBuffer,
    fileName: string,
  ): Promise<ParseResult<NbtCompound>> {
    try {
      let buffer = input;
      let wasDecompressed = false;

      if (this.decompress) {
        const bytes = new Uint8Array(input);
        if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
          try {
            if (
              typeof window !== "undefined" &&
              (window as unknown as Record<string, unknown>)["pako"]
            ) {
              const pako = (window as unknown as Record<string, unknown>)[
                "pako"
              ] as {
                inflate: (data: ArrayBuffer) => Uint8Array;
              };
              buffer = pako.inflate(input).buffer as ArrayBuffer;
            } else if (typeof DecompressionStream !== "undefined") {
              const stream = new Response(input).body;
              if (stream) {
                const decompressedStream = stream.pipeThrough(
                  new DecompressionStream("gzip"),
                );
                const decompressedBuffer = await new Response(
                  decompressedStream,
                ).arrayBuffer();
                buffer = decompressedBuffer;
              }
            }
            wasDecompressed = true;
          } catch (decompressError) {
            const message =
              decompressError instanceof Error
                ? decompressError.message
                : String(decompressError);
            console.warn(
              `Failed to decompress NBT file: ${message}. Attempting to parse as raw data.`,
            );
          }
        }
      }

      const isLittleEndian = this.format === "little";
      const reader = new NbtReader(buffer, isLittleEndian);

      const rootType = reader.readUnsignedByte();
      const rootName = reader.readString();
      const rootTag = reader.readTagPayload(rootType, rootName);
      if (rootTag.type !== "compound") {
        throw new Error(
          `NBT root tag must be a compound, got: ${rootTag.type}`,
        );
      }

      const extension = fileName.split(".").pop() || "nbt";

      return {
        data: rootTag as NbtCompound,
        roundTripSupport: "stable",
        metadata: {
          extension,
          formatLabel: "NBT (Minecraft)",
          fileSize: input.byteLength,
          wasDecompressed,
          warnings: wasDecompressed
            ? ["File was compressed and decompressed"]
            : [],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const extension = fileName.split(".").pop() || "nbt";

      return {
        data: {
          type: "compound",
          name: "",
          value: { type: "compound", entries: [] },
        },
        roundTripSupport: "none",
        metadata: {
          extension,
          formatLabel: "NBT (Minecraft)",
          fileSize: input.byteLength,
          wasDecompressed: false,
          warnings: [`Parse error: ${message}`],
        },
      };
    }
  }

  async serialize(data: NbtCompound): Promise<ArrayBuffer> {
    const isLittleEndian = this.format === "little";
    const writer = new NbtWriter(isLittleEndian);
    writer.writeTag(data);
    return writer.toBuffer();
  }
}

/**
 * Factory function to create an NBT parser instance
 */
export function createNbtParser(format: "big" | "little" = "big"): NBTParser {
  return new NBTParser(format, true);
}

// ====================== Backward Compatibility Exports ======================

export type NbtData = NbtValue;

export interface NbtCompoundLegacy {
  type: "compound";
  name: string;
  value: { type: "compound"; entries: NbtData[] };
}

/**
 * Simplify NBT data to plain JavaScript objects for easier consumption.
 */
export function simplifyNbt(data: NbtData | null): unknown {
  if (data === null) return null;

  const d = data as unknown as Record<string, unknown>;
  const type = d["type"] as string;

  switch (type) {
    case "compound": {
      const result: Record<string, unknown> = {};
      const val = d["value"] as Record<string, unknown> | undefined;
      if (val && Array.isArray(val["entries"])) {
        const entries = val["entries"] as NbtData[];
        for (const entry of entries) {
          const name = (entry as unknown as Record<string, unknown>)[
            "name"
          ] as string;
          result[name] = simplifyNbt(entry);
        }
      }
      return result;
    }
    case "list": {
      const listValue = d["value"] as
        | { type?: string; values?: unknown[] }
        | undefined;
      if (listValue && Array.isArray(listValue["values"])) {
        return listValue["values"];
      }
      return [];
    }
    case "byte":
    case "short":
    case "int":
    case "float":
    case "double":
    case "long":
    case "string":
      return d["value"];
    case "byte-array":
    case "byteArray":
    case "int-array":
    case "intArray":
    case "long-array":
    case "longArray":
      return d["value"];
    default:
      return d["value"];
  }
}

/**
 * Serialize NBT data back to binary format.
 */
export function serializeNbt(
  data: NbtData,
  format: "big" | "little" = "big",
): ArrayBuffer {
  const isLittleEndian = format === "little";
  const writer = new NbtWriter(isLittleEndian);

  if (data.type === "compound") {
    const compoundData = data as unknown as NbtCompound;
    writer.writeByte(TAG_COMPOUND);
    writer.writeShort(compoundData.name.length);
    writer.writeRawBytes(new TextEncoder().encode(compoundData.name));
    const entries = compoundData.value?.entries || [];
    for (const entry of entries) {
      writeLegacyEntry(writer, entry);
    }
    writer.writeByte(TAG_END);
    return writer.toBuffer();
  }

  const name = (data as unknown as Record<string, unknown>)["name"] as string;
  writer.writeByte(stringToTagType(data.type));
  writer.writeShort(name.length);
  writer.writeRawBytes(new TextEncoder().encode(name));
  writeRawValue(
    writer,
    stringToTagType(data.type),
    (data as unknown as Record<string, unknown>)["value"],
  );
  return writer.toBuffer();
}

function writeLegacyEntry(writer: NbtWriter, entry: NbtValue): void {
  const d = entry as unknown as Record<string, unknown>;
  const type = d["type"] as string;
  const name = (d["name"] as string) || "";
  const value = d["value"];

  writer.writeByte(stringToTagType(type));
  writer.writeShort(name.length);
  writer.writeRawBytes(new TextEncoder().encode(name));

  switch (type) {
    case "byte":
      writer.writeByte(value as number);
      break;
    case "short":
      writer.writeShort(value as number);
      break;
    case "int":
      writer.writeInt(value as number);
      break;
    case "long":
      writer.writeLong(value as bigint);
      break;
    case "float":
      writer.writeFloat(value as number);
      break;
    case "double":
      writer.writeDouble(value as number);
      break;
    case "byte-array":
    case "byteArray": {
      const arr = value as number[];
      writer.writeInt(arr.length);
      for (const b of arr) writer.writeByte(b);
      break;
    }
    case "int-array":
    case "intArray": {
      const arr = value as number[];
      writer.writeInt(arr.length);
      for (const n of arr) writer.writeInt(n);
      break;
    }
    case "long-array":
    case "longArray": {
      const arr = value as bigint[];
      writer.writeInt(arr.length);
      for (const l of arr) writer.writeLong(l);
      break;
    }
    case "string":
      writer.writeString(value as string);
      break;
    case "list": {
      const listVal = value as { type?: string; values?: unknown[] };
      const elemType = listVal.type ? stringToTagType(listVal.type) : 0;
      const values = listVal.values || [];
      writer.writeByte(elemType);
      writer.writeInt(values.length);
      for (const item of values) {
        writeRawValue(writer, elemType, item);
      }
      break;
    }
    case "compound": {
      const compoundVal = value as { entries?: NbtValue[] };
      if (compoundVal.entries) {
        for (const child of compoundVal.entries) {
          writeLegacyEntry(writer, child);
        }
      }
      writer.writeByte(TAG_END);
      break;
    }
  }
}

function writeRawValue(writer: NbtWriter, type: number, value: unknown): void {
  switch (type) {
    case TAG_BYTE:
      writer.writeByte(value as number);
      break;
    case TAG_SHORT:
      writer.writeShort(value as number);
      break;
    case TAG_INT:
      writer.writeInt(value as number);
      break;
    case TAG_LONG:
      writer.writeLong(value as bigint);
      break;
    case TAG_FLOAT:
      writer.writeFloat(value as number);
      break;
    case TAG_DOUBLE:
      writer.writeDouble(value as number);
      break;
    case TAG_BYTE_ARRAY: {
      const arr = value as number[];
      writer.writeInt(arr.length);
      for (const b of arr) writer.writeByte(b);
      break;
    }
    case TAG_STRING:
      writer.writeString(value as string);
      break;
    case TAG_LIST: {
      const listVal = value as { type?: string; values?: unknown[] };
      const elemType = listVal.type ? stringToTagType(listVal.type) : 0;
      const values = listVal.values || [];
      writer.writeByte(elemType);
      writer.writeInt(values.length);
      for (const item of values) {
        writeRawValue(writer, elemType, item);
      }
      break;
    }
    case TAG_COMPOUND: {
      const compoundVal = value as { entries?: NbtValue[] };
      if (compoundVal.entries) {
        for (const child of compoundVal.entries) {
          writeLegacyEntry(writer, child);
        }
      }
      writer.writeByte(TAG_END);
      break;
    }
    case TAG_INT_ARRAY: {
      const arr = value as number[];
      writer.writeInt(arr.length);
      for (const n of arr) writer.writeInt(n);
      break;
    }
    case TAG_LONG_ARRAY: {
      const arr = value as bigint[];
      writer.writeInt(arr.length);
      for (const l of arr) writer.writeLong(l);
      break;
    }
  }
}
