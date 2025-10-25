import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, ListTodo, Inbox, DollarSign } from "lucide-react";
import { toast } from "sonner";
import TaskList from "./TaskList";
import EmployeeInbox from "./EmployeeInbox";
import PaymentManagement from "./PaymentManagement";
import { useRealtimeNotificationsOptimized } from "@/hooks/use-realtime-notifications-optimized";
import ErrorBoundary from "@/components/ui/error-boundary";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useNotificationStore } from "@/stores/notificationStore";

const EmployeeDashboard = () => {
  const { user, logout } = useAuthStore();
  const {
    activeView,
    refreshTrigger,
    setActiveView,
    triggerRefresh
  } = useUIStore();
  const { unreadCount, markAllAsRead, subscribeToRealtimeUpdates } = useNotificationStore();

  // Enable optimized real-time notifications
  useRealtimeNotificationsOptimized({
    userId: user?.id || '',
    userRole: "employee",
    onTaskUpdate: () => {
      // Trigger refresh of task list and inbox
      triggerRefresh();
    },
  });

  useEffect(() => {
    if (user?.id) {
      const unsubscribe = subscribeToRealtimeUpdates(user.id, "employee");
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
            setActiveView("inbox");
            markAllAsRead();
            break;
          case '2':
            e.preventDefault();
            setActiveView("tasks");
            break;
          case '3':
            e.preventDefault();
            setActiveView("payments");
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveView, markAllAsRead]);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
  };

  return (
    <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar - Fixed height, independently scrollable */}
      <aside className="w-full md:w-64 border-r bg-card flex flex-col md:h-screen" aria-label="Employee navigation">
        <div className="p-6 border-b flex-shrink-0">
          <h1 className="text-xl font-bold" id="employee-dashboard-title">ChatFlow Agent</h1>
          <p className="text-sm text-muted-foreground" id="employee-dashboard-subtitle">Employee Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 hidden md:block overflow-y-auto" aria-label="Employee dashboard navigation">
          <Button
            variant={activeView === "inbox" ? "default" : "ghost"}
            className="w-full justify-start relative"
            onClick={() => {
              setActiveView("inbox");
              markAllAsRead(); // Clear unread count when opening inbox
            }}
            aria-current={activeView === "inbox" ? "page" : undefined}
            aria-label={`Task invitations${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Inbox className="mr-2 h-4 w-4" aria-hidden="true" />
            Task Invitations
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-auto h-5 w-5 p-0 flex items-center justify-center"
                aria-hidden="true"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeView === "tasks" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("tasks")}
            aria-current={activeView === "tasks" ? "page" : undefined}
          >
            <ListTodo className="mr-2 h-4 w-4" aria-hidden="true" />
            My Tasks
          </Button>
          <Button
            variant={activeView === "payments" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("payments")}
            aria-current={activeView === "payments" ? "page" : undefined}
          >
            <DollarSign className="mr-2 h-4 w-4" aria-hidden="true" />
            My Payments
          </Button>
        </nav>

        <div className="p-4 border-t flex-shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
            aria-label="Log out from employee dashboard"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content - Fixed height, independently scrollable */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden" aria-labelledby="employee-dashboard-title">
        {/* Mobile Navigation Toggle */}
        <div className="md:hidden p-4 border-b bg-card flex items-center flex-shrink-0">
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
        </div>

        <div className="p-4 md:p-6 flex-1 overflow-y-auto">
          {activeView === "inbox" && (
            <ErrorBoundary componentName="EmployeeInbox">
              <EmployeeInbox key={refreshTrigger} userId={user.id} />
            </ErrorBoundary>
          )}
          {activeView === "tasks" && (
            <ErrorBoundary componentName="TaskList">
              <TaskList key={refreshTrigger} isAdmin={false} />
            </ErrorBoundary>
          )}
          {activeView === "payments" && (
            <ErrorBoundary componentName="PaymentManagement">
              <PaymentManagement userRole="employee" />
            </ErrorBoundary>
          )}
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
