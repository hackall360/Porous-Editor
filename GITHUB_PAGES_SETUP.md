# GitHub Pages Setup Guide for Porous Editor

This guide covers setting up GitHub Pages for automatic deployment of your Porous Editor application.

## Prerequisites

- GitHub repository with your code pushed (already done)
- GitHub Pages feature enabled (free for all accounts)
- Actions workflow created (`.github/workflows/deploy.yml`)

## Step-by-Step Setup

### 1. Enable GitHub Pages in Repository Settings

1. Go to your repository on GitHub: `https://github.com/hackall360/Porous-Editor`
2. Click on **Settings** tab
3. In the left sidebar, click on **Pages**
4. Under **Build and deployment**:
   - **Source**: Select `GitHub Actions`
5. Click **Save**

### 2. Verify the Workflow

The workflow file `.github/workflows/deploy.yml` will automatically trigger on:
- Pushes to the `main` branch
- Manual dispatch via GitHub Actions UI

### 3. First Deployment

1. Push a commit to the `main` branch (if you haven't already):
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. Wait for the GitHub Actions workflow to complete:
   - Go to the **Actions** tab in your repository
   - You should see a workflow running named "Deploy to GitHub Pages"
   - Wait for it to show a green checkmark ✓

3. Once complete, your site will be live at:
   ```
   https://hackall360.github.io/Porous-Editor/
   ```

### 4. Custom Domain (Optional)

If you want to use a custom domain:

1. In **Settings > Pages**:
   - Under **Custom domain**, enter your domain (e.g., `saveforge.example.com`)
   - Check **Enforce HTTPS** (recommended)
   - Click **Save**

2. In your domain registrar/DNS provider, add these records:
   ```
   Type: A
   Name: @
   Value: 185.199.108.153
   
   Type: A
   Name: @
   Value: 185.199.109.153
   
   Type: A
   Name: @
   Value: 185.199.110.153
   
   Type: A
   Name: @
   Value: 185.199.111.153
   
   Type: CNAME
   Name: www
   Value: hackall360.github.io
   ```

   (These are GitHub's IP addresses - they may change, check GitHub docs for current values)

3. Wait for DNS propagation (up to 24 hours, usually minutes)

### 5. Verify Deployment

After deployment:

1. Visit your GitHub Pages URL
2. Test the application:
   - Upload a save file
   - Edit values
   - Download the edited save
3. Check browser console for any errors (F12)

## Troubleshooting

### Workflow Fails

**Check the Actions log:**
1. Go to **Actions** tab
2. Click on the failed workflow
3. Look at the error message in the logs

**Common issues:**
- **Node.js version mismatch**: Ensure `node-version: '18'` in workflow
- **Build errors**: Run `npm run build` locally to test
- **Missing dependencies**: Run `npm ci` locally to verify

### 404 Errors

**Pages not found:**
1. Ensure **Settings > Pages** source is set to `GitHub Actions`
2. Wait 2-3 minutes after workflow completes
3. Check that the artifact was uploaded successfully in the workflow logs

### Site Shows Old Version

**Cache issues:**
1. GitHub Pages caches assets aggressively
2. Try hard refresh: `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. Or add cache-busting query string: `?v=2`

### Build Artifacts Missing

**Check the workflow:**
1. In the Actions log, look for "Upload artifact" step
2. Ensure `path: './public'` is correct
3. Verify that `npm run build` creates the `public/js/bundle.js` file

## Manual Deployment (Alternative)

If you prefer manual deployment instead of GitHub Actions:

1. Build the project locally:
   ```bash
   npm run build
   ```

2. Copy the `public` folder to the `docs` folder in your repository:
   ```bash
   cp -r public docs
   ```

3. Commit and push:
   ```bash
   git add docs
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

4. In **Settings > Pages**, set source to `main` branch `/docs` folder

## Advanced Configuration

### Custom 404 Page

Create a `404.html` in your `public` folder to customize the 404 page.

### Redirects

Create a `_redirects` file in `public` for URL redirects:
```
/old-page.html  /new-page.html  301
```

### Caching Headers

Create a `_headers` file in `public`:
```
/js/bundle.js
  Cache-Control: public, max-age=31536000, immutable
```

## Workflow Customization

### Change Build Command

Edit `.github/workflows/deploy.yml`:
```yaml
- name: Build
  run: npm run build:production  # Change this
```

### Add Environment Variables

If your build needs environment variables:
```yaml
- name: Build
  run: npm run build
  env:
    NODE_ENV: production
    CUSTOM_VAR: value
```

### Deploy to Subdirectory

If you want to deploy to a subdirectory (e.g., `/saveforge` instead of root):

1. In `index.html` and `editor.html`, update the base path if needed
2. In workflow, the `path: './public'` remains the same
3. GitHub Pages will serve from the repository root by default

## Monitoring

### Check Deployment Status

1. Go to **Actions** tab
2. See latest workflow run status
3. Click on the run to see detailed logs

### View Live Site

Once deployed, your site will be available at:
```
https://hackall360.github.io/Porous-Editor/
```

Replace `hackall360` with your GitHub username and `Porous-Editor` with your repository name.

## Unpublishing

To disable GitHub Pages:

1. Go to **Settings > Pages**
2. Under **Build and deployment**, change **Source** to `None`
3. Click **Save**

The site will be taken down immediately.

## Support

If you encounter issues:
1. Check the [GitHub Pages documentation](https://docs.github.com/en/pages)
2. Review the Actions workflow logs carefully
3. Test the build locally first: `npm run build`
4. Ensure all files are in the `public` directory before deployment

---

**Ready to deploy?** Just push to `main` and let GitHub Actions do the rest! 🚀