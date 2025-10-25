import { useEffect, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import ErrorBoundary from "@/components/ui/error-boundary";

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
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEmployees();

    // Optimized real-time updates with selective field retrieval
    const channel = supabase
      .channel("optimized-employees")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "employee_profiles",
        },
        loadEmployees
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "employee_profiles",
        },
        loadEmployees
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
        },
        loadEmployees
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
        },
        loadEmployees
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEmployees = async () => {
    // First, get all users with the 'employee' role
    const { data: employeeRoles, error: roleError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "employee");

    if (roleError) {
      toast.error("Failed to load employee roles");
      return;
    }

    // Get all users with the 'admin' role
    const { data: adminRoles, error: adminRoleError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoleError) {
      toast.error("Failed to load admin roles");
      return;
    }

    const employeeUserIds = employeeRoles?.map(r => r.user_id) || [];
    const adminUserIds = adminRoles?.map(r => r.user_id) || [];

    // Filter out users who are also admins - only pure employees
    const pureEmployeeUserIds = employeeUserIds.filter(id => !adminUserIds.includes(id));

    if (pureEmployeeUserIds.length === 0) {
      setEmployees([]);
      return;
    }

    // Get employee profiles for users with employee role only (not admins)
    const { data: employeeData, error: empError } = await supabase
      .from("employee_profiles")
      .select("*")
      .in("user_id", pureEmployeeUserIds);

    if (empError) {
      toast.error("Failed to load employees");
      return;
    }

    const employeeIds = employeeData?.map((e) => e.id) || [];
    const userIds = employeeData?.map((e) => e.user_id) || [];

    // Fetch skills from employee_skills table
    const { data: skillsData, error: skillsError } = await supabase
      .from("employee_skills")
      .select("employee_id, skill")
      .in("employee_id", employeeIds);

    if (skillsError) {
      console.error("Error loading skills:", skillsError);
    }

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
      skills: skillsData?.filter(s => s.employee_id === emp.id).map(s => s.skill) || [],
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

      // Create employee profile (without skills)
      const { data: profileData, error: profileError } = await supabase
        .from("employee_profiles")
        .insert({
          user_id: authData.user.id,
          department: newEmployee.department,
          designation: newEmployee.designation,
          hourly_rate: parseFloat(newEmployee.hourlyRate) || 0,
          availability: true,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Insert skills into employee_skills table
      const skills = newEmployee.skills.split(",").map((s) => s.trim()).filter(s => s.length > 0);
      if (skills.length > 0) {
        const skillsToInsert = skills.map(skill => ({
          employee_id: profileData.id,
          skill: skill
        }));

        const { error: skillsError } = await supabase
          .from("employee_skills")
          .insert(skillsToInsert);

        if (skillsError) throw skillsError;
      }

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
    (emp.skills || []).some((skill) => skill.toLowerCase().includes(combinedSearchQuery.toLowerCase()))
  );

  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  return (
    <ErrorBoundary componentName="EmployeeList">
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
            <div className="space-y-2">
              {/* Table Header */}
              <div className="grid grid-cols-7 gap-4 px-4 py-2 border-b bg-muted/50 font-medium text-sm">
                <div>Name</div>
                <div>Department</div>
                <div>Designation</div>
                <div>Skills</div>
                <div>Workload</div>
                <div>Performance</div>
                <div>Status</div>
              </div>

              {/* Virtualized Table Body */}
              <div
                ref={parentRef}
                className="h-[400px] overflow-auto"
                aria-label="Employee list"
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const employee = filteredEmployees[virtualItem.index];
                    return (
                      <div
                        key={employee.user_id}
                        className="grid grid-cols-7 gap-4 px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors items-center"
                        onClick={() => setSelectedEmployee(employee)}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <div>
                          <p className="font-medium text-sm">{employee.profiles.full_name}</p>
                          <p className="text-xs text-muted-foreground">{employee.profiles.email}</p>
                        </div>
                        <div>
                          {employee.department ? (
                            <Badge variant="outline">{employee.department}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not set</span>
                          )}
                        </div>
                        <div>
                          {employee.designation ? (
                            <span className="text-sm">{employee.designation}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not set</span>
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap gap-1">
                            {(employee.skills || []).slice(0, 2).map((skill, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {(employee.skills || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(employee.skills || []).length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{employee.current_workload}</span>
                            <span className="text-xs text-muted-foreground">tasks</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-secondary rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${(employee.performance_score || 0) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs">{((employee.performance_score || 0) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <div>
                          <Badge variant={employee.availability ? "default" : "secondary"}>
                            {employee.availability ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {filteredEmployees.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  No employees found
                </p>
              )}
            </div>
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
    </ErrorBoundary>
  );
};

export default EmployeeList;