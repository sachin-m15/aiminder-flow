import { toast } from "sonner";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  success: boolean;
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export class ChatApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use provided baseUrl, or environment variable, or fallback to '/api'
    this.baseUrl = baseUrl || import.meta.env.VITE_BACKEND_URL || '/api';
  }

  async sendMessage(messages: ChatMessage[], role: 'admin' | 'employee' = 'employee', authToken?: string): Promise<ChatResponse> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if token is provided
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          role
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Chat API error:', error);
      toast.error("Failed to send message to server");
      return {
        success: false,
        response: "Sorry, I encountered an error. Please try again.",
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Create a singleton instance
export const chatApiClient = new ChatApiClient();