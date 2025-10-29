# Vercel Deployment Guide for Aiminder Flow

This guide will help you deploy your full-stack React + Express application to Vercel.

## Prerequisites

1. Vercel account (free tier available)
2. GitHub account (for connecting repository)
3. All environment variables configured

## Step 1: Prepare Your Repository

Ensure your code is pushed to a GitHub repository. Vercel integrates seamlessly with GitHub.

## Step 2: Environment Variables Setup

### Frontend Environment Variables (Vercel Dashboard)
Add these to your Vercel project settings:

```
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_OPENAI_API_KEY=your-openai-api-key-here
VITE_AI_MODEL=gpt-4o-2024-11-20
VITE_MAX_TOKENS=4096
VITE_TEMPERATURE=0.7
VITE_MAX_STEPS=10
VITE_CHATBOT_API_URL=/api/chat
```

### Backend Environment Variables (Vercel Dashboard)
Add these to your Vercel project settings:

```
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
AI_MODEL=gpt-4o-2024-11-20
OPENAI_API_KEY=your-openai-api-key
CHUTES_API_KEY=your-chutes-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

## Step 3: Deploy to Vercel

### Option A: Vercel CLI (Recommended)
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

### Option B: GitHub Integration
1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the `vercel.json` configuration
3. Set up environment variables in the Vercel dashboard
4. Deploy automatically on every push to main branch

## Step 4: Verify Deployment

1. **Frontend**: Your React app will be available at `https://your-app.vercel.app`
2. **Backend API**: Your Express server will be available at `https://your-app.vercel.app/api/*`

## Step 5: Update Supabase Configuration

Update your Supabase project settings to allow your Vercel domain:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your Vercel URL to:
   - Site URL
   - Redirect URLs
   - Allowed redirect URLs

## Important Notes

1. **CORS**: The server is configured to accept requests from your Vercel domain in production
2. **File Structure**: Vercel will serve the frontend from `/` and route API requests to `/api/*`
3. **Build Process**: Vercel will automatically run `npm run build` for the frontend
4. **Serverless Functions**: The Express server runs as a serverless function with 30s timeout

## Troubleshooting

### Common Issues:

1. **Environment Variables**: Double-check all environment variables are set correctly
2. **CORS Errors**: Ensure `FRONTEND_URL` matches your Vercel deployment URL
3. **Build Failures**: Check that all dependencies are properly installed
4. **API Timeouts**: The server has a 30s timeout limit for API calls

### Debugging:

- Check Vercel deployment logs in the dashboard
- Use `vercel logs` command to view real-time logs
- Test API endpoints directly using curl or Postman

## Post-Deployment Checklist

- [ ] Frontend loads without errors
- [ ] API endpoints respond correctly
- [ ] Authentication works with Supabase
- [ ] AI chat functionality works
- [ ] All environment variables are set
- [ ] CORS is properly configured
- [ ] Error handling is working

Your application should now be fully deployed and functional on Vercel!