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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalEmployees}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeTasks}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completedTasks}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSummary;
