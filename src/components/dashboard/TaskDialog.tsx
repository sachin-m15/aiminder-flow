import { useState } from "react";
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
import { toast } from "sonner";
import { Send } from "lucide-react";
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
  const [loading, setLoading] = useState(false);

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
      if (updateText.trim()) {
        const { error: updateError } = await supabase
          .from("task_updates")
          .insert({
            task_id: task.id,
            user_id: userId,
            update_text: updateText,
            progress,
          });

        if (updateError) throw updateError;
      }

      toast.success("Task updated successfully");
      setUpdateText("");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Description</Label>
            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
          </div>

          {!isAdmin && task.assigned_to === userId && (
            <>
              <div className="space-y-2">
                <Label>Progress: {progress}%</Label>
                <Slider
                  value={[progress]}
                  onValueChange={(value) => setProgress(value[0])}
                  max={100}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="update">Progress Update</Label>
                <Textarea
                  id="update"
                  placeholder="Describe what you've completed..."
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  rows={3}
                />
              </div>

              <Button onClick={handleUpdateProgress} disabled={loading} className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Submit Update
              </Button>
            </>
          )}

          <div className="border-t pt-4">
            <Label className="mb-2 block">Task Chat</Label>
            <ChatInterface userId={userId} taskId={task.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;