# AI Assistant Chat Feature

## Overview
The AI Assistant is a simple chatbot integrated into both the Admin and Employee dashboards. It uses an external API to provide intelligent responses based on the user's role and queries.

## Features
- **Role-based responses**: The chatbot receives the user's role (admin/employee) and provides contextually appropriate responses
- **Conversation persistence**: Maintains conversation context using conversation IDs
- **Real-time messaging**: Sends and receives messages with loading states
- **Message history**: Displays chat history in a clean, modern interface
- **Clear chat**: Option to clear conversation history and start fresh

## Setup

### 1. Environment Configuration
Add the chatbot API URL to your `.env` file:

```env
VITE_CHATBOT_API_URL="http://localhost:8000/chat"
```

### 2. API Requirements
The chatbot expects a POST request to the configured endpoint with the following JSON body:

```json
{
  "text": "User's message",
  "conversation_id": "uuid-string-or-null",
  "role": "admin" | "employee"
}
```

### 3. API Response Schema
The API should return a JSON response with the following structure:

```json
{
  "response": "AI assistant's response text",
  "conversation_id": "uuid-string",
  "requires_followup": true,
  "followup_question": "Optional follow-up question"
}
```

## Usage

### Accessing the Chat
- **Admin Dashboard**: Click "AI Assistant" in the sidebar or press `Ctrl+2` (or `Cmd+2` on Mac)
- **Employee Dashboard**: Click "AI Assistant" in the sidebar or press `Ctrl+1` (or `Cmd+1` on Mac)

### Sending Messages
1. Type your message in the input field at the bottom
2. Press Enter or click the Send button
3. Wait for the AI assistant's response

### Clearing Chat History
Click the "Clear Chat" button in the header to reset the conversation

## Technical Implementation

### Component Structure
- **Chat.tsx**: Main chat component used in both dashboards
- Maintains local state for messages and conversation ID
- Uses temporary memory storage (no database persistence)

### State Management
- Messages are stored in component state as an array
- Each message has: id, text, role, timestamp
- Conversation ID is maintained across messages

### Error Handling
- Network errors are caught and displayed to the user
- Error messages appear in the chat as assistant messages
- Toast notifications alert users of connection issues

## Development Notes

### Starting the Chatbot API
Ensure your chatbot API server is running on the configured URL before testing:

```bash
# Example: Start your Python/Node chatbot server
python chatbot_server.py
# or
node chatbot_server.js
```

### Testing Without API
If the API is not available, the chat will display error messages but won't crash the application.

### Future Enhancements
- Database persistence for chat history
- File upload support
- Rich message formatting (markdown, code blocks)
- Multi-language support
- Voice input/output
- Integration with task management (e.g., "Create a task for...")
- Analytics and usage tracking
