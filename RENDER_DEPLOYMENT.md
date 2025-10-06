# Render Deployment Guide

## 🚀 Deploy to Render

This guide walks you through deploying **Record Your Story** to Render's free tier.

---

## Prerequisites

✅ Render account ([signup here](https://render.com))
✅ Supabase project configured (see [SUPABASE_SETUP.md](SUPABASE_SETUP.md))
✅ GitHub repository (already at: `https://github.com/cwarloe/record-your-story`)

---

## Deployment Steps

### 1. Push Latest Code to GitHub

```bash
git add render.yaml RENDER_DEPLOYMENT.md
git commit -m "docs: add Render deployment configuration"
git push origin master
```

### 2. Create New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect to your GitHub repository: `cwarloe/record-your-story`
4. Render will auto-detect the `render.yaml` configuration

### 3. Configure Build Settings

Render should auto-populate these from `render.yaml`:

| Setting | Value |
|---------|-------|
| **Name** | `record-your-story` |
| **Environment** | `Static Site` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### 4. Add Environment Variables

In the Render dashboard, go to **"Environment"** tab and add:

| Key | Value | Where to Find |
|-----|-------|---------------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1N...` | Supabase Project Settings → API → anon public key |

> ⚠️ **Important**: These are **build-time** environment variables for Vite. They get baked into the bundle during build.

### 5. Deploy!

Click **"Create Web Service"** and Render will:
1. Clone your repo
2. Run `npm install && npm run build`
3. Serve the `dist` folder
4. Provide a live URL: `https://record-your-story.onrender.com`

---

## Verify Deployment

After deployment completes:

1. Visit your Render URL
2. Try signing up with a test account
3. Create a test event with photo
4. Test undo/redo (Ctrl+Z)
5. Test dark mode toggle
6. Test export PDF
7. Check keyboard shortcuts (press `?`)

---

## Update Supabase Allowed URLs

Add your Render URL to Supabase's allowed authentication redirect URLs:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to: **Authentication** → **URL Configuration**
3. Add to **Site URL**: `https://record-your-story.onrender.com`
4. Add to **Redirect URLs**: `https://record-your-story.onrender.com/**`

---

## Continuous Deployment

Render automatically redeploys when you push to `master`:

```bash
# Make changes
git add .
git commit -m "feat: new feature"
git push origin master

# Render automatically rebuilds and deploys
```

---

## Free Tier Limitations

- **Cold starts**: Service spins down after 15 minutes of inactivity
- **Build minutes**: 500 free minutes/month (usually plenty for static sites)
- **Bandwidth**: 100GB/month free

---

## Troubleshooting

### Build Fails

Check Render build logs for errors:
- TypeScript errors → run `npm run build` locally first
- Missing dependencies → ensure `package.json` is up to date

### Blank Page After Deploy

1. Check browser console for errors
2. Verify environment variables are set correctly
3. Ensure Supabase URL is whitelisted in Supabase dashboard

### Authentication Not Working

- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check Supabase Auth settings allow your Render URL
- Confirm email confirmation is disabled for testing (or check email)

---

## Custom Domain (Optional)

To use your own domain:

1. Go to Render dashboard → **Settings** → **Custom Domain**
2. Add your domain (e.g., `timeline.yourdomain.com`)
3. Update DNS records as instructed by Render
4. Add custom domain to Supabase allowed URLs

---

## Need Help?

- [Render Documentation](https://render.com/docs/static-sites)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- Check [GitHub Issues](https://github.com/cwarloe/record-your-story/issues)
