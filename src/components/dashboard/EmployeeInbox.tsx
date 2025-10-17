import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Check, X, Clock, Calendar, Search, CheckCircle, XCircle, Filter } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Invitation {
  id: string;
  task_id: string;
  status: string;
  created_at: string;
  responded_at?: string;
  rejection_reason?: string;
  tasks: {
    title: string;
    description: string;
    priority: string;
    deadline?: string;
    required_skills: string[];
  };
  profiles: {
    full_name: string;
  };
}

interface EmployeeInboxProps {
  userId: string;
}

const EmployeeInbox = ({ userId }: EmployeeInboxProps) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("pending");

  const loadInvitations = useCallback(async () => {
    const { data } = await supabase
      .from("invitations")
      .select(`
        *,
        tasks (title, description, priority, deadline, required_skills),
        profiles:from_user_id (full_name)
      `)
      .eq("to_user_id", userId)
      .order("created_at", { ascending: false });

    if (data) setInvitations(data as unknown as Invitation[]);
  }, [userId]);

  useEffect(() => {
    loadInvitations();

    const channel = supabase
      .channel("invitations-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations" }, () => {
        loadInvitations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadInvitations]);

  const handleResponse = async (invitationId: string, taskId: string, status: "accepted" | "rejected") => {
    setLoading({ ...loading, [invitationId]: true });

    try {
      // Use edge function for accepting/rejecting tasks
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          userId,
          action: status === "accepted" ? "accept_task" : "reject_task",
          actionData: {
            taskId,
            reason: status === "rejected" ? rejectionReason[invitationId] : undefined,
          },
        },
      });

      if (error) throw error;

      // Also update invitation status
      await supabase
        .from("invitations")
        .update({
          status,
          responded_at: new Date().toISOString(),
          rejection_reason: status === "rejected" ? rejectionReason[invitationId] : null,
        })
        .eq("id", invitationId);

      toast.success(status === "accepted" ? "✅ Task accepted!" : "❌ Invitation rejected");
      loadInvitations();

      // Clear rejection reason
      if (status === "rejected") {
        setRejectionReason({ ...rejectionReason, [invitationId]: "" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update invitation";
      toast.error(errorMessage);
    } finally {
      setLoading({ ...loading, [invitationId]: false });
    }
  };

  // Filter invitations
  const filteredInvitations = invitations.filter((inv) => {
    // Tab filter
    if (activeTab === "pending" && inv.status !== "pending") return false;
    if (activeTab === "accepted" && inv.status !== "accepted") return false;
    if (activeTab === "rejected" && inv.status !== "rejected") return false;

    // Search filter
    if (searchQuery && !inv.tasks.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !inv.tasks.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Priority filter
    if (priorityFilter !== "all" && inv.tasks.priority !== priorityFilter) {
      return false;
    }

    return true;
  });

  const pendingCount = invitations.filter((inv) => inv.status === "pending").length;
  const acceptedCount = invitations.filter((inv) => inv.status === "accepted").length;
  const rejectedCount = invitations.filter((inv) => inv.status === "rejected").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Task Invitations</h2>
        <Badge variant="secondary">{pendingCount} pending</Badge>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invitations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="medium">Medium Priority</SelectItem>
            <SelectItem value="low">Low Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs for different statuses */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            Accepted ({acceptedCount})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {filteredInvitations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                {searchQuery || priorityFilter !== "all"
                  ? "No invitations match your filters"
                  : "No pending invitations"}
              </CardContent>
            </Card>
          ) : (
            filteredInvitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{invitation.tasks.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        From: {invitation.profiles?.full_name}
                      </p>
                    </div>
                    <Badge
                      variant={
                        invitation.tasks.priority === "high"
                          ? "destructive"
                          : invitation.tasks.priority === "medium"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {invitation.tasks.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{invitation.tasks.description}</p>

                  {invitation.tasks.required_skills?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {invitation.tasks.required_skills.map((skill, idx) => (
                        <Badge key={idx} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {invitation.tasks.deadline && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Deadline: {new Date(invitation.tasks.deadline).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Received: {new Date(invitation.created_at).toLocaleString()}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Reason for rejection (optional)"
                      value={rejectionReason[invitation.id] || ""}
                      onChange={(e) =>
                        setRejectionReason({ ...rejectionReason, [invitation.id]: e.target.value })
                      }
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleResponse(invitation.id, invitation.task_id, "accepted")}
                        disabled={loading[invitation.id]}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Accept Task
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleResponse(invitation.id, invitation.task_id, "rejected")}
                        disabled={loading[invitation.id]}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="accepted" className="space-y-4">
          {filteredInvitations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No accepted invitations
              </CardContent>
            </Card>
          ) : (
            filteredInvitations.map((invitation) => (
              <Card key={invitation.id} className="border-green-200 dark:border-green-900">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        {invitation.tasks.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        From: {invitation.profiles?.full_name}
                      </p>
                    </div>
                    <Badge variant="outline">Accepted</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">{invitation.tasks.description}</p>
                  {invitation.tasks.deadline && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Deadline: {new Date(invitation.tasks.deadline).toLocaleDateString()}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Accepted: {invitation.responded_at ? new Date(invitation.responded_at).toLocaleString() : "N/A"}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {filteredInvitations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No rejected invitations
              </CardContent>
            </Card>
          ) : (
            filteredInvitations.map((invitation) => (
              <Card key={invitation.id} className="border-red-200 dark:border-red-900">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        {invitation.tasks.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        From: {invitation.profiles?.full_name}
                      </p>
                    </div>
                    <Badge variant="destructive">Rejected</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">{invitation.tasks.description}</p>
                  {invitation.rejection_reason && (
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium">Rejection Reason:</p>
                      <p className="text-sm text-muted-foreground">{invitation.rejection_reason}</p>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Rejected: {invitation.responded_at ? new Date(invitation.responded_at).toLocaleString() : "N/A"}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeInbox;
