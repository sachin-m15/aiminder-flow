import { User } from "@supabase/supabase-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, ListTodo, MessageSquare, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TaskList from "./TaskList";
import ChatInterface from "./ChatInterface";
import EmployeeInbox from "./EmployeeInbox";

interface EmployeeDashboardProps {
  user: User;
}

const EmployeeDashboard = ({ user }: EmployeeDashboardProps) => {
  const [activeView, setActiveView] = useState("inbox");

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
          <p className="text-sm text-muted-foreground">Employee Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant={activeView === "inbox" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("inbox")}
          >
            <Inbox className="mr-2 h-4 w-4" />
            Task Invitations
          </Button>
          <Button
            variant={activeView === "tasks" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("tasks")}
          >
            <ListTodo className="mr-2 h-4 w-4" />
            My Tasks
          </Button>
          <Button
            variant={activeView === "chat" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveView("chat")}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat Support
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
        <div className="p-6">
          {activeView === "inbox" && <EmployeeInbox userId={user.id} />}
          {activeView === "tasks" && <TaskList userId={user.id} isAdmin={false} />}
          {activeView === "chat" && <ChatInterface userId={user.id} />}
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
