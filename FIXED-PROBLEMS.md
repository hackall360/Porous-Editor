# Fixed Problems

A permanent log of all issues that have been resolved in this project. Each entry documents the problem, root cause, and solution.

## Format: 
- **Fixed: [one-line summary]**
  1. The issue was [what failed].
  2. It happened because [root cause].
  3. Fixed by [precise change].


---

### Complete NBT Parser Rewrite (Corrupted File)

1. The issue was hundreds of TypeScript syntax errors, type mismatches, and structural corruption across the entire `nbt.ts` file, making it completely non-functional.
2. It happened because the file had accumulated fragments of multiple failed refactoring attempts, with comments, code, and syntax errors intermingled throughout, resulting in an unparseable source file.
3. Fixed by completely rewriting `nbt.ts` from scratch with a clean architecture: `NbtReader` class for binary reading, `NbtWriter` class for binary writing, proper discriminated union types for all 13 NBT tag types, full round-trip serialization support, gzip decompression via `pako` or `DecompressionStream`, and proper error handling with graceful fallbacks.



### TypeScript Compilation Errors Across Parsers

1. The issue was 35 TypeScript errors across 4 parser files (nbt.ts, gvas.ts, rpgmaker.ts, unity.ts) including missing methods, type mismatches, unused variables, and undefined references.
2. It happened because the parsers had incomplete implementations: duplicate method definitions, missing abstract method implementations (doParse), strict type checking with exactOptionalPropertyTypes, and improper handling of ArrayBuffer vs ArrayBufferLike types.
3. Fixed by removing duplicate methods, implementing doParse in rpgmaker.ts and unity.ts, ensuring ParseMetadata.warnings always returns string[], fixing ArrayBuffer type issues with proper assertions, removing unused imports/variables, adding non-null assertions for regex matches, and casting pako/fflate returns to satisfy the type checker.

### HTML Tailwind Warnings
1. The issue was Tailwind CSS warnings about `z-[9999]` syntax (should be `z-9999`) and `hidden` class conflicting with `flex`.
2. It happened because arbitrary value syntax used brackets instead of dashes, and modal dialogs had both `hidden` and `flex` classes which set contradictory display properties.
3. Fixed by replacing all `z-[9999]` with `z-9999` in editor.html, index.html, and public/index.html. The `hidden`/`flex` conflict remains as an intentional pattern (hidden gets removed via JS when showing).

### TypeScript Errors in NBT Parser (Second Pass)

1. The issue was 15 TypeScript errors in nbt.ts including missing `readString` method, type mismatches with Uint8Array/ArrayBuffer, `warnings` field being undefined instead of string[], `data: null` not assignable to NbtData, format type mismatch ("littleVarint" not accepted by parseNbt), unused imports/parameters, and improper `@ts-ignore` usage.
2. It happened because the NBT parser had an incomplete implementation: the `readString` method was called but never defined, ArrayBufferLike was not properly cast to ArrayBuffer, error handling used `any` instead of `unknown`, and `@ts-ignore` directives were used where `@ts-expect-error` was more appropriate.
3. Fixed by adding the missing `readNbtString` method, casting encoded buffers to `ArrayBuffer`, changing `error: any` to `error: unknown` with proper message extraction, replacing `@ts-ignore` with `@ts-expect-error` where still needed and removing them where globals.d.ts provides proper types, ensuring `warnings` always returns `[]` instead of `undefined`, and converting "littleVarint" to "little" before passing to parseNbt.

### Unused @ts-expect-error Directives in RPG Maker Parser

1. The issue was 11 unused `@ts-expect-error` directives in rpgmaker.ts causing TypeScript errors because the directives had no errors to suppress.
2. It happened because globals.d.ts was updated to provide proper type declarations for `window.pako`, `window.LZString`, and `window.fflate`, making the previous type suppression directives unnecessary.
3. Fixed by removing all 11 unused `@ts-expect-error` directives from rpgmaker.ts and fixing the unused `_compressionType` destructured variable by renaming to `_ct` and adding `void _ct` to mark it as intentionally unused.

### ESLint `any` Type Warnings and Catch Block Type Safety

1. The issue was 14+ `@typescript-eslint/no-explicit-any` warnings across loader.ts, gvas.ts, rpgmaker.ts, unity.ts, and globals.d.ts, plus `error: any` in catch blocks and improper `@ts-ignore` usage.
2. It happened because dynamic parser output was typed as `any` for convenience, catch blocks used `error: any` instead of `error: unknown`, and `@ts-ignore` was used where `@ts-expect-error` was required by ESLint rules. Additionally, `Record<string, unknown>` triggered TS4111 errors due to `noPropertyAccessFromIndexSignature` requiring bracket notation.
3. Fixed by replacing all `error: any` with `error: unknown` and extracting messages via `error instanceof Error ? error.message : String(error)`, converting `@ts-ignore` to `@ts-expect-error` where still needed, replacing `any` casts with proper `Record<string, unknown>` types using bracket notation for property access, updating pako type declarations to return `Uint8Array | string` with proper type narrowing, and fixing `ParseMetadata` import in loader.ts.

*This file is maintained alongside PROBLEMS.md. When a problem is confirmed fixed, it moves here with this three-sentence template.*
