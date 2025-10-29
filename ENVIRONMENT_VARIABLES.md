# Environment Variables for Vercel Deployment

## Frontend Environment Variables (Client-side)

Add these to your Vercel project settings under "Environment Variables":

### Supabase Configuration
```
VITE_SUPABASE_PROJECT_ID=your-project-id-here
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
VITE_SUPABASE_URL=https://your-project.supabase.co
```

### OpenAI/AI Configuration
```
VITE_OPENAI_API_KEY=your-openai-api-key-here
VITE_AI_MODEL=gpt-4o-2024-11-20
VITE_MAX_TOKENS=4096
VITE_TEMPERATURE=0.7
VITE_MAX_STEPS=10
```

### API Configuration
```
VITE_CHATBOT_API_URL=/api/chat
```

## Backend Environment Variables (Server-side)

Add these to your Vercel project settings under "Environment Variables":

### Server Configuration
```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### AI Model Configuration
```
AI_MODEL=gpt-4o-2024-11-20
OPENAI_API_KEY=your-openai-api-key-here
CHUTES_API_KEY=your-chutes-api-key-here
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key-here
```

### Supabase Configuration (Server-side)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key-here
```

## How to Get These Values:

### Supabase Values:
1. Go to your Supabase project dashboard
2. Settings → API → Project URL → `VITE_SUPABASE_URL` and `SUPABASE_URL`
3. Settings → API → Project API keys → 
   - `anon public` key → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY` (keep this secret!)
   - Project ID → `VITE_SUPABASE_PROJECT_ID`

### OpenAI API Key:
1. Go to https://platform.openai.com/api-keys
2. Create a new API key → `VITE_OPENAI_API_KEY` and `OPENAI_API_KEY`

### Google Generative AI Key:
1. Go to https://makersuite.google.com/app/apikey
2. Create API key → `GOOGLE_GENERATIVE_AI_API_KEY`

### Chutes API Key:
1. Get from Chutes AI platform → `CHUTES_API_KEY`

## Important Notes:

1. **Security**: Never commit actual API keys to version control
2. **Vercel Dashboard**: Set these in your Vercel project settings
3. **Different Values**: Frontend and backend may need different values for the same service
4. **Production Values**: Use production API keys, not development/test keys
5. **FRONTEND_URL**: Update this to match your actual Vercel deployment URL

## Verification:

After deployment, check that:
- Frontend loads without console errors
- API endpoints return proper responses
- Authentication works with Supabase
- AI chat functionality is operational