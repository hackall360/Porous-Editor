# GitHub Pages Quick Reference - SaveForge

## ✅ Prerequisites Done
- [x] Code pushed to GitHub repository
- [x] GitHub Actions workflow added (`.github/workflows/deploy.yml`)
- [x] Build verified locally (`npm run build`)

## 🚀 One-Time Setup (5 minutes)

### 1. Enable GitHub Pages
1. Go to: `https://github.com/hackall360/Porous-Editor/settings/pages`
2. Under **Build and deployment** → **Source**: Select `GitHub Actions`
3. Click **Save**

### 2. Trigger First Deployment
```bash
# Push to main branch (if not already done)
git push origin main
```

### 3. Wait for Deployment
1. Go to **Actions** tab in your repository
2. Wait for "Deploy to GitHub Pages" workflow to complete (✓)
3. Site will be live at: `https://hackall360.github.io/Porous-Editor/`

---

## 🔄 Subsequent Deployments

### Automatic (Recommended)
Every push to `main` branch automatically triggers deployment.

### Manual Trigger
1. Go to **Actions** tab
2. Select "Deploy to GitHub Pages" workflow
3. Click **Run workflow** → **Run workflow**

---

## 📍 Important URLs

| Resource | URL |
|-----------|-----|
| Repository | https://github.com/hackall360/Porous-Editor |
| Pages Settings | https://github.com/hackall360/Porous-Editor/settings/pages |
| Actions Log | https://github.com/hackall360/Porous-Editor/actions |
| Live Site | https://hackall360.github.io/Porous-Editor/ |

---

## 🐛 Troubleshooting

### Workflow Not Running?
- Ensure `Settings > Pages` source is set to `GitHub Actions`
- Check that the workflow file exists at `.github/workflows/deploy.yml`
- Verify you pushed to the `main` branch

### Deployment Failed?
1. Check Actions log for specific error
2. Test build locally: `npm run build`
3. Ensure `public/js/bundle.js` is created
4. Fix issues, commit, and push again

### 404 Error?
- Wait 2-3 minutes after workflow completes
- GitHub Pages can take a moment to propagate
- Hard refresh: `Ctrl+F5` or `Cmd+Shift+R`

### Site Shows Old Version?
- GitHub Pages caches aggressively
- Add `?v=2` to URL to bust cache
- Or clear browser cache completely

---

## 📁 What Gets Deployed

The workflow deploys the **entire `/public` directory**:
- `index.html` - Upload page
- `editor.html` - Editor page
- `js/bundle.js` - Compiled TypeScript (minified)
- `js/bundle.js.map` - Source map (for debugging)

---

## 🔧 Custom Domain (Optional)

1. **Settings > Pages** → Custom domain: `yourdomain.com`
2. **DNS settings** at your registrar:
   ```
   A @ 185.199.108.153
   A @ 185.199.109.153
   A @ 185.199.110.153
   A @ 185.199.111.153
   CNAME www hackall360.github.io
   ```
3. Check **Enforce HTTPS**
4. Wait for DNS propagation (up to 24h)

---

## 📊 Verify Deployment

After deployment, test:
- [ ] Homepage loads (`/`)
- [ ] Editor page loads (`/editor.html`)
- [ ] File upload works
- [ ] JSON files render structured editor
- [ ] Raw files render textarea
- [ ] Download button creates file
- [ ] No console errors (F12)

---

## 🎯 Quick Commands

```bash
# Local build test
npm run build

# Local serve test
npm run serve

# Push to trigger deployment
git push origin main

# View workflow status
# (check Actions tab on GitHub)
```

---

## 📝 Notes

- **Build time**: ~100ms
- **Bundle size**: ~5.6KB
- **No server needed**: 100% client-side
- **Free hosting**: GitHub Pages is free
- **Auto HTTPS**: GitHub provides SSL automatically

---

## 🆘 Need Help?

1. **Read full guide**: `GITHUB_PAGES_SETUP.md`
2. **Check logs**: Actions tab → latest workflow
3. **Test locally**: `npm run build && npm run serve`
4. **GitHub Docs**: https://docs.github.com/en/pages

---

**Your site will be live at:**  
**https://hackall360.github.io/Porous-Editor/**

After the first successful workflow run! 🚀