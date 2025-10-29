# Render Deployment Guide for Aiminder Backend

This guide explains how to deploy the Aiminder backend separately to Render.

## Prerequisites

- A Render account
- All required environment variables configured
- Your frontend URL (for CORS configuration)

## Deployment Steps

### 1. Prepare Your Repository
Ensure your repository has the following structure:
```
├── server/
│   ├── package.json
│   ├── api.js
│   ├── supabase.js
│   └── tools/
└── render.yaml
```

### 2. Required Environment Variables
You need to set these environment variables in Render dashboard:

**Required Variables:**
- `NODE_ENV`: production
- `PORT`: 3001
- `FRONTEND_URL`: Your frontend domain (e.g., https://your-app.vercel.app)
- `OPENAI_API_KEY`: Your OpenAI API key
- `GOOGLE_GENERATIVE_AI_API_KEY`: Your Google AI API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key

**Optional Variables:**
- `AI_MODEL`: Model name (default: gpt-4o-2024-11-20)
- `CHUTES_API_KEY`: Chutes AI API key (if using)

### 3. Deploy to Render

**Option A: Using render.yaml (Recommended)**
1. Push your code to GitHub
2. Connect your repository to Render
3. Render will automatically detect the `render.yaml` file
4. The service will be deployed with the specified configuration

**Option B: Manual Setup**
1. Go to Render dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure settings:
   - **Name**: aiminder-backend
   - **Environment**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free or paid based on your needs

### 4. Environment Variables Setup
In Render dashboard, go to your service → Environment → Add Environment Variables:

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com
OPENAI_API_KEY=your-openai-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### 5. Verify Deployment
After deployment, test your API endpoints:

```bash
# Health check
curl https://your-render-service.onrender.com/api/health

# Test chat endpoint (with proper authentication)
curl -X POST https://your-render-service.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### 6. Update Frontend Configuration
Update your frontend to use the Render backend URL:

```javascript
// In your frontend configuration
const CHATBOT_API_URL = "https://your-render-service.onrender.com/api/chat";
```

### 7. Troubleshooting

**Common Issues:**
- **Build fails**: Check that all dependencies are in server/package.json
- **Environment variables missing**: Verify all required variables are set in Render
- **CORS errors**: Ensure FRONTEND_URL is correctly set to your frontend domain
- **Port issues**: Render automatically sets PORT, but our config uses 3001

**Logs:**
Check deployment logs in Render dashboard under your service → Logs

### 8. Custom Domain (Optional)
If you want a custom domain:
1. Go to your service in Render dashboard
2. Click on Settings → Custom Domains
3. Add your domain and configure DNS settings

## File Structure for Render
- `render.yaml`: Render deployment configuration
- `server/package.json`: Backend dependencies and scripts
- `server/api.js`: Main Express server file
- `server/supabase.js`: Supabase client configuration

The backend is now ready to handle AI chat requests from your frontend application!