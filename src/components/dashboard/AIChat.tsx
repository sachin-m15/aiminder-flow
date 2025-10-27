import { useState, useRef, useEffect } from "react";
import { Experimental_Agent as Agent } from 'ai';
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
import { AgentRegistry } from "@/api/chat/agents/registry";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatProps {
  userRole: "admin" | "employee";
}

const AIChat = ({ userRole }: AIChatProps) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get user role from database
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const currentUserRole = userRoleData?.role as 'admin' | 'employee' || userRole;

      // Get the appropriate agent for the user role
      const agent = AgentRegistry.getAgent(currentUserRole);

      // Prepare messages for agent
      const messagesForAgent = [
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user' as const, content: input }
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

      // Execute the agent directly in the browser using generate method
      console.log('🤖 AI Agent - Starting generate with messages:', messagesForAgent);
      const result = await agent.generate({
        messages: messagesForAgent,
      });

      console.log('🤖 AI Agent - Generate result:', result);
      
      // Update the assistant message with the complete response
      if (result.text) {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, content: result.text }
            : msg
        ));
        
        console.log('🤖 AI Agent - Final Response:', {
          contentLength: result.text.length,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('No text response from agent');
      }
      
      // Log final response
      console.log('🤖 AI Agent - Final Response:', {
        contentLength: result.text.length,
        timestamp: new Date().toISOString()
      });

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
    setMessages([]);
    toast.success("Chat cleared");
  };

  return (
    <div className="flex flex-col h-full w-full">
      <Card className="flex flex-col h-full w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-6 w-6" />
            <CardTitle>AI Assistant</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({userRole} mode)
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={clearChat}>
            Clear Chat
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 space-y-4 p-0">
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
                      <div className="text-sm prose">
                        <ReactMarkdown>
                          {message.content}
                        </ReactMarkdown>
                      </div>
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
          <form onSubmit={handleSubmit} className="flex gap-2 p-4 pt-0 flex-shrink-0">
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