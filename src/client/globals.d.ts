// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Global type declarations for external libraries that may be loaded at runtime
 */

// Pako (zlib/gzip compression)
declare namespace pako {
  function inflate(
    data: Uint8Array,
    options?: { to: "string" },
  ): Uint8Array | string;
  function inflateRaw(
    data: Uint8Array,
    options?: { to: "string" },
  ): Uint8Array | string;
  function ungzip(
    data: Uint8Array,
    options?: { to: "string" },
  ): Uint8Array | string;
  function deflate(data: Uint8Array): Uint8Array;
  function deflateRaw(data: Uint8Array): Uint8Array;
  function gzip(data: Uint8Array): Uint8Array;
}

// LZString (compression)
declare namespace LZString {
  function compressToBase64(input: string): string;
  function decompressFromBase64(compressed: string): string | null;
  function compress(input: string): string;
  function decompress(compressed: string): string | null;
}

// fflate (compression)
declare namespace fflate {
  function inflateSync(data: Uint8Array): Uint8Array;
  function deflateSync(data: Uint8Array): Uint8Array;
}

// Extend Window interface with optional library globals
interface Window {
  pako?: typeof pako;
  LZString?: typeof LZString;
  fflate?: typeof fflate;
}

// Declare require for Node.js module loading in browser context
declare const require: {
  (module: string): unknown;
  ensure: (
    paths: string[],
    callback: (require: (module: string) => unknown) => void,
  ) => void;
  resolve: (module: string) => string;
};
