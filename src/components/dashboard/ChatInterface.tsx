import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  message: string;
  is_ai: boolean;
  created_at: string;
  user_id: string;
}

interface ChatInterfaceProps {
  userId: string;
  taskId?: string;
}

const ChatInterface = ({ userId, taskId }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    const channel = supabase
      .channel("chat_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: taskId ? `task_id=eq.${taskId}` : undefined,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const query = supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (taskId) {
      query.eq("task_id", taskId);
    } else {
      query.is("task_id", null);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load messages");
      return;
    }

    setMessages(data || []);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      // Insert user message
      const { error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          user_id: userId,
          message: input,
          task_id: taskId || null,
          is_ai: false,
        });

      if (insertError) throw insertError;

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          message: input,
          taskId: taskId || null,
          userId 
        },
      });

      if (error) throw error;

      // Insert AI response
      if (data?.response) {
        await supabase.from("chat_messages").insert({
          user_id: userId,
          message: data.response,
          task_id: taskId || null,
          is_ai: true,
          metadata: data.metadata || {},
        });
      }

      setInput("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.is_ai ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  msg.is_ai
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <p className="text-sm">{msg.message}</p>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ChatInterface;