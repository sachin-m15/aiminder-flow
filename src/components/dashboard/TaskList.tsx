import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Filter, ArrowUpDown, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
}

interface TaskListProps {
  userId: string;
  isAdmin: boolean;
  searchQuery?: string;
}

const TaskList = ({ userId, isAdmin, searchQuery = "" }: TaskListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");

  const loadTasks = useCallback(async () => {
    let query = supabase
      .from("tasks")
      .select("*");

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
  }, [userId, isAdmin]);

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
  }, [loadTasks]);

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

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return null;
    const daysUntil = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { text: "Overdue", color: "text-red-500" };
    if (daysUntil === 0) return { text: "Due today", color: "text-orange-500" };
    if (daysUntil <= 3) return { text: `${daysUntil} days left`, color: "text-yellow-500" };
    return { text: `${daysUntil} days left`, color: "text-muted-foreground" };
  };

  // Apply filters and search
  let filteredTasks = tasks.filter((task) => {
    // Search filter
    const matchesSearch = !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.profiles?.full_name.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;

    // Priority filter
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Apply sorting
  filteredTasks = filteredTasks.sort((a, b) => {
    switch (sortBy) {
      case "deadline": {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      case "priority": {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return (priorityOrder[a.priority as keyof typeof priorityOrder] || 3) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] || 3);
      }
      case "progress":
        return b.progress - a.progress;
      case "created_at":
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return (
    <div className="space-y-4">
      {/* Filter and Sort Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & Sorting
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <ArrowUpDown className="h-4 w-4" />
                Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort tasks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Newest First</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tasks match your filters</p>
          </CardContent>
        </Card>
      ) : (
        filteredTasks.map((task) => (
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
                {getStatusBadge(task.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.profiles && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Assigned to:</span>{" "}
                  {task.profiles.full_name}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm flex-wrap">
                {getPriorityBadge(task.priority)}
                {task.deadline && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(task.deadline).toLocaleDateString()}</span>
                    {getDeadlineStatus(task.deadline) && (
                      <span className={`ml-1 font-medium ${getDeadlineStatus(task.deadline)!.color}`}>
                        ({getDeadlineStatus(task.deadline)!.text})
                      </span>
                    )}
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
        ))
      )}

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