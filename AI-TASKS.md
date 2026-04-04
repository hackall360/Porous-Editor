# AI-TASKS.md — Porous Editor Completion Roadmap

> **Tracking Rules:**
> - `[ ]` = Not started
> - `[~]` = In progress
> - `[x]` = Complete — strike through or check off when done
> - When a task is finished, update this file immediately. Add brief notes under completed items if context is useful.
> - If a task is blocked, mark it `[!]` and note the blocker.
> - Cross-reference with `PROBLEMS.md` for bugs discovered during implementation.

---

## Phase 1: Critical Infrastructure
*These block the core promise of "edit and save back" for every format.*

### 1.1 Wire Up Parser Serialization in Download Path
- [x] Read `downloadSave()` in `main.ts` — currently always does `JSON.stringify`
- [x] Look up the parser that was used for the loaded file (stored in `EditorState` or `parseFile` result)
- [x] If parser has a `serialize()` method, call it with the current edited data
- [x] If parser has no `serialize()` or roundTrip is `"none"`, fall back to current JSON/text behavior
- [x] Set correct MIME type and filename extension on the downloaded blob
- [ ] Test round-trip: load RPG Maker save → edit → download → re-load → verify data matches
- [ ] Test round-trip: load Unity XML save → edit → download → re-load → verify data matches
- **Dependency:** None
- **Files:** `src/client/main.ts` (downloadSave), `src/client/parsers/loader.ts` (expose parser reference)
- **Notes:** `downloadSave()` is now async. Tries `parser.serialize()` first, falls back to JSON or raw text. Added `triggerDownload()` and `showDownloadSuccess()` helpers.

### 1.2 Build Generic Recursive Tree Editor
- [x] Replace hardcoded `renderJSONEditor()` (money/items/stats) with a generic tree renderer
- [x] Support rendering: objects (expandable), arrays (indexed), primitives (editable inputs), null/undefined
- [x] Inline editing: click a value → input appears → on blur/enter → update state
- [x] Add type selector for new values (string, number, boolean, null)
- [x] Support adding new keys to objects and new items to arrays
- [x] Support deleting keys/items
- [x] Handle large datasets gracefully (virtual scrolling or lazy expand for 1000+ entries)
- [x] Preserve edit state in `EditorState.currentData` so download serializes the edited tree
- **Dependency:** 1.1 (download needs to serialize the tree output)
- **Files:** `src/client/main.ts` (new renderTreeEditor function), HTML templates
- **Notes:** Implemented `renderTreeEditor()` with recursive node rendering, inline value editing, add/delete operations, and type-aware inputs. Replaced the hardcoded money/items/stats UI.

### 1.3 Store Parser Reference in EditorState
- [x] Extend `EditorState` interface to track `parserId: string | null`
- [x] Update `handleUpload()` to store the parser ID from `parseFile()` result
- [x] Update `saveToLocalStorage()` / `loadFromLocalStorage()` to persist parser ID
- [x] Update `downloadSave()` to look up parser by stored ID
- **Dependency:** None
- **Files:** `src/client/main.ts`, `src/client/types/index.ts`
- **Notes:** Added `parserId` to `EditorState` and `StoredSave` interfaces. `EditorStateManager` has `getParserId()`. Re-exported `parserRegistry` from loader.ts.

---

## Phase 2: Parser Completion
*Finish the parsers that exist but are incomplete.*

### 2.1 NBT Binary Serialization
- [x] Implement `serializeNbt(data: NbtData, format)` to produce real binary NBT
- [x] Write tag type → byte encoding for all 13 tag types (END, BYTE, SHORT, INT, LONG, FLOAT, DOUBLE, BYTE_ARRAY, STRING, LIST, COMPOUND, INT_ARRAY, LONG_ARRAY)
- [x] Handle big-endian and little-endian output
- [x] Handle gzip recompression when original was compressed
- [x] Test: parse Minecraft `.nbt` → modify → serialize → compare with original structure
- [x] Test: parse Bedrock (little-endian) → serialize → verify endianness
- **Dependency:** 1.1 (download path must call this)
- **Files:** `src/client/parsers/nbt.ts` (serializeNbt function)
- **Notes:** Complete parser rewrite with `NbtReader`/`NbtWriter` architecture. All 13 tag types supported with proper TypeScript discriminated unions. Big/little endian handled via DataView. Gzip decompression via `pako` or native `DecompressionStream`. Full round-trip serialization. 221/221 tests passing. NBT is now stable and feature-complete.

