import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Send, Clock, User, Calendar, AlertCircle, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import ChatInterface from "./ChatInterface";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  deadline: string | null;
  assigned_to: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

interface TaskUpdate {
  id: string;
  update_text: string;
  progress: number;
  hours_logged: number | null;
  created_at: string;
  profiles?: {
    full_name: string;
  } | null;
}

interface TaskDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
  userId: string;
  isAdmin: boolean;
}

const TaskDialog = ({ task, open, onClose, userId, isAdmin }: TaskDialogProps) => {
  const [progress, setProgress] = useState(task.progress);
  const [updateText, setUpdateText] = useState("");
  const [hoursLogged, setHoursLogged] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  const loadTaskUpdates = async () => {
    setLoadingUpdates(true);
    try {
      const { data, error } = await supabase
        .from("task_updates")
        .select(`
          id,
          update_text,
          progress,
          hours_logged,
          created_at,
          user_id,
          profiles!task_updates_user_id_fkey (
            full_name
          )
        `)
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTaskUpdates((data as unknown as TaskUpdate[]) || []);
    } catch (error) {
      console.error("Error loading task updates:", error);
    } finally {
      setLoadingUpdates(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTaskUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task.id]);

  const handleUpdateProgress = async () => {
    setLoading(true);
    try {
      // Update task progress
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ progress, status: progress === 100 ? "completed" : "ongoing" })
        .eq("id", task.id);

      if (taskError) throw taskError;

      // Add update entry
      if (updateText.trim() || hoursLogged > 0) {
        const { error: updateError } = await supabase
          .from("task_updates")
          .insert({
            task_id: task.id,
            user_id: userId,
            update_text: updateText || `Progress updated to ${progress}%`,
            progress,
            hours_logged: hoursLogged > 0 ? hoursLogged : null,
          });

        if (updateError) throw updateError;
      }

      toast.success("Task updated successfully");
      setUpdateText("");
      setHoursLogged(0);
      loadTaskUpdates();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTask = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "accepted" })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Task accepted successfully");
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to accept task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTask = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "rejected" })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Task rejected");
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">{status}</Badge>;
      case "ongoing":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{status}</Badge>;
      case "accepted":
        return <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white">{status}</Badge>;
      case "invited":
      case "pending":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">{status}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{priority}</Badge>;
      case "medium":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">{priority}</Badge>;
      case "low":
        return <Badge variant="outline">{priority}</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{task.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                {getStatusBadge(task.status)}
                {getPriorityBadge(task.priority)}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Task Details */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-lg font-semibold">Description</Label>
                <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                {task.profiles && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-xs text-muted-foreground">Assigned To</Label>
                      <p className="text-sm font-medium">{task.profiles.full_name}</p>
                    </div>
                  </div>
                )}

                {task.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-xs text-muted-foreground">Deadline</Label>
                      <p className="text-sm font-medium">{new Date(task.deadline).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Progress</Label>
                    <p className="text-sm font-medium">{task.progress}%</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <p className="text-sm font-medium">{new Date(task.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">{task.progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div
                    className="bg-primary h-3 rounded-full transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accept/Reject for invited tasks */}
          {!isAdmin && task.assigned_to === userId && task.status === "invited" && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <p className="text-sm mb-4">You have been invited to work on this task. Do you want to accept?</p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAcceptTask}
                    disabled={loading}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept Task
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejectTask}
                    disabled={loading}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Update Progress (for assigned employees) */}
          {!isAdmin && task.assigned_to === userId && (task.status === "accepted" || task.status === "ongoing") && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">Update Progress</Label>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Progress: {progress}%</Label>
                        {progress === 100 && (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ready to Complete
                          </Badge>
                        )}
                      </div>
                      <Slider
                        value={[progress]}
                        onValueChange={(value) => setProgress(value[0])}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hours">Hours Worked (Optional)</Label>
                      <Input
                        id="hours"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="0.0"
                        value={hoursLogged || ""}
                        onChange={(e) => setHoursLogged(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="update">Progress Note</Label>
                      <Textarea
                        id="update"
                        placeholder="Describe what you've completed..."
                        value={updateText}
                        onChange={(e) => setUpdateText(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Button
                      onClick={handleUpdateProgress}
                      disabled={loading}
                      className="w-full"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {loading ? "Submitting..." : "Submit Update"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task History */}
          <Card>
            <CardContent className="pt-6">
              <Label className="text-lg font-semibold mb-4 block">Task History</Label>
              <ScrollArea className="h-[300px] pr-4">
                {loadingUpdates ? (
                  <p className="text-sm text-muted-foreground">Loading updates...</p>
                ) : taskUpdates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No updates yet</p>
                ) : (
                  <div className="space-y-4">
                    {taskUpdates.map((update) => (
                      <div key={update.id} className="border-l-2 border-primary pl-4 pb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">
                              {update.profiles?.full_name || "Unknown User"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(update.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {update.progress}%
                            </Badge>
                            {update.hours_logged && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {update.hours_logged}h
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm">{update.update_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Task Chat */}
          <Card>
            <CardContent className="pt-6">
              <Label className="text-lg font-semibold mb-4 block">Task Discussion</Label>
              <ChatInterface userId={userId} taskId={task.id} />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;