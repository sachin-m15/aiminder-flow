import { useEffect, useState } from "react";
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

interface EmployeeDetailDialogProps {
  employee: any;
  open: boolean;
  onClose: () => void;
}

const EmployeeDetailDialog = ({ employee, open, onClose }: EmployeeDetailDialogProps) => {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (open && employee) {
      loadEmployeeTasks();
    }
  }, [open, employee]);

  const loadEmployeeTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", employee.user_id)
      .order("created_at", { ascending: false });

    setTasks(data || []);
  };

  if (!employee) return null;

  const completionRate = tasks.length > 0
    ? ((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100).toFixed(0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Employee Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Employee Info */}
            <Card>
              <CardHeader>
                <CardTitle>{employee.profiles.full_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{employee.department || "Not assigned"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Designation</p>
                    <p className="font-medium">{employee.designation || "Not assigned"}</p>
                  </div>
                </div>

                {employee.hourly_rate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Hourly Rate</p>
                    <p className="text-xl font-bold">${employee.hourly_rate}/hr</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {employee.skills.map((skill: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Workload</p>
                    <p className="text-2xl font-bold">{employee.current_workload}</p>
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
  );
};

export default EmployeeDetailDialog;
