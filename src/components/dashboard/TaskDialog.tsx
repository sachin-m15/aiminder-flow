import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Clock, User, Calendar, AlertCircle, CheckCircle, XCircle, TrendingUp, Edit2, X as XIcon, Save } from "lucide-react";
// import ChatInterface from "./ChatInterface"; // TODO: Component not yet implemented
import { taskProgressSchema, type TaskProgressFormData } from "@/lib/validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import ErrorBoundary from "@/components/ui/error-boundary";

// Schema for task editing
const taskEditSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["low", "medium", "high"]),
  deadline: z.string().optional(),
});

type TaskEditFormData = z.infer<typeof taskEditSchema>;

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
  const [loading, setLoading] = useState(false);
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<TaskProgressFormData>({
    resolver: zodResolver(taskProgressSchema),
    defaultValues: {
      progress: task.progress,
      hoursLogged: 0,
      updateText: "",
    },
  });

  const editForm = useForm<TaskEditFormData>({
    resolver: zodResolver(taskEditSchema),
    defaultValues: {
      title: task.title,
      description: task.description,
      priority: task.priority as "low" | "medium" | "high",
      deadline: task.deadline || "",
    },
  });

  // Reset edit form when task changes
  useEffect(() => {
    editForm.reset({
      title: task.title,
      description: task.description,
      priority: task.priority as "low" | "medium" | "high",
      deadline: task.deadline || "",
    });
    setIsEditing(false);
  }, [task, editForm]);

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

  const handleUpdateProgress = async (data: TaskProgressFormData) => {
    setLoading(true);
    try {
      // Update task progress
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ progress: data.progress, status: data.progress === 100 ? "completed" : "ongoing" })
        .eq("id", task.id);

      if (taskError) throw taskError;

      // Add update entry
      if (data.updateText?.trim() || (data.hoursLogged && data.hoursLogged > 0)) {
        const { error: updateError } = await supabase
          .from("task_updates")
          .insert({
            task_id: task.id,
            user_id: userId,
            update_text: data.updateText || `Progress updated to ${data.progress}%`,
            progress: data.progress,
            hours_logged: data.hoursLogged > 0 ? data.hoursLogged : null,
          });

        if (updateError) throw updateError;
      }

      toast.success("Task updated successfully");
      form.reset();
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

  const handleSaveTaskEdit = async (data: TaskEditFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: data.title,
          description: data.description,
          priority: data.priority,
          deadline: data.deadline || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Task updated successfully");
      setIsEditing(false);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update task";
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
    <ErrorBoundary componentName="TaskDialog">
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent
          className="max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-2 md:mx-0"
          aria-labelledby="task-dialog-title"
          onOpenAutoFocus={(e) => {
            // Prevent auto-focus on first element, let user navigate naturally
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl" id="task-dialog-title">{task.title}</DialogTitle>
                <div className="flex items-center gap-2 mt-2" aria-label={`Status: ${task.status}, Priority: ${task.priority}`}>
                  {getStatusBadge(task.status)}
                  {getPriorityBadge(task.priority)}
                </div>
              </div>
              {isAdmin && !isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="ml-2"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Task
                </Button>
              )}
              {isAdmin && isEditing && (
                <div className="flex gap-2 ml-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      editForm.reset();
                    }}
                  >
                    <XIcon className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={editForm.handleSubmit(handleSaveTaskEdit)}
                    disabled={loading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 md:space-y-6 py-2 md:py-4">
            {/* Task Details or Edit Form */}
            {isEditing && isAdmin ? (
              <Card>
                <CardContent className="pt-4 md:pt-6">
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(handleSaveTaskEdit)} className="space-y-4">
                      <FormField
                        control={editForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Task Title *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter task title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Enter task description" rows={4} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority *</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={editForm.control}
                          name="deadline"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deadline</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  {...field}
                                  min={new Date().toISOString().split('T')[0]}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-4 md:pt-6 space-y-3 md:space-y-4">
                  <div>
                    <Label className="text-base md:text-lg font-semibold" id="task-description-label">Description</Label>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2" aria-labelledby="task-description-label">
                      {task.description}
                    </p>
                  </div>

                  <Separator aria-hidden="true" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {task.profiles && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <Label className="text-xs text-muted-foreground">Assigned To</Label>
                          <p className="text-sm font-medium" aria-label={`Assigned to: ${task.profiles.full_name}`}>
                            {task.profiles.full_name}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.deadline && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <Label className="text-xs text-muted-foreground">Deadline</Label>
                          <p className="text-sm font-medium" aria-label={`Deadline: ${new Date(task.deadline).toLocaleDateString()}`}>
                            {new Date(task.deadline).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <Label className="text-xs text-muted-foreground">Progress</Label>
                        <p className="text-sm font-medium" aria-label={`Progress: ${task.progress}%`}>
                          {task.progress}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <Label className="text-xs text-muted-foreground">Created</Label>
                        <p className="text-sm font-medium" aria-label={`Created: ${new Date(task.created_at).toLocaleDateString()}`}>
                          {new Date(task.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium" aria-hidden="true">{task.progress}%</span>
                    </div>
                    <div
                      className="w-full bg-secondary rounded-full h-3"
                      role="progressbar"
                      aria-valuenow={task.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Task progress: ${task.progress}%`}
                    >
                      <div
                        className="bg-primary h-3 rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Accept/Reject for invited tasks */}
            {!isAdmin && task.assigned_to === userId && task.status === "invited" && (
              <Card className="border-yellow-200 bg-yellow-50" role="region" aria-label="Task invitation">
                <CardContent className="pt-6">
                  <p className="text-sm mb-4">You have been invited to work on this task. Do you want to accept?</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAcceptTask}
                      disabled={loading}
                      className="flex-1"
                      aria-busy={loading}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      Accept Task
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRejectTask}
                      disabled={loading}
                      className="flex-1"
                      aria-busy={loading}
                    >
                      <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
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

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleUpdateProgress)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="progress"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between">
                                <FormLabel htmlFor="progress-slider">Progress: {field.value}%</FormLabel>
                                {field.value === 100 && (
                                  <Badge className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                                    Ready to Complete
                                  </Badge>
                                )}
                              </div>
                              <FormControl>
                                <Slider
                                  id="progress-slider"
                                  value={[field.value]}
                                  onValueChange={(value) => field.onChange(value[0])}
                                  max={100}
                                  step={5}
                                  className="w-full"
                                  aria-label="Update task progress"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="hoursLogged"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel htmlFor="hours-logged">Hours Worked (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  id="hours-logged"
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  placeholder="0.0"
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                                  aria-describedby="hours-logged-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="updateText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel htmlFor="progress-note">Progress Note</FormLabel>
                              <FormControl>
                                <Textarea
                                  id="progress-note"
                                  placeholder="Describe what you've completed..."
                                  {...field}
                                  rows={3}
                                  aria-describedby="progress-note-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full"
                          aria-busy={loading}
                        >
                          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                          {loading ? "Submitting..." : "Submit Update"}
                        </Button>
                      </form>
                    </Form>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Task History */}
            <Card>
              <CardContent className="pt-4 md:pt-6">
                <Label className="text-base md:text-lg font-semibold mb-3 md:mb-4 block" id="task-history-label">Task History</Label>
                <ScrollArea className="h-[200px] md:h-[300px] pr-4" aria-labelledby="task-history-label">
                  {loadingUpdates ? (
                    <p className="text-sm text-muted-foreground" aria-live="polite">Loading updates...</p>
                  ) : taskUpdates.length === 0 ? (
                    <p className="text-sm text-muted-foreground" aria-live="polite">No updates yet</p>
                  ) : (
                    <div className="space-y-4" role="list" aria-label="Task update history">
                      {taskUpdates.map((update) => (
                        <div key={update.id} className="border-l-2 border-primary pl-4 pb-4" role="listitem">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm" aria-label={`Updated by: ${update.profiles?.full_name || "Unknown User"}`}>
                                {update.profiles?.full_name || "Unknown User"}
                              </p>
                              <p className="text-xs text-muted-foreground" aria-label={`Date: ${new Date(update.created_at).toLocaleString()}`}>
                                {new Date(update.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs" aria-label={`Progress: ${update.progress}%`}>
                                {update.progress}%
                              </Badge>
                              {update.hours_logged && (
                                <Badge variant="outline" className="text-xs" aria-label={`Hours logged: ${update.hours_logged}`}>
                                  <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                                  {update.hours_logged}h
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm" aria-label="Update details">{update.update_text}</p>
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
                <Label className="text-lg font-semibold mb-4 block" id="task-chat-label">Task Discussion</Label>
                {/* TODO: Implement ChatInterface component */}
                <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-md">
                  Chat interface coming soon...
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
};

export default TaskDialog;