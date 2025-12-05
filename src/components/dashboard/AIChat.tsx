import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { chatApiClient, ChatMessage as ApiChatMessage } from "@/api/chat/client";
import { useAuthStore } from "@/stores/authStore";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isApprovalRequest?: boolean;
}

interface AIChatProps {
  userRole: "admin" | "employee";
}

const AIChat = ({ userRole }: AIChatProps) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // Helper function to detect approval request messages
  const isApprovalRequest = (content: string): boolean => {
    const approvalPatterns = [
      /would you like me to/i,
      /please reply with "yes"/i,
      /do you want me to/i,
      /should i proceed/i,
      /confirm.*assign/i,
      /confirm.*create/i
    ];
    return approvalPatterns.some(pattern => pattern.test(content));
  };

  // Handle approval button clicks
  const handleApprovalResponse = async (response: "yes" | "no") => {
    if (isLoading) return;

    // Add user response message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: response,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Get current session for authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !user) throw new Error("User not authenticated");

      // Prepare messages for server API including the approval response
      const messagesForApi: ApiChatMessage[] = [
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: response }
      ];

      // Add initial assistant message with empty content
      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Send request to server-side API
      const result = await chatApiClient.sendMessage(messagesForApi, userRole, session.access_token);

      if (result.success) {
        // Update the assistant message with the complete response
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, content: result.response, isApprovalRequest: isApprovalRequest(result.response) }
            : msg
        ));
      } else {
        throw new Error(result.error || 'Failed to get response from server');
      }

    } catch (error) {
      console.error("Error processing approval response:", error);
      toast.error("Failed to process response");

      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get user-specific localStorage key
  const getStorageKey = (userId: string) => `ai-chat-messages-${userId}`;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages from localStorage when user changes
  useEffect(() => {
    if (!user?.id) {
      setMessages([]);
      return;
    }

    try {
      const saved = localStorage.getItem(getStorageKey(user.id));
      if (saved) {
        const parsed = JSON.parse(saved);
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          isApprovalRequest: msg.isApprovalRequest || (msg.role === 'assistant' && isApprovalRequest(msg.content))
        }));
        setMessages(messagesWithDates);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.warn('Failed to load chat messages from localStorage:', error);
      setMessages([]);
    }
  }, [user?.id]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (!user?.id) return;

    try {
      localStorage.setItem(getStorageKey(user.id), JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save chat messages to localStorage:', error);
    }
  }, [messages, user?.id]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    // Log user input
    console.log('🤖 AI Agent - User Input:', {
      message: input,
      timestamp: new Date().toISOString(),
      userRole
    });

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Get current session for authentication token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !user) throw new Error("User not authenticated");

      // Use the user role from props or fallback to stored role
      const currentUserRole = userRole;

      // Prepare messages for server API
      const messagesForApi: ApiChatMessage[] = [
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: input }
      ];

      // Add initial assistant message with empty content
      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Send request to server-side API
      console.log('🤖 AI Agent - Sending to server API:', {
        messagesCount: messagesForApi.length,
        role: currentUserRole
      });

      const result = await chatApiClient.sendMessage(messagesForApi, currentUserRole, session.access_token);

      if (result.success) {
        // Update the assistant message with the complete response
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, content: result.response, isApprovalRequest: isApprovalRequest(result.response) }
            : msg
        ));

        console.log('🤖 AI Agent - Approval Response:', {
          response,
          newContentLength: result.response.length,
          timestamp: new Date().toISOString()
        });

        console.log('🤖 AI Agent - Server Response:', {
          contentLength: result.response.length,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(result.error || 'Failed to get response from server');
      }

    } catch (error) {
      console.error("🤖 AI Agent - Error:", error);
      toast.error("Failed to process message");

      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (!user?.id) return;

    setMessages([]);
    localStorage.removeItem(getStorageKey(user.id));
    toast.success("Chat cleared");
  };

  return (
    <div className="flex flex-col h-full w-full">
      <Card className="flex flex-col h-full w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-6 w-6" />
            <CardTitle className="relative">AI Assistant</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({userRole} mode)
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={clearChat}>
            Clear Chat
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 p-0 relative">
          {/* Messages Area - Takes most of the space */}
          <ScrollArea className="flex-1 rounded-lg border">
            <div className="p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8 h-full flex items-center justify-center">
                  <div>
                    <Bot className="h-12 w-12 mx-auto mb-2" />
                    <p>How can I help you today?</p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-md",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "assistant" ? (
                      message.isApprovalRequest ? (
                        <div className="space-y-3">
                          <div className="text-sm prose">
                            <ReactMarkdown>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprovalResponse("yes")}
                              disabled={isLoading}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApprovalResponse("no")}
                              disabled={isLoading}
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              No
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm prose">
                          <ReactMarkdown>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>

                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area - Fixed at bottom */}
          <form onSubmit={handleSubmit} className="sticky bottom-0 left-0 right-0 flex gap-2 p-4 bg-background border-t">
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIChat;