# Server-Side Tool Integration Guide

## Overview

This document explains how the server-side tool integration works for the AI chatbot, including authentication, role-based tool access, and API security.

## Authentication Flow

### 1. Frontend Authentication
- User logs in via Supabase Auth on the frontend
- Frontend obtains a JWT token from Supabase
- Token includes user metadata (role, email, user ID)

### 2. Server-Side Authentication
- Frontend sends requests to `/api/chat` with `Authorization: Bearer <token>` header
- Server validates the token using Supabase Auth API
- Server extracts user role from token metadata
- Role determines which tools are available to the AI agent

## Role-Based Tool Access

### Available Roles
- **admin**: Full access to all administrative tools
- **employee**: Limited access to employee-specific tools

### Tool Registry System

The tool system is modular and organized by role:

```
server/
├── tools/
│   ├── index.js          # Main registry and role-based tool selection
│   ├── admin/            # Admin-specific tools
│   │   ├── employees.js  # Employee management tools
│   │   └── tasks.js      # Task management tools
│   └── shared/           # Shared utilities and helpers
│       └── helpers.js    # Database helper functions
```

### Adding New Tools

1. **Create Tool File**: Add new tool file in appropriate role directory
2. **Register Tool**: Import and add to the tool registry in `tools/index.js`
3. **Define Schema**: Use Zod for input validation
4. **Implement Logic**: Write the tool implementation with proper error handling

Example tool structure:
```javascript
// tools/admin/example.js
export const exampleTool = {
  description: "Example tool description",
  parameters: z.object({
    param1: z.string().describe("Parameter description")
  }),
  execute: async ({ param1 }) => {
    // Tool implementation
    return { result: "success" };
  }
};
```

## Environment Variables

### Server Configuration
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
AI_MODEL=gpt-4o-2024-11-20
OPENAI_API_KEY=your_openai_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

### Security Notes
- **API Keys**: Never expose API keys client-side
- **Service Role**: Use service role key for server-side operations
- **JWT Validation**: Always validate tokens server-side
- **CORS**: Configure proper CORS origins for production

## API Endpoints

### POST /api/chat
- **Authentication**: Requires Bearer token
- **Request Body**: 
  ```json
  {
    "messages": [...],
    "role": "auto-detected-from-token"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "response": "AI response text",
    "usage": {...}
  }
  ```

### GET /api/health
- Health check endpoint
- No authentication required

## Testing

### Local Development
1. Start the server: `cd server && npm run dev`
2. Test authentication: Use Postman with valid JWT token
3. Verify tool integration: Test with role-specific queries

### Production Deployment
1. Set proper environment variables
2. Configure CORS for your production domain
3. Use service role key for database operations

## Troubleshooting

### Common Issues
1. **Authentication Failed**: Check JWT token validity
2. **Tool Not Available**: Verify user role and tool registration
3. **Database Errors**: Check Supabase connection and permissions

### Debugging
- Enable detailed logging in development
- Check server console for error messages
- Verify environment variables are set correctly