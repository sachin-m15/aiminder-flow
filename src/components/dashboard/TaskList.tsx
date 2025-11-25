import { useEffect, useState, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Filter, ArrowUpDown, AlertCircle, Plus, Copy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TaskDialog from "./TaskDialog";
import TaskAssignmentDialog from "./TaskAssignmentDialog";
import ErrorBoundary from "@/components/ui/error-boundary";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { useUIStore } from "@/stores/uiStore";

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
  isAdmin: boolean;
  searchQuery?: string;
}

const TaskList = ({ isAdmin, searchQuery = "" }: TaskListProps) => {
  const { user } = useAuthStore();
  const {
    tasks,
    loading,
    error,
    loadTasks,
    subscribeToTaskUpdates,
    getFilteredTasks
  } = useTaskStore();
  const { selectedTask, setSelectedTask } = useTaskStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [showTaskAssignment, setShowTaskAssignment] = useState(false);

  const { statusFilter, priorityFilter, sortBy, setStatusFilter, setPriorityFilter, setSortBy } = useUIStore();

  // Get filtered tasks from store
  const filteredTasks = getFilteredTasks({
    searchQuery,
    statusFilter,
    priorityFilter,
    sortBy
  });

  const rowVirtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 3,
  });

  useEffect(() => {
    if (user?.id) {
      loadTasks(user.id, isAdmin);
      const unsubscribe = subscribeToTaskUpdates(user.id, isAdmin);
      return unsubscribe;
    }
  }, [user?.id, isAdmin, loadTasks, subscribeToTaskUpdates]);


  const { acceptTask, rejectTask } = useTaskStore();

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Task ID copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy task ID");
    }
  };

  return (
    <ErrorBoundary componentName="TaskList">
      <div className="space-y-4">
        {/* Header with Add Button and Compact Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Projects & Tasks</h2>
            <Badge variant="secondary" className="text-sm">
              {filteredTasks.length} / {tasks.length}
            </Badge>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowTaskAssignment(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          )}
        </div>

        {/* Compact Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg border">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Newest</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task Cards Grid */}
        <div
          ref={parentRef}
          className="h-[calc(100vh-280px)] overflow-auto"
          aria-label="Task list"
        >
          {filteredTasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground mb-4">No tasks match your filters</p>
                {isAdmin && (
                  <Button onClick={() => setShowTaskAssignment(true)} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Task
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-1">
              {filteredTasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 flex flex-col h-fit"
                  onClick={() => setSelectedTask(task)}
                >
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base line-clamp-2">{task.title}</CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-xs text-muted-foreground">Task ID: {task.id}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(task.id);
                            }}
                            title="Copy task ID"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {getStatusBadge(task.status)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                      {task.description}
                    </p>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3 flex-1 flex flex-col">
                    {task.profiles && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Assigned:</span>{" "}
                        <span className="font-medium">{task.profiles.full_name}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {getPriorityBadge(task.priority)}
                      {task.deadline && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(task.deadline).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {task.deadline && getDeadlineStatus(task.deadline) && (
                      <div className={`text-xs font-medium ${getDeadlineStatus(task.deadline)!.color}`}>
                        {getDeadlineStatus(task.deadline)!.text}
                      </div>
                    )}

                    <div className="mt-auto">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{task.progress}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
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
                            acceptTask(task.id);
                          }}
                          className="flex-1 h-8 text-xs"
                        >
                          <CheckCircle className="mr-1.5 h-3 w-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectTask(task.id);
                          }}
                          className="flex-1 h-8 text-xs"
                        >
                          <XCircle className="mr-1.5 h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {selectedTask && (
          <TaskDialog
            task={selectedTask}
            open={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            isAdmin={isAdmin}
            userId={user?.id || ''}
          />
        )}

        {isAdmin && (
          <TaskAssignmentDialog
            open={showTaskAssignment}
            onClose={() => setShowTaskAssignment(false)}
            adminId={user?.id || ''}
            onSuccess={() => loadTasks(user?.id || '', isAdmin)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default TaskList;