import { User } from "@supabase/supabase-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Users, ListTodo, BarChart3, Settings, Search, MessageSquare, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmployeeList from "./EmployeeList";
import TaskList from "./TaskList";
import DashboardSummary from "./DashboardSummary";
import ChatPanel from "./ChatPanel";
import PaymentManagement from "./PaymentManagement";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

interface AdminDashboardProps {
  user: User;
  role: string;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [activeView, setActiveView] = useState("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Enable real-time notifications
  useRealtimeNotifications({
    userId: user.id,
    userRole: "admin",
    onTaskUpdate: () => {
      // Trigger refresh of task list
      setRefreshTrigger(prev => prev + 1);
    },
    onNewMessage: () => {
      // Could add badge counter here
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 dark:bg-slate-900 flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">ChatFlow Agent</h1>
          <p className="text-sm text-muted-foreground">Admin Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant={activeView === "dashboard" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("dashboard")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={activeView === "chat" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("chat")}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            AI Task Assignment
          </Button>
          <Button
            variant={activeView === "employees" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("employees")}
          >
            <Users className="mr-2 h-4 w-4" />
            Employees
          </Button>
          <Button
            variant={activeView === "tasks" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("tasks")}
          >
            <ListTodo className="mr-2 h-4 w-4" />
            Projects / Tasks
          </Button>
          <Button
            variant={activeView === "payments" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("payments")}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Payments
          </Button>
          <Button
            variant={activeView === "settings" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("settings")}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {activeView !== "chat" && (
          <header className="border-b bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employees, tasks, or projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </header>
        )}

        <div className={`${activeView === "chat" ? "flex-1" : "p-6"} space-y-6`}>
          {activeView === "dashboard" && <DashboardSummary />}
          {activeView === "chat" && <ChatPanel userId={user.id} onTaskCreated={() => setActiveView("tasks")} />}
          {activeView === "employees" && <EmployeeList searchQuery={searchQuery} />}
          {activeView === "tasks" && <TaskList key={refreshTrigger} userId={user.id} isAdmin={true} searchQuery={searchQuery} />}
          {activeView === "payments" && <PaymentManagement userId={user.id} userRole="admin" />}
          {activeView === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Admin Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Account Information</h3>
                  <p className="text-sm text-muted-foreground">Email: {user.email}</p>
                  <p className="text-sm text-muted-foreground">Role: Administrator</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">System Preferences</h3>
                  <p className="text-sm text-muted-foreground">Notification settings and preferences will be available soon.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;