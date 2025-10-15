import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut, Users, ListTodo, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmployeeList from "./EmployeeList";
import TaskList from "./TaskList";
import ChatInterface from "./ChatInterface";

interface AdminDashboardProps {
  user: User;
  role: string;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">ChatFlow Agent - Admin</h1>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              AI Chat
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ListTodo className="mr-2 h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="employees">
              <Users className="mr-2 h-4 w-4" />
              Employees
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <ChatInterface userId={user.id} />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList userId={user.id} isAdmin={true} />
          </TabsContent>

          <TabsContent value="employees">
            <EmployeeList />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;