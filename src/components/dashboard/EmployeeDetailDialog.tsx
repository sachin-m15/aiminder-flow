import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";
import { employeeProfileSchema, type EmployeeProfileFormData } from "@/lib/validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import ErrorBoundary from "@/components/ui/error-boundary";

interface EmployeeDetailDialogProps {
  employee: any;
  open: boolean;
  onClose: () => void;
}

const EmployeeDetailDialog = ({ employee, open, onClose }: EmployeeDetailDialogProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<EmployeeProfileFormData>({
    resolver: zodResolver(employeeProfileSchema),
    defaultValues: {
      department: employee?.department || "",
      designation: employee?.designation || "",
      hourlyRate: employee?.hourly_rate || 0,
      skills: employee?.skills || [],
    },
  });

  useEffect(() => {
    if (open && employee) {
      loadEmployeeTasks();
      form.reset({
        department: employee.department || "",
        designation: employee.designation || "",
        hourlyRate: employee.hourly_rate || 0,
        skills: employee.skills || [],
      });
    }
  }, [open, employee, form]);

  const loadEmployeeTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", employee.user_id)
      .order("created_at", { ascending: false });

    setTasks(data || []);
  };

  const handleSaveProfile = async (data: EmployeeProfileFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("employee_profiles")
        .update({
          department: data.department,
          designation: data.designation,
          hourly_rate: data.hourlyRate,
          skills: data.skills,
        })
        .eq("user_id", employee.user_id);

      if (error) throw error;

      toast.success("Employee profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    form.reset({
      department: employee.department || "",
      designation: employee.designation || "",
      hourlyRate: employee.hourly_rate || 0,
      skills: employee.skills || [],
    });
    setIsEditing(false);
  };

  if (!employee) return null;

  const completionRate = tasks.length > 0
    ? ((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100).toFixed(0)
    : 0;

  return (
    <ErrorBoundary componentName="EmployeeDetailDialog">
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent
          className="max-w-3xl max-h-[80vh]"
          onOpenAutoFocus={(e) => {
            // Prevent auto-focus on first element, let user navigate naturally
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Employee Details</DialogTitle>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Employee Info */}
              <Card>
                <CardHeader>
                  <CardTitle>{employee.profiles.full_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSaveProfile)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{employee.profiles.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <Badge variant={employee.availability ? "default" : "secondary"}>
                            {employee.availability ? "Available" : "Unavailable"}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="department"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Department</FormLabel>
                              {isEditing ? (
                                <FormControl>
                                  <Input {...field} placeholder="Enter department" />
                                </FormControl>
                              ) : (
                                <p className="font-medium">{field.value || "Not assigned"}</p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="designation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Designation</FormLabel>
                              {isEditing ? (
                                <FormControl>
                                  <Input {...field} placeholder="Enter designation" />
                                </FormControl>
                              ) : (
                                <p className="font-medium">{field.value || "Not assigned"}</p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="hourlyRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hourly Rate</FormLabel>
                            {isEditing ? (
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                                />
                              </FormControl>
                            ) : (
                              <p className="text-xl font-bold">${field.value || 0}/hr</p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="skills"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Skills</FormLabel>
                            {isEditing ? (
                              <FormControl>
                                <Input
                                  placeholder="Enter skills (comma-separated)"
                                  value={field.value.join(", ")}
                                  onChange={(e) => field.onChange(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                />
                              </FormControl>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {field.value.map((skill: string, idx: number) => (
                                  <Badge key={idx} variant="secondary">
                                    {skill}
                                  </Badge>
                                ))}
                                {field.value.length === 0 && (
                                  <p className="text-muted-foreground">No skills assigned</p>
                                )}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {isEditing && (
                        <div className="flex gap-2 pt-4">
                          <Button type="submit" disabled={loading} className="flex-1">
                            <Save className="h-4 w-4 mr-2" />
                            {loading ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={loading}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </form>
                  </Form>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Workload</p>
                      <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'ongoing' || t.status === 'accepted').length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold">{employee.tasks_completed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      <p className="text-2xl font-bold">{completionRate}%</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Performance Score</p>
                    <Progress value={employee.performance_score * 100} />
                    <p className="text-xs text-right mt-1">
                      {(employee.performance_score * 100).toFixed(0)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Tasks */}
              <Card>
                <CardHeader>
                  <CardTitle>Task History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">{task.title}</h4>
                          <Badge
                            variant={
                              task.status === "completed"
                                ? "default"
                                : task.status === "ongoing"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {task.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress: {task.progress}%</span>
                          {task.deadline && (
                            <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                          )}
                        </div>
                        <Progress value={task.progress} className="mt-2 h-1" />
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No tasks assigned yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
};

export default EmployeeDetailDialog;
