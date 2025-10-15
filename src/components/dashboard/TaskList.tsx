import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import TaskDialog from "./TaskDialog";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  deadline: string | null;
  assigned_to: string | null;
  profiles: {
    full_name: string;
  } | null;
}

interface TaskListProps {
  userId: string;
  isAdmin: boolean;
}

const TaskList = ({ userId, isAdmin }: TaskListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadTasks();

    const channel = supabase
      .channel("tasks")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isAdmin]);

  const loadTasks = async () => {
    let query = supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("assigned_to", userId);
    }

    const { data: tasksData, error } = await query;

    if (error) {
      toast.error("Failed to load tasks");
      return;
    }

    // Get assigned user profiles
    const assignedIds = tasksData?.filter(t => t.assigned_to).map(t => t.assigned_to) || [];
    
    if (assignedIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", assignedIds);

      const merged = tasksData?.map(task => ({
        ...task,
        profiles: task.assigned_to ? profileData?.find(p => p.id === task.assigned_to) || null : null
      })) || [];

      setTasks(merged);
    } else {
      const merged = tasksData?.map(task => ({ ...task, profiles: null })) || [];
      setTasks(merged);
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ 
        status: "accepted", 
        accepted_at: new Date().toISOString() 
      })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to accept task");
    } else {
      toast.success("Task accepted!");
      loadTasks();
    }
  };

  const handleRejectTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "rejected" })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to reject task");
    } else {
      toast.success("Task rejected");
      loadTasks();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "ongoing":
      case "accepted":
        return "bg-blue-500";
      case "invited":
      case "pending":
        return "bg-yellow-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.id} className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setSelectedTask(task)}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{task.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.description}
                </p>
              </div>
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {task.profiles && (
              <p className="text-sm">
                <span className="text-muted-foreground">Assigned to:</span>{" "}
                {task.profiles.full_name}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">{task.priority} priority</Badge>
              {task.deadline && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {new Date(task.deadline).toLocaleDateString()}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{task.progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>

            {!isAdmin && task.status === "invited" && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptTask(task.id);
                  }}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectTask(task.id);
                  }}
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {selectedTask && (
        <TaskDialog
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          userId={userId}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

export default TaskList;