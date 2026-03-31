
# Current Progress & Active Tasks



## Primary Task

Add extended support for 20+ additional game save formats including Unity/Unreal Engine, SPSS data, and various emulator/game-specific formats



Status: In Progress



## Additional Active Tasks

- ✅ Analyze format specifications and determine parsing strategy

- ✅ Update type system with 24 new formats and metadata
- ✅ Implement parser infrastructure (BaseParser, ParserRegistry)

- ✅ Implement NBT parser (Minecraft .nbt, .mca, .mcr)

- ✅ Implement Unity PlayerPrefs parser (.xml, .plist)
- ✅ Implement GVAS parser (Unreal Engine .sav)
- ✅ Implement RPG Maker parser (.rpgsave, .rmmzsave)
- ⏳ Update formats modal HTML with all new format documentation

- ⏳ Add comprehensive testing for format detection and parsing

- ⏳ Update editor UI to display parser-specific data appropriately



## Task Decomposition

1. **Research & Planning** - Review all 24 requested formats, categorize by type (JSON, XML, binary, database, custom), identify which need special parsing vs raw text

2. **Type System Update** - Extend `SaveFormat` union type, update `DEFAULT_FORMATS` with all extensions and labels, add format metadata (needsParser, mimeType, etc.)

3. **Format Detection** - Update `detectFormat()` and `isJsonFormat()` to handle new extensions, add fallback logic for ambiguous cases

4. **UI Updates** - Expand formats modal with 24 format cards organized by category, include header info and editing mode for each

5. **Parser Implementation** - For formats that need it (NBT, SQLite, ESS, etc.), create parser modules that can extract readable data from binary structures

6. **Testing & Validation** - Test format detection with sample files, verify parsers handle edge cases, ensure backward compatibility with existing 8 formats





## Current State Summary



Parser infrastructure complete with 4 specialized parsers implemented:

- **NBT Parser**: Handles Minecraft NBT (.nbt), region files (.mca, .mcr) with gzip/zlib decompression

- **Unity Parser**: Parses Unity PlayerPrefs in XML and PLIST formats with round-trip support
- **GVAS Parser**: Parses Unreal Engine save files with compression detection (zlib/gzip) and property extraction

- **RPG Maker Parser**: Handles compressed JSON saves with multiple compression algorithms (LZString, pako, fflate)

All parsers registered in a unified `ParserRegistry` and integrated into the file upload flow via `parseFile()` function. Dependencies added to `package.json` (pako, lz-string, fflate, plist). Type system extended with 24 new formats and format metadata for header detection.

Next steps: Update formats modal HTML to document all new formats, then test with sample files from `examples/` folder.





Last Updated: 2025-12-19 (parser infrastructure implemented and committed to develop branch)




