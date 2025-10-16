import { User } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Users, ListTodo, BarChart3, Settings, Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmployeeList from "./EmployeeList";
import TaskList from "./TaskList";
import TaskAssignmentDialog from "./TaskAssignmentDialog";
import DashboardSummary from "./DashboardSummary";

interface AdminDashboardProps {
  user: User;
  role: string;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [activeView, setActiveView] = useState("employees");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">ChatFlow Agent</h1>
          <p className="text-sm text-muted-foreground">Admin Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
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
            variant={activeView === "reports" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("reports")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Reports
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
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
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
            <Button onClick={() => setShowTaskDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Summary Stats */}
          <DashboardSummary />

          {/* Main Content Area */}
          {activeView === "employees" && <EmployeeList searchQuery={searchQuery} />}
          {activeView === "tasks" && <TaskList userId={user.id} isAdmin={true} searchQuery={searchQuery} />}
          {activeView === "reports" && (
            <Card>
              <CardHeader>
                <CardTitle>Reports & Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Performance reports and analytics coming soon...</p>
              </CardContent>
            </Card>
          )}
          {activeView === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Dashboard settings coming soon...</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <TaskAssignmentDialog 
        open={showTaskDialog} 
        onClose={() => setShowTaskDialog(false)}
        adminId={user.id}
      />
    </div>
  );
};

export default AdminDashboard;