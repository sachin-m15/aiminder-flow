import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    TrendingUp,
    ListTodo,
    Inbox,
    Calendar,
    Award
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface EmployeeDashboardSummaryProps {
    userId: string;
    onNavigate: (view: string) => void;
}

interface TaskStats {
    total: number;
    ongoing: number;
    completed: number;
    pending: number;
    invited: number;
}

interface EmployeeProfile {
    department: string | null;
    designation: string | null;
    performance_score: number;
    current_workload: number;
    tasks_completed: number;
}

interface RecentTask {
    id: string;
    title: string;
    status: string;
    priority: string;
    deadline: string | null;
    progress: number;
}

const EmployeeDashboardSummary = ({ userId, onNavigate }: EmployeeDashboardSummaryProps) => {
    const [taskStats, setTaskStats] = useState<TaskStats>({
        total: 0,
        ongoing: 0,
        completed: 0,
        pending: 0,
        invited: 0,
    });
    const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
    const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDashboardData = useCallback(async () => {
        try {
            setLoading(true);

            // Load employee profile
            const { data: profileData, error: profileError } = await supabase
                .from("employee_profiles")
                .select("department, designation, performance_score, current_workload, tasks_completed")
                .eq("user_id", userId)
                .single();

            if (profileError) throw profileError;
            setEmployeeProfile(profileData);

            // Load task statistics
            const { data: tasksData, error: tasksError } = await supabase
                .from("tasks")
                .select("id, status")
                .eq("assigned_to", userId);

            if (tasksError) throw tasksError;

            const stats: TaskStats = {
                total: tasksData?.length || 0,
                ongoing: tasksData?.filter(t => t.status === "ongoing").length || 0,
                completed: tasksData?.filter(t => t.status === "completed").length || 0,
                pending: tasksData?.filter(t => t.status === "pending").length || 0,
                invited: tasksData?.filter(t => t.status === "invited").length || 0,
            };
            setTaskStats(stats);

            // Load recent tasks
            const { data: recentTasksData, error: recentTasksError } = await supabase
                .from("tasks")
                .select("id, title, status, priority, deadline, progress")
                .eq("assigned_to", userId)
                .in("status", ["ongoing", "accepted", "invited"])
                .order("created_at", { ascending: false })
                .limit(5);

            if (recentTasksError) throw recentTasksError;
            setRecentTasks(recentTasksData || []);

        } catch (error) {
            console.error("Error loading dashboard data:", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "default";
            case "ongoing":
                return "secondary";
            case "invited":
                return "outline";
            default:
                return "secondary";
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "destructive";
            case "medium":
                return "default";
            case "low":
                return "secondary";
            default:
                return "outline";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Welcome Back!</h2>
                <p className="text-muted-foreground">
                    Here's an overview of your work and progress
                </p>
            </div>

            {/* Profile Card */}
            {employeeProfile && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Your Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Department</p>
                                <p className="text-lg font-semibold">{employeeProfile.department || "Not set"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Designation</p>
                                <p className="text-lg font-semibold">{employeeProfile.designation || "Not set"}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Performance Score</p>
                                <div className="flex items-center gap-2">
                                    <Progress value={employeeProfile.performance_score * 100} className="h-2 flex-1" />
                                    <span className="text-lg font-semibold">{(employeeProfile.performance_score * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                                <p className="text-lg font-semibold">{employeeProfile.tasks_completed}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => onNavigate("inbox")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Invitations</CardTitle>
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{taskStats.invited}</div>
                        <p className="text-xs text-muted-foreground">
                            Pending task invitations
                        </p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => onNavigate("tasks")}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{taskStats.ongoing}</div>
                        <p className="text-xs text-muted-foreground">
                            Currently in progress
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{taskStats.completed}</div>
                        <p className="text-xs text-muted-foreground">
                            Successfully finished
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Tasks */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListTodo className="h-5 w-5" />
                        Recent Tasks
                    </CardTitle>
                    <CardDescription>Your most recent task assignments</CardDescription>
                </CardHeader>
                <CardContent>
                    {recentTasks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No tasks assigned yet</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => onNavigate("inbox")}
                            >
                                Check Invitations
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentTasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                                    onClick={() => onNavigate("tasks")}
                                >
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{task.title}</p>
                                            <Badge variant={getStatusColor(task.status)}>
                                                {task.status}
                                            </Badge>
                                            <Badge variant={getPriorityColor(task.priority)}>
                                                {task.priority}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            {task.deadline && (
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>Due: {format(new Date(task.deadline), "MMM dd, yyyy")}</span>
                                                </div>
                                            )}
                                            {task.status === "ongoing" && (
                                                <div className="flex items-center gap-2">
                                                    <Progress value={task.progress} className="h-2 w-20" />
                                                    <span>{task.progress}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => onNavigate("tasks")}
                            >
                                View All Tasks
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Button
                            variant="outline"
                            className="h-20 flex flex-col gap-2"
                            onClick={() => onNavigate("inbox")}
                        >
                            <Inbox className="h-5 w-5" />
                            <span>Check Invitations</span>
                            {taskStats.invited > 0 && (
                                <Badge variant="destructive" className="absolute top-2 right-2">
                                    {taskStats.invited}
                                </Badge>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            className="h-20 flex flex-col gap-2"
                            onClick={() => onNavigate("tasks")}
                        >
                            <ListTodo className="h-5 w-5" />
                            <span>View My Tasks</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default EmployeeDashboardSummary;
