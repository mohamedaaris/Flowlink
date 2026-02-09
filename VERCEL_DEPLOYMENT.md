# Vercel Deployment Guide for FlowLink

## ✅ Build Errors Fixed

All TypeScript compilation errors have been resolved:
- ✅ Removed unused imports
- ✅ Added missing `username` field to device mapping
- ✅ Fixed null pointer issues
- ✅ Removed unused functions

**Build now succeeds**: `npm run build` completes without errors

---

## 📁 Project Structure

```
FlowLink/
├── frontend/          # React + Vite app (deploy to Vercel)
├── backend/           # Node.js WebSocket server (deploy to Railway)
├── mobile/            # Android app (not deployed)
└── vercel.json        # Vercel configuration
```

---

## 🚀 Deploying to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Click "Add New Project"**
3. **Import your GitHub repository**: `mohamedaaris/Flowlink`
4. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. **Environment Variables** (Important!):
   ```
   VITE_SIGNALING_URL=wss://your-backend-url.railway.app
   ```
   Replace `your-backend-url` with your Railway backend URL

6. **Click "Deploy"**

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from project root
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? flowlink-frontend
# - Directory? ./frontend
# - Override settings? No

# Deploy to production
vercel --prod
```

---

## ⚙️ Vercel Configuration

The `vercel.json` file in the root directory configures the deployment:

```json
{
  "version": 2,
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm install --prefix frontend",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**What this does**:
- Builds from the `frontend` directory
- Outputs to `frontend/dist`
- Enables client-side routing (SPA)

---

## 🔧 Environment Variables

### Required Environment Variables for Vercel:

1. **VITE_SIGNALING_URL** (Required)
   - Your Railway backend WebSocket URL
   - Format: `wss://your-backend.railway.app`
   - Example: `wss://flowlink-production.up.railway.app`

### How to Set Environment Variables:

**Via Vercel Dashboard**:
1. Go to your project settings
2. Click "Environment Variables"
3. Add: `VITE_SIGNALING_URL` = `wss://your-backend.railway.app`
4. Click "Save"
5. Redeploy

**Via Vercel CLI**:
```bash
vercel env add VITE_SIGNALING_URL
# Enter value: wss://your-backend.railway.app
# Select environments: Production, Preview, Development
```

---

## 🚂 Backend Deployment (Railway)

Your backend should be deployed separately to Railway:

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Create New Project**
3. **Deploy from GitHub**: Select `mohamedaaris/Flowlink`
4. **Configure**:
   - **Root Directory**: `backend`
   - **Start Command**: `npm start`
   - **Port**: `8080` (Railway auto-detects)

5. **Get your Railway URL**:
   - Example: `flowlink-production.up.railway.app`
   - Use this in Vercel's `VITE_SIGNALING_URL`

---

## 🔗 Connecting Frontend and Backend

### Frontend (Vercel) → Backend (Railway)

1. **Deploy backend to Railway first**
2. **Get Railway URL**: `https://your-backend.railway.app`
3. **Convert to WebSocket URL**: `wss://your-backend.railway.app`
4. **Set in Vercel**: `VITE_SIGNALING_URL=wss://your-backend.railway.app`
5. **Redeploy frontend**

### Testing the Connection

1. Open your Vercel URL: `https://your-app.vercel.app`
2. Open browser console
3. Look for: `App-level WebSocket connected for invitations`
4. If you see connection errors, check:
   - Railway backend is running
   - `VITE_SIGNALING_URL` is correct
   - Railway backend allows WebSocket connections

---

## 🐛 Troubleshooting

### Build Fails on Vercel

**Error**: TypeScript compilation errors
**Solution**: All fixed! Build should succeed now.

**Error**: `Cannot find module '@shared/types'`
**Solution**: Ensure `shared` folder is in the repository

### WebSocket Connection Fails

**Error**: `WebSocket connection failed`
**Possible Causes**:
1. Backend not running on Railway
2. Wrong `VITE_SIGNALING_URL` in Vercel
3. Railway backend not accepting WebSocket connections

**Solution**:
1. Check Railway logs: `railway logs`
2. Verify backend URL is correct
3. Test backend health: `curl https://your-backend.railway.app/health`

### Environment Variables Not Working

**Error**: Still connecting to `localhost`
**Solution**:
1. Verify `VITE_SIGNALING_URL` is set in Vercel
2. Redeploy after setting environment variables
3. Check browser console for actual URL being used

---

## 📊 Deployment Checklist

### Before Deploying:

- [x] Fix all TypeScript errors
- [x] Create `vercel.json` configuration
- [x] Test build locally: `npm run build`
- [ ] Deploy backend to Railway
- [ ] Get Railway backend URL
- [ ] Set `VITE_SIGNALING_URL` in Vercel

### After Deploying:

- [ ] Test WebSocket connection
- [ ] Test session creation
- [ ] Test invitations
- [ ] Test mobile-to-web notifications
- [ ] Test web-to-mobile notifications

---

## 🎯 Expected URLs

After deployment, you'll have:

- **Frontend (Vercel)**: `https://flowlink.vercel.app`
- **Backend (Railway)**: `https://flowlink-production.railway.app`
- **WebSocket**: `wss://flowlink-production.railway.app`

---

## 📝 Notes

1. **Free Tier Limits**:
   - Vercel: 100 GB bandwidth/month
   - Railway: $5 free credit/month

2. **Custom Domain** (Optional):
   - Add custom domain in Vercel dashboard
   - Update `VITE_SIGNALING_URL` if backend domain changes

3. **HTTPS/WSS Required**:
   - Vercel serves over HTTPS
   - Backend must use WSS (secure WebSocket)
   - Railway provides HTTPS/WSS by default

4. **CORS**:
   - Not needed for WebSocket connections
   - Backend already configured for cross-origin

---

## ✅ Deployment Complete!

Once deployed:
1. Frontend will be live on Vercel
2. Backend will be live on Railway
3. Users can access via Vercel URL
4. Mobile app connects to Railway backend

**Test the deployment**:
```bash
# Open frontend
open https://your-app.vercel.app

# Check backend health
curl https://your-backend.railway.app/health
```

---

## 🆘 Need Help?

If deployment fails:
1. Check Vercel build logs
2. Check Railway deployment logs
3. Verify environment variables
4. Test backend health endpoint
5. Check browser console for errors

All TypeScript errors are now fixed and the build succeeds! 🎉
