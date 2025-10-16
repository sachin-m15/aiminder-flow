import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Clock, AlertCircle } from "lucide-react";

const DashboardSummary = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    loadStats();

    // Real-time updates
    const channel = supabase
      .channel("dashboard-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_profiles" }, loadStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStats = async () => {
    const [employeesData, tasksData] = await Promise.all([
      supabase.from("employee_profiles").select("id", { count: "exact", head: true }),
      supabase.from("tasks").select("status"),
    ]);

    const totalEmployees = employeesData.count || 0;
    const tasks = tasksData.data || [];
    const activeTasks = tasks.filter((t) => t.status === "ongoing" || t.status === "accepted").length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const pendingApprovals = tasks.filter((t) => t.status === "invited" || t.status === "pending").length;

    setStats({ totalEmployees, activeTasks, completedTasks, pendingApprovals });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">Welcome to your AI-powered task management system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">Active team members</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">In progress now</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--success))]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <div className="h-10 w-10 rounded-full bg-[hsl(var(--success))]/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-[hsl(var(--success))]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully finished</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(var(--warning))]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <div className="h-10 w-10 rounded-full bg-[hsl(var(--warning))]/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--warning))]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting response</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardSummary;
