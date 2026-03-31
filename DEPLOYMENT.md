# Porous Editor - Deployment Guide

This guide covers deploying Porous Editor to various static hosting services. Since the application is 100% client-side, deployment is straightforward - just upload the `/public` directory.

## 📦 What to Deploy

Only the contents of the `/public` folder need to be uploaded:

```
public/
├── index.html          # Main upload page
├── editor.html         # Editor interface
├── js/
│   └── bundle.js       # Compiled TypeScript (minified)
└── (any other assets you add)
```

**Do not deploy**:
- `src/` - Source TypeScript files
- `package.json` - Build configuration only
- `tsconfig.json` - Build configuration only
- `node_modules/` - Development dependencies

---

## 🌐 Static Hosting Options

### 1. GitHub Pages

#### Using GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main, master ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

#### Manual Deployment

1. Build the project: `npm run build`
2. Copy `/public` contents to your `gh-pages` branch
3. Enable GitHub Pages in repository settings
4. Set source to `gh-pages` branch

---

### 2. Netlify

#### Method 1: Drag & Drop
1. Run `npm run build`
2. Drag the `/public` folder onto the Netlify drop zone at https://app.netlify.com/drop

#### Method 2: Git Integration
1. Connect your repository to Netlify
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `public`
3. Click "Deploy site"

#### Netlify Configuration (Optional)

Create `netlify.toml` for custom settings:

```toml
[build]
  command = "npm run build"
  publish = "public"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

---

### 3. Vercel

#### Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (will prompt for settings)
vercel --prod

# Or specify the public directory
vercel --prod --public
```

#### Git Integration
1. Import your repository in Vercel
2. Vercel auto-detects the project
3. Override output directory to `public` in project settings
4. Deploy

#### Vercel Configuration

Create `vercel.json`:

