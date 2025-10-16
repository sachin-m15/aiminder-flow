import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Clock } from "lucide-react";
import EmployeeDetailDialog from "./EmployeeDetailDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Employee {
  user_id: string;
  skills: string[];
  availability: boolean;
  current_workload: number;
  performance_score: number;
  tasks_completed: number;
  profiles: {
    full_name: string;
    email: string;
  };
  currentTasks?: any[];
}

interface EmployeeListProps {
  searchQuery?: string;
}

const EmployeeList = ({ searchQuery = "" }: EmployeeListProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    loadEmployees();

    // Real-time updates
    const channel = supabase
      .channel("employees")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_profiles" }, loadEmployees)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadEmployees)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEmployees = async () => {
    const { data: employeeData, error: empError } = await supabase
      .from("employee_profiles")
      .select("*");

    if (empError) {
      toast.error("Failed to load employees");
      return;
    }

    const userIds = employeeData?.map((e) => e.user_id) || [];

    const [profileData, tasksData] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      supabase
        .from("tasks")
        .select("*")
        .in("assigned_to", userIds)
        .in("status", ["ongoing", "accepted"]),
    ]);

    const merged = employeeData?.map((emp) => ({
      ...emp,
      profiles: profileData.data?.find((p) => p.id === emp.user_id) || { full_name: "", email: "" },
      currentTasks: tasksData.data?.filter((t) => t.assigned_to === emp.user_id) || [],
    })) || [];

    setEmployees(merged);
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.profiles.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.profiles.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.skills.some((skill) => skill.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            <CardTitle>Employee Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role / Skills</TableHead>
                <TableHead>Current Tasks</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => {
                const currentTask = employee.currentTasks?.[0];
                return (
                  <TableRow
                    key={employee.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedEmployee(employee)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{employee.profiles.full_name}</p>
                        <p className="text-xs text-muted-foreground">{employee.profiles.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {employee.skills.slice(0, 3).map((skill, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {employee.skills.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{employee.skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {currentTask ? (
                        <div>
                          <p className="text-sm font-medium">{currentTask.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {currentTask.status}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No active task</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {currentTask ? (
                        <div className="w-full">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-secondary rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${currentTask.progress}%` }}
                              />
                            </div>
                            <span className="text-xs">{currentTask.progress}%</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.availability ? "default" : "secondary"}>
                        {employee.availability ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Just now</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredEmployees.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              No employees found
            </p>
          )}
        </CardContent>
      </Card>

      {selectedEmployee && (
        <EmployeeDetailDialog
          employee={selectedEmployee}
          open={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
};

export default EmployeeList;