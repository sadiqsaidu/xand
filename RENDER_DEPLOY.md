# Xandeum Explorer - Render Deployment Guide

## Quick Deploy to Render

### Step 1: Prepare Your Repository

1. Make sure all changes are committed:
```bash
git add -A
git commit -m "Prepare for Render deployment"
git push
```

### Step 2: Create Render Account

1. Go to [https://render.com](https://render.com)
2. Sign up with GitHub (easiest way)
3. Authorize Render to access your repositories

### Step 3: Deploy Backend

#### Option A: Using render.yaml (Recommended)

1. Click **"New +"** → **"Blueprint"**
2. Connect your repository: `sadiqsaidu/xand`
3. Render will automatically detect `render.yaml`
4. Click **"Apply"**
5. Set the **OPENROUTER_API_KEY** environment variable in the dashboard

#### Option B: Manual Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your repository: `sadiqsaidu/xand`
3. Configure:
   - **Name**: `xandeum-explorer-backend`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Root Directory**: Leave empty (uses repo root)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Environment Variables** - Click "Advanced" and add:
```
NODE_ENV=production
PORT=10000
HOST=0.0.0.0
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
ALLOWED_ORIGINS=https://xand-two.vercel.app,https://xand.vercel.app
SYNC_INTERVAL_MS=60000
LOG_LEVEL=info
```

5. Click **"Create Web Service"**

### Step 4: Get Your Backend URL

After deployment completes (5-10 minutes):
1. Your backend URL will be: `https://xandeum-explorer-backend.onrender.com`
2. Test it: `https://xandeum-explorer-backend.onrender.com/health`
3. Copy this URL for the next step

### Step 5: Update Vercel Frontend

1. Go to your Vercel dashboard
2. Select your `xand-two` project
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://xandeum-explorer-backend.onrender.com`
   - **Environment**: All (Production, Preview, Development)
5. Click **Save**
6. Go to **Deployments** → Click **"..."** → **"Redeploy"**

### Step 6: Verify Everything Works

1. Wait for Vercel redeploy (2-3 minutes)
2. Visit: `https://xand-two.vercel.app`
3. Check if data is loading
4. Open DevTools console - should see no errors

---

## Important Notes

### Free Tier Limitations

**Render Free Tier:**
- Spins down after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds (cold start)
- 750 hours/month free
- Enough for development and demo

**Solution for Cold Starts:**
- Use a cron service to ping `/health` every 10 minutes
- Or upgrade to paid tier ($7/month for always-on)

### Monitoring

**Check Backend Logs:**
1. Go to Render dashboard
2. Click your service
3. Click **"Logs"** tab
4. Watch real-time logs

**Check Frontend:**
- Vercel has built-in logs in the dashboard
- Use browser DevTools Network tab

### Troubleshooting

**Backend not responding:**
```bash
# Test health endpoint
curl https://xandeum-explorer-backend.onrender.com/health

# Test network endpoint
curl https://xandeum-explorer-backend.onrender.com/network
```

**CORS errors in frontend:**
1. Check `ALLOWED_ORIGINS` in Render includes your Vercel URL
2. Restart backend service on Render

**Frontend shows no data:**
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_API_URL` is set in Vercel
3. Test backend URL directly in browser

---

## Local Development

### Backend
```bash
# In /home/sadiq/projects/xand
cp .env.example .env
# Edit .env with your keys
npm install
npm run dev
# Backend runs on http://localhost:3000
```

### Frontend
```bash
# In /home/sadiq/projects/xand/xand-dashboard
cp .env.example .env.local
# Add: NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev
# Frontend runs on http://localhost:3001
```

---

## Environment Variables Reference

### Backend (.env)
```bash
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# AI
OPENROUTER_API_KEY=sk-or-v1-xxxxx
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:3001,https://xand-two.vercel.app

# Sync settings
SYNC_INTERVAL_MS=60000
```

### Frontend (.env.local)
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3000
# Or in production:
# NEXT_PUBLIC_API_URL=https://xandeum-explorer-backend.onrender.com
```

---

## API Endpoints

Base URL: `https://xandeum-explorer-backend.onrender.com`

### Explorer Endpoints
- `GET /health` - Health check
- `GET /network` - Network stats + all nodes
- `GET /network/summary` - Summary only
- `GET /nodes` - All nodes (with sorting/pagination)
- `GET /node/:ip` - Single node details
- `GET /search?country=US&status=online` - Search nodes
- `GET /map` - Geographic markers

### AI Endpoints
- `POST /ai/search` - Natural language search
- `POST /ai/diagnose` - Node diagnostics
- `GET /ai/briefing` - Network briefing
- `POST /ai/ask` - General AI questions
- `POST /ai/explain/:ip` - Explain node

---

## Production Checklist

- [ ] Backend deployed on Render
- [ ] Backend health endpoint responding
- [ ] Environment variables set on Render
- [ ] Frontend redeployed on Vercel with API URL
- [ ] CORS configured correctly
- [ ] Data loading in frontend
- [ ] No console errors
- [ ] All pages working (Network, Nodes, Map, AI)

Done! 🎉
