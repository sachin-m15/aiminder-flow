import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Check, X, ListTodo, CheckCircle, XCircle, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  deadline: string;
  assigned_to: string;
  created_by: string;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  matchScore: number;
}

interface Message {
  id: string;
  message: string;
  is_ai: boolean;
  created_at: string;
  metadata?: {
    suggestedEmployees?: Employee[];
    taskData?: Partial<Task>;
    tasks?: Task[];
    taskStatus?: Task;
  };
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
  const [pendingTaskData, setPendingTaskData] = useState<Partial<Task> | null>(null);
  const [userTasks, setUserTasks] = useState<Task[]>([]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .or(`user_id.eq.${userId},is_ai.eq.true`)
      .is("task_id", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) setMessages(data as Message[]);
  }, [userId]);

  const loadUserTasks = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setUserTasks(data as Task[]);
  }, [userId]);

  useEffect(() => {
    loadMessages();
    loadUserTasks();

    const channel = supabase
      .channel("chat-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        loadMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadMessages, loadUserTasks]);

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      toast.error(errorMessage);
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: List my tasks
  const handleShowMyTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          userId,
          action: "list_my_tasks",
        },
      });

      if (error) throw error;

      // Insert AI response
      await supabase.from("chat_messages").insert({
        user_id: null,
        message: data.message || "Here are your tasks",
        is_ai: true,
        metadata: { tasks: data.tasks },
      });

      loadUserTasks();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load tasks";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Accept task
  const handleAcceptTask = async (taskId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          userId,
          action: "accept_task",
          actionData: { taskId },
        },
      });

      if (error) throw error;

      toast.success("Task accepted!");
      loadUserTasks();

      // Insert AI response
      await supabase.from("chat_messages").insert({
        user_id: null,
        message: data.message || "✅ Task accepted successfully!",
        is_ai: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to accept task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Reject task
  const handleRejectTask = async (taskId: string, reason?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          userId,
          action: "reject_task",
          actionData: { taskId, reason: reason || "Not suitable at this time" },
        },
      });

      if (error) throw error;

      toast.success("Task rejected");
      loadUserTasks();

      // Insert AI response
      await supabase.from("chat_messages").insert({
        user_id: null,
        message: data.message || "❌ Task rejected",
        is_ai: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Quick action: Get task status
  const handleGetTaskStatus = async (taskId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          userId,
          action: "get_task_status",
          actionData: { taskId },
        },
      });

      if (error) throw error;

      // Insert AI response
      await supabase.from("chat_messages").insert({
        user_id: null,
        message: data.message || "Task status retrieved",
        is_ai: true,
        metadata: { taskStatus: data.task },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get task status";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Quick Action Buttons */}
      <div className="border-b p-3 bg-muted/30">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleShowMyTasks}
            disabled={loading}
          >
            <ListTodo className="h-4 w-4 mr-1" />
            My Tasks
          </Button>
          {userTasks.filter(t => t.status === "pending").length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {userTasks.filter(t => t.status === "pending").length} pending
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.is_ai ? "justify-start" : "justify-end"}`}
          >
            <Card className={`max-w-[80%] ${msg.is_ai ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
              <CardContent className="p-3">
                <div className="whitespace-pre-wrap text-sm">{msg.message}</div>

                {/* Task Assignment Suggestions */}
                {msg.metadata?.suggestedEmployees && msg.metadata.taskData && (
                  <div className="mt-3 space-y-2">
                    {msg.metadata.suggestedEmployees.slice(0, 1).map((emp) => (
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

                {/* Task List Display */}
                {msg.metadata?.tasks && Array.isArray(msg.metadata.tasks) && (
                  <div className="mt-3 space-y-2">
                    {msg.metadata.tasks.map((task) => (
                      <Card key={task.id} className="bg-background">
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-sm font-medium">
                              {task.title}
                            </CardTitle>
                            <Badge
                              variant={
                                task.status === "pending" ? "secondary" :
                                  task.status === "accepted" ? "default" :
                                    task.status === "rejected" ? "destructive" :
                                      "outline"
                              }
                            >
                              {task.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Due: {new Date(task.deadline).toLocaleDateString()}
                          </div>

                          {/* Action Buttons for Pending Tasks */}
                          {task.status === "pending" && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleAcceptTask(task.id)}
                                disabled={loading}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectTask(task.id)}
                                disabled={loading}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}

                          {/* Check Status Button for All Tasks */}
                          {task.status !== "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleGetTaskStatus(task.id)}
                              disabled={loading}
                              className="w-full"
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Check Status
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Task Status Display */}
                {msg.metadata?.taskStatus && (
                  <Card className="mt-3 bg-background">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm">Task Status Details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Progress:</span>
                        <span className="font-medium">{msg.metadata.taskStatus.progress}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline">{msg.metadata.taskStatus.status}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Priority:</span>
                        <Badge
                          variant={
                            msg.metadata.taskStatus.priority === "high" ? "destructive" :
                              msg.metadata.taskStatus.priority === "medium" ? "default" :
                                "secondary"
                          }
                        >
                          {msg.metadata.taskStatus.priority}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
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
