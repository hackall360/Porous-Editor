# SaveForge - Pure Client-Side Save Editor

A fully-featured, 100% client-side save file editor built with TypeScript. SaveForge supports multiple game save formats and provides an intuitive interface for editing game saves directly in the browser - **no server required**.

## ✨ Features

- **100% Client-Side**: All processing happens in your browser - zero server infrastructure needed
- **Multi-format Support**: JSON/Unity, RPG Maker (MV/MZ/VX/2000/2003), and raw binary/text saves
- **Real-time Editing**: Instant preview of changes with live updates
- **Type-Safe**: Built with TypeScript for better reliability and maintainability
- **Modern Stack**: TypeScript, ESBuild, Tailwind CSS via CDN
- **Responsive Design**: Works on desktop and mobile devices
- **Static Hosting Ready**: Deploy to GitHub Pages, Netlify, Vercel, or any static host

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for building only)
- npm or yarn

### Development

```bash
# Install dependencies
npm install

# Build the client bundle
npm run build

# Start development server (optional, for testing)
npm run serve
```

Open `public/index.html` directly in your browser or use the serve command.

### Production Build

```bash
# Create optimized production bundle
npm run build

# The built files are in the /public directory:
# - public/index.html (upload page)
# - public/editor.html (editor page)
# - public/js/bundle.js (compiled TypeScript)
```

## 📁 Project Structure

```
porous-editor/
├── src/
│   └── client/
│       └── index.ts      # All client-side TypeScript logic
├── public/               # Static files (what you deploy)
│   ├── index.html        # Upload page
│   ├── editor.html       # Editor interface
│   └── js/
│       └── bundle.js     # Compiled client bundle (generated)
├── package.json          # Dependencies and build scripts
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.json        # ESLint rules
└── .gitignore           # Git ignore patterns
```

**For deployment: Only the `/public` directory needs to be uploaded to your hosting service.**

## 🌐 Supported Formats

| Extension | Format | Type |
|-----------|--------|------|
| .json | JSON / Unity | Structured |
| .save | Unity / Ren'Py | Structured |
| .rmmzsave | RPG Maker MZ | Raw |
| .rpgsave | RPG Maker MV | Raw |
| .rvdata2 | RPG Maker VX Ace | Raw |
| .rxdata | RPG Maker XP/VX | Raw |
| .lsd | RPG Maker 2000/2003 | Raw |
| .sav | Various (Wolf RPG, Unreal) | Raw |

## 🛠️ Build Commands

```bash
# Development build with watch mode
npm run dev

# Production build (minified)
npm run build

# Type checking only
npm run typecheck

# Linting
npm run lint

# Serve locally for testing
npm run serve
```

## 🎯 How It Works

1. **Upload**: User selects a save file on the index page
2. **Parse**: File is read via FileReader API and parsed as JSON or stored as raw text
3. **Store**: Data is saved to browser localStorage with metadata
4. **Edit**: User is redirected to editor page which renders appropriate UI:
   - **JSON Editor**: Structured inputs for money, inventory items, and string/numeric variables
   - **Raw Editor**: Plain textarea for free-form editing of binary/text files
5. **Download**: Edited save is packaged as a Blob and downloaded to the user's device

**All processing happens 100% in the browser. No data ever leaves the user's device.**

## 🚢 Deployment

Since this is a pure static site, you can deploy to any static hosting service:

### GitHub Pages
```bash
# Build first
npm run build

# Then copy /public to your GitHub Pages branch or use GitHub Actions
```

### Netlify / Vercel
1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `public`
4. Deploy!

### Any Static Host
Simply upload the contents of the `/public` folder to your web host. No server-side code required.

## 🔧 Architecture

### Client-Side TypeScript (`src/client/index.ts`)

- **EditorStateManager**: Centralized state management for current save data
- **LocalStorage Utilities**: Persistence between page loads
- **File Handler**: FileReader API integration for uploads
- **Renderers**: 
  - `renderJSONEditor()` - Dynamic form generation for structured data
  - `renderRawEditor()` - Textarea for raw editing
- **Event Handlers**: Update functions for money, inventory, and custom variables
- **Download Manager**: Blob creation and download triggering

### HTML Pages

- **index.html**: Upload interface with drag-and-drop support
- **editor.html**: Main editor with format-specific UI
- Both use Tailwind CSS (CDN) and Font Awesome (CDN) for styling

### Type System (`src/types/index.ts`)

Full TypeScript definitions including:
- `SaveData` union type (JSON vs Raw)
- `InventoryItem` interface
- `StoredSave` for localStorage payload
- `EditorState` for in-memory state
- Format detection utilities

## 🔒 Security & Privacy

- **Zero Server Processing**: No save files are uploaded anywhere
- **LocalStorage Only**: Data persists only in the user's browser
- **No External APIs**: Only CDN resources (Tailwind, Font Awesome, Google Fonts)
- **Client-Side Only**: Can be hosted on any static host with no backend

## 🧪 Browser Compatibility

- Modern browsers with ES2020 support
- Required APIs:
  - LocalStorage
  - FileReader API
  - Blob API
  - URL.createObjectURL

## 📝 Development Notes

### Adding New Formats

Edit `src/types/index.ts`:
1. Add extension to `DEFAULT_FORMATS.jsonExtensions` or `rawExtensions`
2. Add label to `DEFAULT_FORMATS.formatLabels`
3. The UI will automatically show the new format

### Customizing the UI

Both HTML files use Tailwind CSS utility classes. The design features:
- Dark theme with neon green (#00ff9d) and pink (#ff00aa) accents
- Press Start 2P pixel font (loaded from Google Fonts)
- Responsive grid layouts
- Glitch animation effects

### State Management

The `EditorStateManager` class maintains:
- `currentData`: The save data being edited
- `originalName`: Original filename
- `originalExt`: Original file extension
- `storedType`: 'json' or 'raw'

All modifications update this state in real-time. The download function serializes the current state.

## 🐛 Troubleshooting

### Bundle Not Updating
```bash
npm run build:client
# or for watch mode:
npm run dev
```

### TypeScript Errors
```bash
npm run typecheck
# Check that you're using TypeScript 5.1.6+
```

### LocalStorage Full
If you get quota errors, clear localStorage:
```javascript
localStorage.clear()
```

## 📄 License

MIT

## 🙏 Acknowledgments

- Built for the modding and speedrunning communities
- Inspired by the need for safe, accessible save editing tools
- Uses Tailwind CSS for styling and Font Awesome for icons
```
