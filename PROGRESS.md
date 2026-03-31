# Current Progress & Active Tasks

## Primary Task
Add extended support for 20+ additional game save formats including Unity/Unreal Engine, SPSS data, and various emulator/game-specific formats

Status: In Progress

## Additional Active Tasks
- Analyze format specifications and determine parsing strategy for each format
- Update type system in `src/client/types/index.ts` to support new formats
- Extend format detection logic to recognize all new file extensions
- Update formats modal HTML in both `index.html` and `editor.html` with new format documentation
- Implement specialized parsers/readers for formats that need them (NBT, SQLite, ESS, etc.)
- Add comprehensive testing for format detection and parsing

## Task Decomposition
1. **Research & Planning** - Review all 24 requested formats, categorize by type (JSON, XML, binary, database, custom), identify which need special parsing vs raw text
2. **Type System Update** - Extend `SaveFormat` union type, update `DEFAULT_FORMATS` with all extensions and labels, add format metadata (needsParser, mimeType, etc.)
3. **Format Detection** - Update `detectFormat()` and `isJsonFormat()` to handle new extensions, add fallback logic for ambiguous cases
4. **UI Updates** - Expand formats modal with 24 format cards organized by category, include header info and editing mode for each
5. **Parser Implementation** - For formats that need it (NBT, SQLite, ESS, etc.), create parser modules that can extract readable data from binary structures
6. **Testing & Validation** - Test format detection with sample files, verify parsers handle edge cases, ensure backward compatibility with existing 8 formats

## Current State Summary
Starting implementation of extended format support. The project currently supports 8 explicit formats (json, save, rmmzsave, rpgsave, rvdata2, rxdata, lsd, sav) plus raw fallback. Need to add 16+ new formats with varying complexity - some are simple text (json, xml, plist), some are binary databases (sqlite, db), some are custom binary formats (ess, nbt, sc2save, etc.). The formats modal will need significant expansion to document all these properly. No code changes made yet - this is the planning phase.

Last Updated: 2025-12-19 (initial creation)