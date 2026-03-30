# SaveForge - Project Summary

## Overview
SaveForge (formerly Porous Editor) is a fully-featured, 100% client-side save file editor that has been converted from a simple JavaScript application to a modern TypeScript-based web application. The application runs entirely in the browser with no server-side processing required.

## Conversion Completed

### From: Simple JavaScript Application
- 2 HTML files (`index.html`, `editor.html`)
- 2 JavaScript files (`functions.js`, `utils.js`)
- No build process
- No type safety
- Mixed client-side logic

### To: Modern TypeScript Application
- Pure client-side architecture
- Type-safe TypeScript codebase
- ESBuild bundling for optimized production
- Clean separation of concerns
- Professional project structure
- Ready for static hosting deployment

## Project Structure

```
porous-editor/
├── public/                         # Static files (deploy this folder)
│   ├── index.html                 # Upload page
│   ├── editor.html                # Editor interface
│   └── js/
│       └── bundle.js              # Compiled TypeScript bundle
├── src/
│   └── client/
│       ├── main.ts                # Application logic (397 lines)
│       └── types/
│           └── index.ts           # TypeScript definitions (135 lines)
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript configuration
├── .eslintrc.json                 # ESLint rules
├── .gitignore                     # Git ignore patterns
├── README.md                      # Full documentation
├── QUICKSTART.md                  # Quick start guide
└── DEPLOYMENT.md                  # Deployment instructions
```

## Key Features

### 100% Client-Side Processing
- No server infrastructure needed
- All file processing happens in the browser
- Data never leaves the user's device
- Can be hosted on any static hosting service

### Multi-Format Support
- **JSON/Unity**: Structured editing with form inputs
- **RPG Maker** (MV/MZ/VX/2000/2003): Raw file editing
- **Generic .sav files**: Text/binary editing mode
- Automatic format detection based on file extension

### Type-Safe Architecture
- Full TypeScript strict mode
- Comprehensive type definitions
- EditorStateManager for centralized state
- Strongly-typed interfaces for all data structures

### Modern Build System
- ESBuild for fast bundling (4ms build time)
- Minified production bundle (~5.6KB)
- Source maps for debugging
- Watch mode for development

## Technical Stack

### Development Tools
- **TypeScript 5.1.6** - Type-safe JavaScript
- **ESBuild 0.18.11** - Fast bundler
- **ESLint 8.45.0** - Code quality
- **@typescript-eslint** - TypeScript linting

### Runtime (via CDN)
- **Tailwind CSS 3.x** - Utility-first CSS
- **Font Awesome 6.5.1** - Icon library
- **Google Fonts** - Press Start 2P pixel font

### Browser APIs Used
- FileReader API - File uploads
- Blob API - File downloads
- LocalStorage - Data persistence
- DOM API - Dynamic rendering

## Build Commands

```bash
# Production build (minified)
npm run build

# Development with watch mode
npm run dev

# Type checking only
npm run typecheck

# Linting
npm run lint

# Local testing server
npm run serve
```

## Deployment

The application is ready for deployment to any static hosting service:

- **GitHub Pages** - Push to gh-pages branch or use GitHub Actions
- **Netlify** - Drag & drop `/public` folder or connect Git
- **Vercel** - Automatic detection, set output to `public`
- **Cloudflare Pages** - Build command: `npm run build`, output: `public`
- **Firebase Hosting** - Set public directory to `public`
- **AWS S3 + CloudFront** - Sync `/public` to S3 bucket
- **Any traditional web host** - Upload `/public` via FTP

**Only the `/public` directory needs to be deployed.**

## How It Works

1. **Upload Phase**: User selects/drops a save file → FileReader reads content → Parser determines format (JSON or raw) → Data stored in localStorage with metadata → Redirect to editor

2. **Editor Phase**: 
   - **JSON Mode**: Dynamic form generation for money, inventory items, and string/numeric variables
   - **Raw Mode**: Plain textarea for free-form editing
   - All changes update the in-memory state immediately

3. **Download Phase**: Current state serialized → Blob created → Download triggered with original filename

## Architecture Highlights

### State Management
- `EditorStateManager` class encapsulates all state
- Tracks: currentData, originalName, originalExt, storedType
- Provides getters, setters, and reset functionality

### Type System
- `SaveData` - Union of `JsonSaveData` and `RawSaveData`
- `InventoryItem` - Standardized item with name, qty, amount
- `StoredSave` - LocalStorage payload structure
- `EditorState` - In-memory editor state

### Rendering
- `renderJSONEditor()` - Generates HTML for structured data
- `renderRawEditor()` - Creates textarea for raw editing
- Dynamic event handler binding for real-time updates

### Global API
Functions exposed to window for HTML onclick handlers:
- `handleUpload(file)` - Process uploaded file
- `loadEditorData()` - Initialize editor from localStorage
- `downloadSave()` - Export edited save
- `showFormats()/hideFormats()` - Modal control
- `updateMoney(value)` - Update currency
- `updateItem(index, value)` - Update inventory
- `updateStat(key, value)` - Update custom variables

## Browser Compatibility

- Modern browsers with ES2020 support
- Required APIs:
  - LocalStorage (for persistence)
  - FileReader API (for uploads)
  - Blob API (for downloads)
  - URL.createObjectURL (for download links)

## Security & Privacy

- **Zero server processing** - No data transmitted
- **LocalStorage only** - Data scoped to domain
- **No external APIs** - Only CDN resources (Tailwind, Font Awesome)
- **Client-side only** - No backend required

## Performance

- Bundle size: ~5.6KB (minified)
- Build time: ~4ms
- Zero server latency
- Instant file processing
- LocalStorage persistence

## Future Enhancements

Potential additions (not implemented):
- More format-specific parsers (actual RPG Maker save decoding)
- Undo/redo functionality
- Save file validation
- Export to different formats
- Batch editing
- Comparison view (original vs edited)
- Dark/light theme toggle
- More granular inventory editing
- Search/filter for variables

## Migration Notes

This project was converted from a vanilla JavaScript application to a TypeScript application with:
1. Full type safety added
2. Separation of concerns (types, logic, UI)
3. Modern build system
4. Removal of Node.js server dependency
5. Optimized for static hosting
6. Improved code organization and maintainability

All original functionality preserved:
- File upload and parsing
- JSON and raw editing modes
- Money/inventory/variable editing
- Download functionality
- Format detection
- LocalStorage persistence
- Responsive design

## License

MIT