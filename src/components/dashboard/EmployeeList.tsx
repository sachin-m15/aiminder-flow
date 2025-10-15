import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users } from "lucide-react";

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
}

const EmployeeList = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    const { data: employeeData, error: empError } = await supabase
      .from("employee_profiles")
      .select("*");

    if (empError) {
      toast.error("Failed to load employees");
      return;
    }

    // Get user IDs
    const userIds = employeeData?.map(e => e.user_id) || [];
    
    // Fetch profiles separately
    const { data: profileData, error: profError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profError) {
      toast.error("Failed to load employee profiles");
      return;
    }

    // Merge data
    const merged = employeeData?.map(emp => ({
      ...emp,
      profiles: profileData?.find(p => p.id === emp.user_id) || { full_name: "", email: "" }
    })) || [];

    setEmployees(merged);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Employees</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee) => (
          <Card key={employee.user_id}>
            <CardHeader>
              <CardTitle className="text-lg">
                {employee.profiles?.full_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {employee.profiles?.email}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {employee.skills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Workload</p>
                  <p className="font-medium">{employee.current_workload}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completed</p>
                  <p className="font-medium">{employee.tasks_completed}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Performance</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${employee.performance_score * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {(employee.performance_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <Badge variant={employee.availability ? "default" : "secondary"}>
                {employee.availability ? "Available" : "Unavailable"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmployeeList;