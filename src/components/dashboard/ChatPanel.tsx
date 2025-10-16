import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  message: string;
  is_ai: boolean;
  created_at: string;
  metadata?: any;
}

interface ChatPanelProps {
  userId: string;
  onTaskCreated?: () => void;
}

const ChatPanel = ({ userId, onTaskCreated }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingTaskData, setPendingTaskData] = useState<any>(null);

  useEffect(() => {
    loadMessages();
    
    const channel = supabase
      .channel("chat-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .or(`user_id.eq.${userId},is_ai.eq.true`)
      .is("task_id", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      // Insert user message
      await supabase.from("chat_messages").insert({
        user_id: userId,
        message: userMessage,
        is_ai: false,
      });

      // Call AI function
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { message: userMessage, userId },
      });

      if (error) throw error;

      // If task suggestions are returned, store them
      if (data.suggestedEmployees && data.taskData) {
        setPendingTaskData({
          ...data.taskData,
          suggestedEmployees: data.suggestedEmployees,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTask = async (employeeId: string, employeeName: string) => {
    if (!pendingTaskData) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          userId,
          action: "create_task",
          actionData: {
            ...pendingTaskData,
            assignedTo: employeeId,
            employeeName,
          },
        },
      });

      if (error) throw error;

      toast.success("Task created and invitation sent!");
      setPendingTaskData(null);
      if (onTaskCreated) onTaskCreated();
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.is_ai ? "justify-start" : "justify-end"}`}
          >
            <Card className={`max-w-[80%] p-3 ${msg.is_ai ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
              <div className="whitespace-pre-wrap text-sm">{msg.message}</div>
              
              {msg.metadata?.suggestedEmployees && msg.metadata.taskData && (
                <div className="mt-3 space-y-2">
                  {msg.metadata.suggestedEmployees.slice(0, 1).map((emp: any) => (
                    <div key={emp.id} className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveTask(emp.id, emp.name)}
                        disabled={loading}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve & Send to {emp.name}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingTaskData(null)}
                        disabled={loading}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message or describe a task..."
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
