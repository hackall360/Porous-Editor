# Porous Editor - Quick Start Guide

Get up and running with Porous Editor in 5 minutes!

## Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/) (for building only)
- **npm** (comes with Node.js)

**Note**: The built application runs entirely in the browser and requires no Node.js at runtime.

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

This will install TypeScript, ESBuild, and linting tools.

### 2. Build the Application

```bash
npm run build
```

This compiles TypeScript to a single optimized JavaScript bundle at `public/js/bundle.js`.

### 3. Run Locally (Optional)

```bash
npm run serve
```

Open your browser and navigate to: **http://localhost:3000**

**Or** simply open `public/index.html` directly in your browser - no server needed!

## Development Workflow

For active development with auto-rebuilding:

```bash
npm run dev
```

This watches your TypeScript files and rebuilds the bundle automatically on changes. Refresh your browser to see updates.

### Separate Commands

```bash
# Watch mode (rebuilds on changes)
npm run build:watch

# In another terminal, serve locally
npm run serve
```

## Project Structure

```
porous-editor/
├── src/
│   └── client/
│       └── main.ts      # All client-side TypeScript logic
├── public/               # Static files (what you deploy)
│   ├── index.html        # Upload page
│   ├── editor.html       # Editor page
│   └── js/
│       └── bundle.js     # Compiled client bundle (generated)
├── package.json
├── tsconfig.json
└── .eslintrc.json
```

**For deployment: Only the `/public` directory needs to be uploaded.**

## Common Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Create production bundle (minified) |
| `npm run dev` | Build with watch mode for development |
| `npm run typecheck` | Type check without building |
| `npm run lint` | Check code quality |
| `npm run serve` | Serve /public locally on port 3000 |

## How to Use

1. **Upload a Save File**: Drag & drop or click to browse on the homepage
2. **Edit Values**: 
   - JSON saves show structured inputs for money, inventory, and variables
   - Raw saves show a text editor for free editing
3. **Download**: Click "DOWNLOAD EDITED SAVE" to get your modified file

**Note**: All processing happens 100% client-side. No data is sent to any server.

## Deployment

This is a pure static site. Deploy the `/public` folder to any static hosting service:

### GitHub Pages
```bash
# Build first
npm run build

# Then copy /public to your GitHub Pages branch
# Or use GitHub Actions with the built files
```

### Netlify / Vercel
1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `public`
4. Deploy!

### Any Static Host
Simply upload the contents of the `/public` folder. No server-side code required.

## Troubleshooting

### Changes Not Reflected
Make sure you've rebuilt:
```bash
npm run build
# or use watch mode:
npm run dev
```

### TypeScript Errors
```bash
npm run typecheck
# Ensure TypeScript 5.1.6+ is installed
```

### LocalStorage Issues
Clear browser storage if you encounter errors:
- Open DevTools (F12)
- Go to Application > Storage > Local Storage
- Clear the entry for your domain

### Build Fails
Clear and reinstall:
```bash
rm -rf node_modules public/js/bundle.js
npm install
npm run build
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check `src/client/main.ts` to understand the client logic
- Review `src/client/types/index.ts` to see the type definitions
- Customize the UI in the HTML files and TypeScript code

## Need Help?

- All code is typed and documented
- Check browser console for client-side errors
- Ensure Node.js 18+ is installed for building
- Verify the bundle exists at `public/js/bundle.js`

---

**Happy Editing!** 🎮