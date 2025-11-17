# Secure Server-Side API Implementation for AI Chatbot

## Overview

This document describes the secure server-side implementation for the AI chatbot that prevents OpenAI API key leakage in client-side bundles.

## Problem Solved

Previously, the chatbot was using the OpenAI API key directly in the client-side code via `import.meta.env.VITE_OPENAI_API_KEY`, which exposes the API key in production bundles and poses a security risk.

## Solution Architecture

### Server-Side Components

1. **Express API Server** (`server/api.js`)
   - Handles all OpenAI API requests
   - Uses server-side environment variables for API keys
   - Provides RESTful endpoints for chat completion

2. **API Client** (`src/api/chat/client.ts`)
   - Frontend client for communicating with the server API
   - Handles errors and provides proper TypeScript types

3. **Updated AIChat Component** (`src/components/dashboard/AIChat.tsx`)
   - Uses the secure API client instead of direct OpenAI calls
   - Maintains the same user experience

### Environment Variables

**Client-side (.env):**
```env
# Frontend environment variables (safe to expose)
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="your_supabase_url"
VITE_AI_MODEL="gpt-4o-2024-11-20"
```

**Server-side (server/.env):**
```env
# Server-side environment variables (never exposed to client)
OPENAI_API_KEY="your_actual_openai_api_key"
PORT=3001
NODE_ENV=development
FRONTEND_URL=$FRONTEND_URL
AI_MODEL=gpt-4o-2024-11-20
```

## API Endpoints

### Health Check
- **GET** `/api/health`
- Returns: `{ status: "OK", message: "API server is running" }`

### Chat Completion
- **POST** `/api/chat`
- Body: 
  ```json
  {
    "messages": [
      { "role": "user", "content": "Hello" }
    ],
    "role": "employee" // or "admin"
  }
  ```
- Returns:
  ```json
  {
    "success": true,
    "response": "AI response text",
    "usage": {
      "promptTokens": 10,
      "completionTokens": 20,
      "totalTokens": 30
    }
  }
  ```

## Development Setup

### Running the Application

1. **Start the API server:**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the frontend development server:**
   ```bash
   npm run dev
   ```

3. **Run both simultaneously:**
   ```bash
   npm run dev:full
   ```

### Environment Setup

1. Copy `server/.env.example` to `server/.env`
2. Add your OpenAI API key to `server/.env`:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
3. The frontend `.env` remains unchanged for client-side variables

## Security Benefits

1. **API Key Protection**: OpenAI API key is never exposed to the client
2. **CORS Protection**: Server validates request origins
3. **Rate Limiting**: Can be easily implemented on the server
4. **Request Validation**: Server validates all incoming requests
5. **Error Handling**: Centralized error handling and logging

## Production Deployment

### Vercel/Netlify Deployment
- The server should be deployed as a separate Node.js service
- Frontend builds remain static with API calls proxied to the server

### Environment Variables in Production
- Set `OPENAI_API_KEY` in your production environment
- Set `NODE_ENV=production`
- Set `FRONTEND_URL` to your production domain

## Testing

Test the API endpoints using:

```bash
# Health check
curl $API_URL/api/health

# Chat test (using the test script)
node test-api.js
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `FRONTEND_URL` is set correctly in server environment
2. **API Key Errors**: Verify `OPENAI_API_KEY` is set in server environment
3. **Port Conflicts**: Change `PORT` in server environment if 3001 is occupied

### Logs
- Server logs all API requests and OpenAI interactions
- Check console output for detailed error information

## Migration from Old Implementation

The migration maintains backward compatibility:
- Same component interface
- Same message structure
- Same user experience
- Only the underlying API communication changed

## Future Enhancements

1. Add rate limiting
2. Implement request caching
3. Add authentication middleware
4. Add request logging and analytics
5. Implement circuit breakers for OpenAI API failures