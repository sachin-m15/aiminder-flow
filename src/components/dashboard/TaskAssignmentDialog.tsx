import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Star, TrendingUp, Users, Zap, CheckCircle, AlertCircle } from "lucide-react";

interface TaskAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  adminId: string;
}

interface Employee {
  user_id: string;
  skills: string[];
  department: string | null;
  designation: string | null;
  performance_score: number;
  current_workload: number;
  profiles: {
    full_name: string;
  } | null;
}

interface EmployeeWithScore extends Employee {
  matchScore: number;
  skillMatch: number;
  workloadCapacity: number;
}

const TaskAssignmentDialog = ({ open, onClose, adminId }: TaskAssignmentDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    if (open) {
      loadEmployees();
    }
  }, [open]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select(`
          user_id,
          skills,
          department,
          designation,
          performance_score,
          current_workload,
          profiles!employee_profiles_user_id_fkey (
            full_name
          )
        `);

      if (error) throw error;
      setEmployees((data as unknown as Employee[]) || []);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    }
  };

  // AI-powered employee scoring algorithm
  const rankedEmployees = useMemo((): EmployeeWithScore[] => {
    if (!requiredSkills.trim() || employees.length === 0) {
      return employees.map(emp => ({
        ...emp,
        matchScore: 0,
        skillMatch: 0,
        workloadCapacity: 0
      }));
    }

    const skillKeywords = requiredSkills.toLowerCase().split(',').map(s => s.trim());

    return employees.map(emp => {
      // Skill Match Score (0-100)
      const employeeSkills = emp.skills.map(s => s.toLowerCase());
      const matchedSkills = skillKeywords.filter(keyword =>
        employeeSkills.some(empSkill => empSkill.includes(keyword) || keyword.includes(empSkill))
      );
      const skillMatch = skillKeywords.length > 0
        ? (matchedSkills.length / skillKeywords.length) * 100
        : 50;

      // Workload Capacity (0-100) - Lower workload = Higher score
      const maxWorkload = 10; // Assume max 10 tasks
      const workloadCapacity = Math.max(0, ((maxWorkload - emp.current_workload) / maxWorkload) * 100);

      // Performance Score (already 0-100)
      const performanceScore = emp.performance_score;

      // Availability Score (0-100) - Based on workload
      const availabilityScore = emp.current_workload < 3 ? 100 : emp.current_workload < 5 ? 70 : 40;

      // Weighted Score
      const matchScore =
        (skillMatch * 0.40) +
        (workloadCapacity * 0.30) +
        (performanceScore * 0.20) +
        (availabilityScore * 0.10);

      return {
        ...emp,
        matchScore: Math.round(matchScore),
        skillMatch: Math.round(skillMatch),
        workloadCapacity: Math.round(workloadCapacity)
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }, [employees, requiredSkills]);

  const topRecommendations = rankedEmployees.slice(0, 3);

  const handleSubmit = async () => {
    if (!title || !description || !selectedEmployee) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title,
        description,
        priority,
        deadline: deadline || null,
        assigned_to: selectedEmployee,
        created_by: adminId,
        status: "invited",
      });

      if (error) throw error;

      toast.success("Task assigned successfully!");
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDeadline("");
      setRequiredSkills("");
      setSelectedEmployee("");
      setShowRecommendations(false);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to assign task";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Assign New Task</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Task Details */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Task Details</h3>

                  <div className="space-y-2">
                    <Label htmlFor="title">Task Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter task title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the task in detail..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="skills">Required Skills (comma-separated)</Label>
                    <Input
                      id="skills"
                      placeholder="e.g., React, Node.js, PostgreSQL"
                      value={requiredSkills}
                      onChange={(e) => {
                        setRequiredSkills(e.target.value);
                        if (e.target.value.trim()) {
                          setShowRecommendations(true);
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter skills to get AI-powered employee recommendations
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deadline">Deadline</Label>
                      <Input
                        id="deadline"
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="employee">Assign To *</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.profiles?.full_name || "Unknown"}
                            {emp.current_workload > 0 && ` (${emp.current_workload} tasks)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - AI Recommendations */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-semibold text-lg">AI Recommendations</h3>
                  </div>

                  {!showRecommendations || !requiredSkills.trim() ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Enter required skills to see employee recommendations</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {topRecommendations.map((emp, index) => (
                          <Card
                            key={emp.user_id}
                            className={`cursor-pointer transition-all ${selectedEmployee === emp.user_id
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:shadow-md'
                              } ${index === 0 ? 'border-yellow-300' : ''}`}
                            onClick={() => setSelectedEmployee(emp.user_id)}
                          >
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {index === 0 && (
                                      <Badge className="bg-yellow-500 hover:bg-yellow-600">
                                        <Star className="h-3 w-3 mr-1" />
                                        Top Match
                                      </Badge>
                                    )}
                                    <h4 className="font-semibold">
                                      {emp.profiles?.full_name || "Unknown"}
                                    </h4>
                                  </div>
                                  {emp.designation && (
                                    <p className="text-sm text-muted-foreground">
                                      {emp.designation} {emp.department && `• ${emp.department}`}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant={emp.matchScore >= 80 ? "default" : emp.matchScore >= 60 ? "secondary" : "outline"}
                                  className="text-lg font-bold"
                                >
                                  {emp.matchScore}%
                                </Badge>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Skill Match
                                  </span>
                                  <span className="font-medium">{emp.skillMatch}%</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    Availability
                                  </span>
                                  <span className="font-medium">{emp.workloadCapacity}%</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    Performance
                                  </span>
                                  <span className="font-medium">{emp.performance_score}%</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Current Workload</span>
                                  <Badge variant={emp.current_workload < 3 ? "outline" : emp.current_workload < 5 ? "secondary" : "destructive"}>
                                    {emp.current_workload} tasks
                                  </Badge>
                                </div>
                              </div>

                              {emp.skills && emp.skills.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-muted-foreground mb-1">Skills:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {emp.skills.slice(0, 5).map((skill, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                    {emp.skills.length > 5 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{emp.skills.length - 5} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}

                        {topRecommendations.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No employees found matching the criteria</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSubmit} disabled={loading || !selectedEmployee} className="flex-1">
            {loading ? "Assigning..." : "Assign Task"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskAssignmentDialog;
