import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  department: string | null;
  designation: string | null;
  hourly_rate: number | null;
  profiles: {
    full_name: string;
    email: string;
  };
  currentTasks?: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    assigned_to: string;
  }>;
}

interface EmployeeListProps {
  searchQuery?: string;
}

const EmployeeList = ({ searchQuery = "" }: EmployeeListProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [newEmployee, setNewEmployee] = useState({
    email: "",
    fullName: "",
    password: "",
    department: "",
    designation: "",
    skills: "",
    hourlyRate: "",
  });

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

    const merged = employeeData?.map((emp: Record<string, unknown>) => ({
      ...emp,
      profiles: profileData.data?.find((p) => p.id === emp.user_id) || { full_name: "", email: "" },
      currentTasks: tasksData.data?.filter((t) => t.assigned_to === emp.user_id).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status || "unknown",
        progress: t.progress || 0,
        assigned_to: t.assigned_to || "",
      })) || [],
      department: (emp.department as string) || null,
      designation: (emp.designation as string) || null,
      hourly_rate: (emp.hourly_rate as number) || null,
    })) as Employee[] || [];

    setEmployees(merged);
  };

  const handleAddEmployee = async () => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newEmployee.email,
        password: newEmployee.password,
        email_confirm: true,
        user_metadata: {
          full_name: newEmployee.fullName,
        },
      });

      if (authError) throw authError;

      // Create employee profile
      const { error: profileError } = await supabase
        .from("employee_profiles")
        .insert({
          user_id: authData.user.id,
          skills: newEmployee.skills.split(",").map((s) => s.trim()),
          department: newEmployee.department,
          designation: newEmployee.designation,
          hourly_rate: parseFloat(newEmployee.hourlyRate) || 0,
          availability: true,
        });

      if (profileError) throw profileError;

      // Assign employee role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "employee",
        });

      if (roleError) throw roleError;

      toast.success("Employee added successfully!");
      setAddDialogOpen(false);
      setNewEmployee({
        email: "",
        fullName: "",
        password: "",
        department: "",
        designation: "",
        skills: "",
        hourlyRate: "",
      });
      loadEmployees();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add employee";
      toast.error(errorMessage);
    }
  };

  const combinedSearchQuery = searchQuery || localSearchQuery;
  const filteredEmployees = employees.filter((emp) =>
    emp.profiles.full_name.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
    emp.profiles.email.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
    emp.designation?.toLowerCase().includes(combinedSearchQuery.toLowerCase()) ||
    emp.skills.some((skill) => skill.toLowerCase().includes(combinedSearchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              <CardTitle>Employee Management</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Workload</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
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
                    {employee.department ? (
                      <Badge variant="outline">{employee.department}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {employee.designation ? (
                      <span className="text-sm">{employee.designation}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {employee.skills.slice(0, 2).map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {employee.skills.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{employee.skills.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{employee.current_workload}</span>
                      <span className="text-xs text-muted-foreground">tasks</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${(employee.performance_score || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs">{((employee.performance_score || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.availability ? "default" : "secondary"}>
                      {employee.availability ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredEmployees.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              No employees found
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={newEmployee.fullName}
                onChange={(e) => setNewEmployee({ ...newEmployee, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Initial Password</Label>
              <Input
                id="password"
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={newEmployee.department} onValueChange={(value) => setNewEmployee({ ...newEmployee, department: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Customer Support">Customer Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                value={newEmployee.designation}
                onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
                placeholder="e.g., Senior Developer"
              />
            </div>
            <div>
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                value={newEmployee.skills}
                onChange={(e) => setNewEmployee({ ...newEmployee, skills: e.target.value })}
                placeholder="React, TypeScript, Node.js"
              />
            </div>
            <div>
              <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
              <Input
                id="hourlyRate"
                type="number"
                value={newEmployee.hourlyRate}
                onChange={(e) => setNewEmployee({ ...newEmployee, hourlyRate: e.target.value })}
                placeholder="50"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddEmployee} className="flex-1">Add Employee</Button>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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