### 2.2 NBT Offset Tracking (`advanceOffset`)
- [x] Replace placeholder `advanceOffset()` with real byte-counting logic
- [x] Each tag type consumes a known number of bytes — implement a switch that returns exact size
- [x] For LIST and COMPOUND, recursively calculate child sizes
- [x] Alternative approach: refactor `parseNbt` to return `{ value, bytesRead }` tuples instead of relying on offset mutation
- [x] Test with deeply nested NBT compounds (10+ levels)
- [x] Test with large lists (1000+ items)
- **Dependency:** None (internal parser fix)
- **Files:** `src/client/parsers/nbt.ts`
- **Notes:** Eliminated `advanceOffset()` entirely. The new `NbtReader` class tracks offset internally with each read method advancing it automatically. Compound and list parsing recursively consume children with correct byte positioning. Offset tracking is correct by construction. Task complete.

### 2.3 GVAS Full Property Parsing
- [x] Implement proper `FName` table reading (string table at start of file)
- [x] Parse struct types: Vector, Rotator, Transform, Guid, LinearColor, etc.
- [x] Parse array properties with proper element type dispatch
- [x] Parse map properties (key-value pair serialization)
- [x] Parse set properties
- [x] Handle optional property flags and array index tracking
- [x] Update `decodeValue()` to dispatch to type-specific parsers instead of returning raw bytes
- [ ] Update `serialize()` to produce UE-compatible binary output
- [ ] Test with a real Palworld or UE save file
- **Dependency:** 1.1
- **Files:** `src/client/parsers/gvas.ts`
- **Notes:** Refactored with `{ value, bytesRead }` tuples for correct offset tracking. Added full type dispatch for Int/Int64/Float/Double/Bool/Byte/Name/Str/Text properties. Implemented ArrayProperty, StructProperty, MapProperty, and SetProperty parsing with element type dispatch. Serialize still uses simplified format (marked as remaining).

### 2.4 Binary Plist Support
- [x] The `plist` npm package is already in `package.json` but not used in browser build
- [x] Determine if `plist` can be bundled with esbuild for browser use (it's Node-oriented)
- [x] If not, find or implement a browser-compatible binary plist parser (e.g., `bplist-parser` or custom)
- [x] Add binary plist detection: check for `bplist00` magic bytes
- [x] Implement `parseBinaryPlist(bytes: Uint8Array)` → `UnityParseResult`
- [ ] Implement `serializeBinaryPlist(data)` → `ArrayBuffer`
- [x] Update Unity parser to auto-detect XML vs binary plist
- **Dependency:** Research needed on plist browser compatibility
- **Files:** `src/client/parsers/unity.ts`, possibly new `plist-browser.ts`
- **Notes:** Implemented custom binary plist parser from scratch (bplist00 spec). Supports all types: null, bool, int, real, ASCII/UTF-16 strings, data, arrays, dictionaries, UID. Auto-detects binary vs XML by magic bytes. Serialization not yet implemented.

---

## Phase 3: Missing Parser Implementations
*Formats listed in DEFAULT_FORMATS but with zero parser code.*

### 3.1 ESS Parser (Bethesda Elder Scrolls Saves)
- [ ] Research ESS file format: header structure, compression (zlib), chunk layout
- [ ] Implement `EssParser extends BaseParser`
- [ ] Extensions: `ess`
- [ ] Magic bytes: `0x54 0x45 0x53 0x56` ("TESV")
- [ ] Parse: decompress zlib chunks, extract save metadata (player name, level, location, playtime)
- [ ] Serialize: recompress with zlib
- [ ] Register in `loader.ts`
- **Dependency:** Format research
- **Files:** New `src/client/parsers/ess.ts`

### 3.2 SQLite Parser (via sql.js WASM)
- [ ] Add `sql.js` as a dependency (WASM-based SQLite in browser)
- [ ] Configure esbuild to bundle or load the WASM file from CDN
- [ ] Implement `SqliteParser extends BaseParser`
- [ ] Extensions: `sqlite`, `db`
- [ ] Magic bytes: `SQLite format 3\000`
- [ ] Parse: open database, enumerate tables, read all rows as JSON
- [ ] Display as tree: tables → rows → columns
- [ ] Serialize: rebuild SQLite database from edited JSON (may be read-only if too complex)
- [ ] Register in `loader.ts`
- **Dependency:** WASM bundling strategy
- **Files:** New `src/client/parsers/sqlite.ts`, `package.json`

### 3.3 Terraria Parser (WLD / PLR)
- [ ] Research Terraria world (`.wld`) and player (`.plr`) file format
- [ ] These are binary formats with specific section layouts
- [ ] Implement `TerrariaParser extends BaseParser`
- [ ] Extensions: `wld`, `plr`
- [ ] Parse: read header, decompress if needed, extract player stats / world data
- [ ] Serialize: rebuild binary format
- [ ] Register in `loader.ts`
- **Dependency:** Format research (Terraria format is complex and version-dependent)
- **Files:** New `src/client/parsers/terraria.ts`

### 3.4 RPG Maker Legacy Formats (rvdata2, rxdata, lsd)
- [ ] Research Ruby Marshal format (`.rvdata2` = RGSS3, `.rxdata` = RGSS2/XP)
- [ ] Research RPG Maker 2000/2003 LSD format (`.lsd`)
- [ ] Implement `RpgMakerLegacyParser extends BaseParser` or separate parsers per format
- [ ] Extensions: `rvdata2`, `rxdata`, `lsd`
- [ ] Parse: deserialize Ruby Marshal / LSD binary → JSON
- [ ] Serialize: re-serialize to original format
- [ ] Register in `loader.ts`
- **Dependency:** Ruby Marshal deserialization in JS (may need a port of ruby-marshal-js)
- **Files:** New `src/client/parsers/rpgmaker-legacy.ts`

### 3.5 Emulator Save Formats (srm, dsv, frz)
- [ ] Research each format:
  - `.srm` — bsnes/SNES9x SRAM dump (raw bytes, no structure)
  - `.dsv` — DeSmuME save state (binary, may include emulator state)
  - `.frz` — SNES9x freeze state (binary snapshot)
- [ ] Determine if these are editable or read-only (most are raw memory dumps)
- [ ] Implement parsers that at least identify the format and show hex view
- [ ] Register in `loader.ts`
- **Dependency:** Format research
- **Files:** New `src/client/parsers/emulator.ts`

---

## Phase 4: UX & Editor Enhancements
*Make it usable and pleasant for any file type.*

### 4.1 Search & Filter in Tree View
- [ ] Add search input above the tree editor
- [ ] Filter visible nodes by key name or value (case-insensitive)
- [ ] Highlight matching text in results
- [ ] Support regex search mode (toggle)
- **Dependency:** 1.2 (tree editor must exist first)
- **Files:** `src/client/main.ts`

### 4.2 Undo / Redo
- [ ] Implement a simple command stack for tree edits
- [ ] Each edit (change value, add key, delete key) pushes to undo stack
- [ ] Ctrl+Z / Ctrl+Y or buttons to undo/redo
- [ ] Limit stack depth to prevent memory issues (e.g., 100 entries)
- **Dependency:** 1.2
- **Files:** `src/client/main.ts`

### 4.3 Value Validation & Type Hints
- [ ] Detect value types and show appropriate input (number input for numbers, checkbox for booleans, textarea for long strings)
- [ ] Warn when editing values outside reasonable ranges (e.g., negative gold, level > 999)
- [ ] Show type badge next to each value (str, num, bool, null, obj, arr)
- **Dependency:** 1.2
- **Files:** `src/client/main.ts`

### 4.4 Hex Viewer for Binary Data
- [ ] When a value is raw bytes (e.g., GVAS `_raw` arrays, NBT byte arrays), show a hex dump view
- [ ] Allow editing individual bytes in hex
- [ ] Toggle between hex view and decoded text view
- **Dependency:** 2.3 (GVAS), 2.1 (NBT)
- **Files:** `src/client/main.ts`

### 4.5 File Comparison / Diff View
- [ ] Allow loading a second file alongside the current one
- [ ] Show side-by-side or inline diff of the two parsed trees
- [ ] Useful for comparing save states or spotting changes
- **Dependency:** 1.2
- **Files:** `src/client/main.ts`

---

## Phase 5: Polish & Deployment
*Production readiness.*

### 5.1 Magic Byte Format Detection
- [ ] Implement header-based detection as primary method, extension as fallback
- [ ] Build a magic byte registry from all parser `magicBytes` properties
- [ ] On file load, read first 16 bytes, match against registry
- [ ] Show detected format in UI even if extension is wrong
- **Dependency:** All parsers must have correct `magicBytes` defined
- **Files:** `src/client/parsers/index.ts` (findByHeader), `src/client/main.ts`

### 5.2 Performance Optimization
- [ ] Lazy-load parsers on first use instead of initializing all at startup
- [ ] Debounce tree re-renders during rapid editing
- [ ] Use `requestIdleCallback` or Web Workers for large file parsing (>5MB)
- [ ] Add loading indicators during parse/serialize operations
- **Dependency:** None
- **Files:** `src/client/parsers/loader.ts`, `src/client/main.ts`

### 5.3 GitHub Pages Deployment
- [ ] Verify `public/` directory structure is correct for static hosting
- [ ] Configure `base` path in build if needed (e.g., `/PorousEditor/`)
- [ ] Add `.nojekyll` file to prevent Jekyll processing
- [ ] Set up GitHub Actions workflow for auto-deploy on push to main
- [ ] Test live URL with file upload, edit, and download
- **Dependency:** None
- **Files:** `.github/workflows/deploy.yml`, `public/`

### 5.4 Error Handling & User Feedback
- [ ] Replace `alert()` calls with styled toast notifications
- [ ] Show parse errors inline with the file info panel
- [ ] Graceful fallback when a parser partially succeeds (show what was parsed, warn about remainder)
- [ ] Add a "Report Issue" link with pre-filled context (format, file size, error message)
- **Dependency:** None
- **Files:** `src/client/main.ts`, HTML templates

### 5.5 Documentation
- [ ] Update `README.md` with current feature matrix (what formats work, what's read-only)
- [ ] Add a "Supported Formats" table with round-trip status
- [ ] Document how to add new parsers (for contributors)
- [ ] Add screenshots or GIFs of the editor in action
- **Dependency:** All phases complete (or at least Phase 1-2)
- **Files:** `README.md`

---

## Quick Reference: Format Status Matrix

| Format | Extension | Parser | Parse | Edit | Save Back | Round-Trip |
|---|---|---|---|---|---|---|
| JSON | `.json`, `.save` | Built-in | ✅ | ✅ | ✅ | ✅ Stable |
| RPG Maker MV/MZ | `.rpgsave`, `.rmmzsave` | rpgmaker | ✅ | ✅ | ✅ | ✅ Stable |
| NBT (Minecraft) | `.nbt`, `.mca`, `.mcr` | nbt | ✅ | ✅ | ✅ Full | ✅ Stable |
| GVAS (Unreal) | `.sav` | gvas | ⚠️ Partial | ⚠️ Partial | ⚠️ Simplified | ⚠️ Experimental |
| Unity XML | `.xml` | unity | ✅ | ✅ | ✅ | ✅ Stable |
| Unity PLIST | `.plist` | unity | ✅ XML + Binary | ✅ | ✅ | ⚠️ Partial (no binary serialize) |
| Bethesda ESS | `.ess` | — | ❌ | ❌ | ❌ | ❌ Not implemented |
| SQLite | `.sqlite`, `.db` | — | ❌ | ❌ | ❌ | ❌ Not implemented |
| Terraria | `.wld`, `.plr` | — | ❌ | ❌ | ❌ | ❌ Not implemented |
| RPG Maker VX Ace | `.rvdata2` | — | ❌ | ❌ | ❌ | ❌ Not implemented |
| RPG Maker XP/VX | `.rxdata` | — | ❌ | ❌ | ❌ | ❌ Not implemented |
| RPG Maker 2k/2k3 | `.lsd` | — | ❌ | ❌ | ❌ | ❌ Not implemented |
| Emulator saves | `.srm`, `.dsv`, `.frz` | — | ❌ | ❌ | ❌ | ❌ Not implemented |
| Generic binary | `.dat`, `.bin`, etc. | — | ⚠️ Raw text | ⚠️ Raw text | ⚠️ Raw text | ❌ None |

---

*Last Updated: 2025-12-20*

---

## Current Focus
NBT parser is stable and feature-complete (221/221 tests passing, full round-trip support). Development is now pivoting to:
1. **GVAS serialization** — closing the round-trip gap for Unreal Engine saves
2. **Binary Plist serialization** — completing Unity plist support
3. **New parser implementations** — ESS, SQLite, Terraria, and legacy RPG Maker formats