```json
{
  "outputDirectory": "public",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

### 4. Cloudflare Pages

1. Connect your GitHub/GitLab repository
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `public`
3. Deploy

#### Cloudflare Pages Configuration

Create `_redirects` file in `/public` for SPA routing:

```
/*    /index.html   200
```

Or create `pages.json`:

```json
{
  "redirects": [
    {
      "source": "/*",
      "destination": "/index.html",
      "statusCode": 200
    }
  ]
}
```

---

### 5. AWS S3 + CloudFront

#### Using AWS CLI

```bash
# Build the project
npm run build

# Sync to S3 bucket
aws s3 sync public/ s3://YOUR-BUCKET-NAME/ --delete

# Invalidate CloudFront cache (if using)
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

#### S3 Configuration
1. Create an S3 bucket with static website hosting enabled
2. Set index document to `index.html`
3. Upload `/public` contents
4. (Optional) Configure CloudFront for HTTPS and CDN

---

### 6. Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project (select Hosting)
firebase init

# When prompted:
# - Select existing project or create new
# - Set public directory to: public
# - Configure as single-page app: Yes
# - Set up GitHub deploys: Optional

# Deploy
firebase deploy --only hosting
```

---

### 7. Traditional Web Hosting (cPanel, FTP, etc.)

1. Run `npm run build`
2. Upload all files from `/public` to your `public_html` or `www` directory
3. Ensure `index.html` is set as the default document
4. Access your domain

---

## ⚙️ Configuration Options

### Custom Domain

All static hosts support custom domains. Generally:
1. Add your domain in the hosting dashboard
2. Update DNS records (CNAME or A records)
3. Wait for propagation (up to 48 hours, usually minutes)

### HTTPS

Most modern static hosts provide free SSL certificates automatically:
- **GitHub Pages**: Automatic via `https://username.github.io`
- **Netlify**: Automatic with custom domains
- **Vercel**: Automatic with custom domains
- **Cloudflare Pages**: Automatic
- **AWS S3 + CloudFront**: CloudFront provides SSL

---

## 🧪 Testing Before Deployment

### Local Testing

```bash
# Option 1: Use the serve command
npm run serve
# Visit http://localhost:3000

# Option 2: Open directly in browser
# Simply open public/index.html in your browser
# Note: Some features may be limited due to file:// protocol restrictions
```

### Testing Checklist

- [ ] All pages load correctly (`/` and `/editor.html`)
- [ ] File upload works
- [ ] Editor renders correctly for JSON files
- [ ] Editor renders correctly for raw files
- [ ] Download button creates a file
- [ ] Format detection displays correct badges
- [ ] No console errors in browser DevTools
- [ ] Responsive design works on mobile

---

## 🔧 Build Configuration

### Production Build

The production build creates a minified bundle:

```bash
npm run build
```

Output:
- `public/js/bundle.js` (minified, ~5-6KB)
- `public/js/bundle.js.map` (source map for debugging)

### Development Build

For development with source maps and no minification:

```bash
npm run dev
```

This watches for changes and rebuilds automatically.

---

## 🚨 Common Issues & Solutions

### Issue: Blank page after deployment
**Solution**: Check that `bundle.js` exists in `public/js/` and is being loaded. Open browser DevTools (F12) and check the Console and Network tabs for 404 errors.

### Issue: Styles not loading
**Solution**: Tailwind CSS is loaded from CDN. Ensure the CDN links in HTML are accessible. If you want offline support, consider self-hosting Tailwind.

### Issue: LocalStorage not persisting
**Solution**: 
- Check browser privacy settings
- Ensure you're not in incognito/private mode
- Verify domain is not `file://` (use a local server)
- Check localStorage quota (usually 5-10MB)

### Issue: File downloads don't work
**Solution**: Modern browsers may block downloads from certain contexts. Ensure the download is triggered by a user action (click event). The current implementation uses button clicks which should work.

### Issue: CORS errors when testing locally
**Solution**: Don't open `index.html` directly via `file://` protocol. Use a local server:
```bash
npm run serve
# or
npx serve -s public
```

---

## 📊 Performance Optimization

### Preload Critical Resources

Add to `<head>` in both HTML files:

```html
<link rel="preload" href="js/bundle.js" as="script">
```

### Cache Control

Most static hosts automatically cache assets. For optimal caching:

- `bundle.js` should have long cache headers (1 year) with content hash in filename
- Consider implementing cache-busting by renaming bundle with hash:
  ```bash
  # Update package.json build script:
  "build:client": "esbuild src/client/main.ts --bundle --outfile=public/js/bundle-[hash].js --minify --sourcemap"
  ```
  Then update HTML to reference the hashed filename (requires build step to inject correct filename)

---

## 🔒 Security Considerations

### Content Security Policy (CSP)

If you need CSP headers, add this to your hosting configuration:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
  font-src 'self' https://cdnjs.cloudflare.com;
  img-src 'self' data:;
">
```

### HTTPS

Always deploy with HTTPS enabled. All recommended hosts provide this automatically.

---

## 📈 Monitoring & Analytics

### Adding Analytics

Since there's no server, use client-side analytics:

#### Google Analytics
Add to `<head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

#### Plausible (Privacy-friendly)
```html
<script async defer data-domain="yourdomain.com" src="https://plausible.io/js/plausible.js"></script>
```

---

## 🚀 Advanced: CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v1.2
        with:
          publish-dir: './public'
          production-branch: main
          github-token: ${{ secrets.GITHUB_TOKEN }}
          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          netlify-site-id: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 🎯 Post-Deployment Checklist

After deploying, verify:

1. **Accessibility**: Visit your domain, both pages should load
2. **Functionality**: Test file upload, editing, and download
3. **Mobile**: Test on mobile devices
4. **Performance**: Check PageSpeed Insights score
5. **SEO**: Add meta tags if needed (currently minimal)
6. **Analytics**: Verify tracking is working
7. **HTTPS**: Confirm SSL certificate is valid
8. **CDN**: Check that assets are being served from CDN (if applicable)

---

## 📞 Support

If you encounter deployment issues:

1. Check browser console for errors
2. Verify all files uploaded correctly
3. Ensure MIME types are correct (especially `.js` files)
4. Test locally first with `npm run serve`
5. Consult your hosting provider's documentation

---

## 🔄 Updating Your Deployment

To update after making changes:

1. Make your changes to the code
2. Run `npm run build`
3. Upload the updated `/public` folder
4. Clear CDN cache if necessary (most hosts do this automatically)

For automated deployments, push to your connected repository branch and the host will build and deploy automatically.

---

**Happy Hosting!** 🎉