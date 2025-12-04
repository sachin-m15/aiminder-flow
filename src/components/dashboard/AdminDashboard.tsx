import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Users, ListTodo, BarChart3, Settings, Search, DollarSign, UserCircle, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmployeeList from "./EmployeeList";
import TaskList from "./TaskList";
import DashboardSummary from "./DashboardSummary";
import PaymentManagement from "./PaymentManagement";
import Profile from "@/components/profile/Profile";
import AIChat from "./AIChat";
import { useRealtimeNotificationsOptimized } from "@/hooks/use-realtime-notifications-optimized";
import ErrorBoundary from "@/components/ui/error-boundary";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useNotificationStore } from "@/stores/notificationStore";

const AdminDashboard = () => {
  const { user, logout } = useAuthStore();
  const {
    activeView,
    searchQuery,
    refreshTrigger,
    setActiveView,
    setSearchQuery,
    triggerRefresh
  } = useUIStore();
  const { subscribeToRealtimeUpdates } = useNotificationStore();

  // Enable optimized real-time notifications
  useRealtimeNotificationsOptimized({
    userId: user?.id || '',
    userRole: "admin",
    onTaskUpdate: () => {
      // Trigger refresh of task list
      triggerRefresh();
    },
  });

  useEffect(() => {
    if (user?.id) {
      const unsubscribe = subscribeToRealtimeUpdates(user.id, "admin");
      return unsubscribe;
    }
  }, [user?.id, subscribeToRealtimeUpdates]);

  useEffect(() => {
    // Add keyboard shortcuts for navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveView("dashboard");
            break;
          case '2':
            e.preventDefault();
            setActiveView("chat");
            break;
          case '3':
            e.preventDefault();
            setActiveView("employees");
            break;
          case '4':
            e.preventDefault();
            setActiveView("tasks");
            break;
          case '5':
            e.preventDefault();
            setActiveView("payments");
            break;
          case '6':
            e.preventDefault();
            setActiveView("profile");
            break;
          case '7':
            e.preventDefault();
            setActiveView("settings");
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveView]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
  };

  return (
    <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Fixed height, independently scrollable */}
      <aside className="w-full md:w-64 border-r bg-muted/30 dark:bg-slate-900 flex flex-col md:h-screen" aria-label="Main navigation">
        <div className="p-6 border-b flex-shrink-0">
          <h1 className="text-xl font-bold" id="admin-dashboard-title">ChatFlow Agent</h1>
          <p className="text-sm text-muted-foreground" id="admin-dashboard-subtitle">Admin Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 hidden md:block overflow-y-auto" aria-label="Dashboard navigation">
          <Button
            variant={activeView === "dashboard" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("dashboard")}
            aria-current={activeView === "dashboard" ? "page" : undefined}
          >
            <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
            Dashboard
          </Button>
          <Button
            variant={activeView === "chat" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("chat")}
            aria-current={activeView === "chat" ? "page" : undefined}
          >
            <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            AI Assistant
          </Button>
          <Button
            variant={activeView === "employees" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("employees")}
            aria-current={activeView === "employees" ? "page" : undefined}
          >
            <Users className="mr-2 h-4 w-4" aria-hidden="true" />
            Employees
          </Button>
          <Button
            variant={activeView === "tasks" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("tasks")}
            aria-current={activeView === "tasks" ? "page" : undefined}
          >
            <ListTodo className="mr-2 h-4 w-4" aria-hidden="true" />
            Projects / Tasks
          </Button>
          <Button
            variant={activeView === "payments" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("payments")}
            aria-current={activeView === "payments" ? "page" : undefined}
          >
            <DollarSign className="mr-2 h-4 w-4" aria-hidden="true" />
            Payments
          </Button>
          <Button
            variant={activeView === "profile" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("profile")}
            aria-current={activeView === "profile" ? "page" : undefined}
          >
            <UserCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Profile
          </Button>
          <Button
            variant={activeView === "settings" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("settings")}
            aria-current={activeView === "settings" ? "page" : undefined}
          >
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            Settings
          </Button>
        </nav>

        <div className="p-4 border-t flex-shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
            aria-label="Log out from admin dashboard"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content - Fixed height, independently scrollable */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden" aria-labelledby="admin-dashboard-title">
        {/* Mobile Navigation Toggle */}
        <div className="md:hidden p-4 border-b bg-card flex items-center justify-between flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => document.querySelector('aside nav')?.classList.toggle('hidden')}
            aria-label="Toggle navigation menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
          {activeView !== "chat" && (
            <div className="flex-1 max-w-md ml-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Search employees, tasks, or projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  aria-label="Search content"
                />
              </div>
            </div>
          )}
        </div>

        {activeView !== "chat" && (
          <header className="border-b bg-card p-4 hidden md:block flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    placeholder="Search employees, tasks, or projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    aria-label="Search content"
                  />
                </div>
              </div>
            </div>
          </header>
        )}

        <div className={`${activeView === "chat" ? "flex-1 p-4 md:p-6" : activeView === "employees" ? "flex-1" : "p-4 md:p-6"} ${activeView === "employees" ? "" : "space-y-4 md:space-y-6"} flex-1 overflow-y-auto`}>
          {activeView === "dashboard" && (
            <ErrorBoundary componentName="DashboardSummary">
              <DashboardSummary />
            </ErrorBoundary>
          )}
          {activeView === "chat" && (
            <ErrorBoundary componentName="Chat">
              <AIChat userRole="admin" />
            </ErrorBoundary>
          )}
          {activeView === "employees" && (
            <ErrorBoundary componentName="EmployeeList">
              <EmployeeList searchQuery={searchQuery} />
            </ErrorBoundary>
          )}
          {activeView === "tasks" && (
            <ErrorBoundary componentName="TaskList">
              <TaskList key={refreshTrigger} isAdmin={true} searchQuery={searchQuery} />
            </ErrorBoundary>
          )}
          {activeView === "payments" && (
            <ErrorBoundary componentName="PaymentManagement">
              <PaymentManagement userRole="admin" />
            </ErrorBoundary>
          )}
          {activeView === "profile" && (
            <ErrorBoundary componentName="Profile">
              <Profile userId={user.id} userRole="admin" />
            </ErrorBoundary>
          )}
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