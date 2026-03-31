# Active Problems
A running tally of every issue, bug, edge case, API quirk, or unexpected behavior noticed during work. Entries are added here first. Once confirmed fixed (via test, manual verification, or user sign-off), the entry MUST be removed from here and moved to FIXED-PROBLEMS.md.

## Open Problems
- **Problem**: Limited format support for modern game engines. Details: Currently only 8 formats explicitly supported (json, save, rmmzsave, rpgsave, rvdata2, rxdata, lsd, sav). Need to add support for Unity/Unreal Engine save formats and many other game-specific formats.
- **Problem**: No binary format parsing capabilities. Details: The current implementation treats all non-JSON files as raw text, which doesn't properly handle binary formats with headers, compression, or structured data like GVAS (Unreal), NBT (Minecraft), SQLite, etc.
- **Problem**: No format detection based on file headers/magic bytes. Details: Format detection currently relies solely on file extension, which is unreliable for many game saves that use generic extensions like .dat, .bin, .sav.
- **Problem**: Missing specialized parsers for complex formats. Details: Formats like .ess (Bethesda), .mca/.mcr (Minecraft Anvil), .nbt, .sqlite, .plist, .sc2save, .wld, .plr, etc. require custom parsing logic to be useful in a structured editor.
- **Problem**: No support for SPSS data files. Details: SPSS .sav/.zsav files require specialized statistical data format parsing that is not currently implemented.
- **Problem**: Raw editor is insufficient for binary formats. Details: Editing binary files as raw text can corrupt data; need format-specific editors that understand the structure and can serialize back correctly.
- **Problem**: No compression/decompression handling. Details: Many formats (UE GVAS, Minecraft NBT, Bethesda .ess) use compression (zlib, Oodle, etc.) that needs to be transparently handled.
- **Problem**: No versioning/backward compatibility. Details: Game save formats often have version numbers and change between game versions; need version-aware parsing and migration strategies.