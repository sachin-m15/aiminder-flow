import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ListChecks, Target, TrendingUp, Award, Clock, BarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DashboardStats {
  totalEmployees: number;
  activeProjects: number;
  completedTasks: number;
  topPerformers: Array<{
    id: string;
    name: string;
    performance_score: number;
    tasks_completed: number;
    department: string;
  }>;
  departmentStats: Array<{
    department: string;
    employee_count: number;
    avg_performance: number;
  }>;
  taskCompletionRate: number;
  workloadBalance: Array<{
    range: string;
    count: number;
  }>;
}

const DashboardSummary = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeProjects: 0,
    completedTasks: 0,
    topPerformers: [],
    departmentStats: [],
    taskCompletionRate: 0,
    workloadBalance: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();

    // Optimized real-time updates with selective field retrieval
    const channel = supabase
      .channel("optimized-dashboard-stats")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
        },
        fetchDashboardStats
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
        },
        fetchDashboardStats
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "employee_profiles",
        },
        fetchDashboardStats
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "employee_profiles",
        },
        fetchDashboardStats
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Get total employees
      const { count: employeeCount } = await supabase
        .from("employee_profiles")
        .select("*", { count: "exact", head: true });

      // Get active projects (tasks that are accepted or ongoing)
      const { count: activeCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("status", ["accepted", "ongoing"]);

      // Get completed tasks
      const { count: completedCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Get top performers
      const { data: topPerformersData } = await supabase
        .from("employee_profiles")
        .select(`
          id,
          user_id,
          performance_score,
          tasks_completed,
          department,
          profiles!inner(full_name)
        `)
        .order("performance_score", { ascending: false })
        .order("tasks_completed", { ascending: false })
        .limit(5);

      const topPerformers = topPerformersData?.map((emp) => ({
        id: emp.id,
        name: (emp.profiles as unknown as { full_name: string }).full_name,
        performance_score: emp.performance_score || 0,
        tasks_completed: emp.tasks_completed || 0,
        department: emp.department || "Unassigned",
      })) || [];

      // Get department statistics
      const { data: departmentData } = await supabase
        .from("employee_profiles")
        .select("department, performance_score");

      const departmentMap = new Map<string, { total: number; sum: number }>();
      departmentData?.forEach((emp) => {
        const dept = (emp.department as string) || "Unassigned";
        const current = departmentMap.get(dept) || { total: 0, sum: 0 };
        departmentMap.set(dept, {
          total: current.total + 1,
          sum: current.sum + ((emp.performance_score as number) || 0),
        });
      });

      const departmentStats = Array.from(departmentMap.entries()).map(([dept, stats]) => ({
        department: dept,
        employee_count: stats.total,
        avg_performance: stats.total > 0 ? stats.sum / stats.total : 0,
      }));

      // Calculate task completion rate
      const { count: totalTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true });

      const taskCompletionRate = totalTasks && totalTasks > 0
        ? Math.round((completedCount || 0) / totalTasks * 100)
        : 0;

      // Get workload balance
      const { data: workloadData } = await supabase
        .from("employee_profiles")
        .select("current_workload");

      const workloadRanges = [
        { range: "0-2 tasks", min: 0, max: 2, count: 0 },
        { range: "3-5 tasks", min: 3, max: 5, count: 0 },
        { range: "6+ tasks", min: 6, max: 999, count: 0 },
      ];

      workloadData?.forEach((emp) => {
        const workload = (emp.current_workload as number) || 0;
        for (const range of workloadRanges) {
          if (workload >= range.min && workload <= range.max) {
            range.count++;
            break;
          }
        }
      });

      setStats({
        totalEmployees: employeeCount || 0,
        activeProjects: activeCount || 0,
        completedTasks: completedCount || 0,
        topPerformers,
        departmentStats,
        taskCompletionRate,
        workloadBalance: workloadRanges,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalEmployees}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Active workforce</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.activeProjects}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Currently in progress</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.completedTasks}</div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Successfully finished</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.taskCompletionRate}%</div>
            <Progress value={stats.taskCompletionRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Performers */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topPerformers.length > 0 ? (
                stats.topPerformers.map((performer, index) => (
                  <div key={performer.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${index === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                        index === 1 ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" :
                          index === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                            "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{performer.name}</p>
                        <p className="text-xs text-muted-foreground">{performer.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{(performer.performance_score * 100).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">{performer.tasks_completed} tasks</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No performance data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Department Productivity */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-blue-500" />
              Department Productivity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.departmentStats.length > 0 ? (
                stats.departmentStats.map((dept) => (
                  <div key={dept.department} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{dept.department}</span>
                      <span className="text-muted-foreground">
                        {(dept.avg_performance * 100).toFixed(0)}% • {dept.employee_count} emp
                      </span>
                    </div>
                    <Progress value={dept.avg_performance * 100} className="h-2" />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No department data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Workload Balance */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              Workload Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.workloadBalance.map((range) => (
                <div key={range.range} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={range.count > 5 ? "default" : "secondary"}>
                      {range.count}
                    </Badge>
                    <span className="text-sm">{range.range}</span>
                  </div>
                  <div className="w-24">
                    <Progress
                      value={stats.totalEmployees > 0 ? (range.count / stats.totalEmployees) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Balanced workload distribution ensures optimal productivity across the team
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardSummary;
