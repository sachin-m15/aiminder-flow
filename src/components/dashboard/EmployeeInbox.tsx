import { useEffect, useState, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { rejectionReasonSchema, type RejectionReasonFormData } from "@/lib/validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("pending");
  const parentRef = useRef<HTMLDivElement>(null);

  const form = useForm<RejectionReasonFormData>({
    resolver: zodResolver(rejectionReasonSchema),
    defaultValues: {
      reason: "",
    },
  });

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

  // Filter invitations for current tab
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

  const rowVirtualizer = useVirtualizer({
    count: filteredInvitations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 250,
    overscan: 5,
  });

  useEffect(() => {
    loadInvitations();

    // Optimized subscription with selective field retrieval
    const channel = supabase
      .channel("optimized-invitations")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invitations",
          filter: `to_user_id=eq.${userId}`,
        },
        () => {
          loadInvitations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invitations",
          filter: `to_user_id=eq.${userId}`,
        },
        () => {
          loadInvitations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "invitations",
          filter: `to_user_id=eq.${userId}`,
        },
        () => {
          loadInvitations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadInvitations]);

  const handleResponse = async (invitationId: string, taskId: string, status: "accepted" | "rejected", reason?: string) => {
    setLoading({ ...loading, [invitationId]: true });

    try {
      // Use edge function for accepting/rejecting tasks
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          userId,
          action: status === "accepted" ? "accept_task" : "reject_task",
          actionData: {
            taskId,
            reason: status === "rejected" ? reason : undefined,
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
          rejection_reason: status === "rejected" ? reason : null,
        })
        .eq("id", invitationId);

      toast.success(status === "accepted" ? "✅ Task accepted!" : "❌ Invitation rejected");
      loadInvitations();
      form.reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update invitation";
      toast.error(errorMessage);
    } finally {
      setLoading({ ...loading, [invitationId]: false });
    }
  };

  const pendingCount = invitations.filter((inv) => inv.status === "pending").length;
  const acceptedCount = invitations.filter((inv) => inv.status === "accepted").length;
  const rejectedCount = invitations.filter((inv) => inv.status === "rejected").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" id="inbox-title">Task Invitations</h2>
        <Badge variant="secondary" aria-label={`${pendingCount} pending invitations`}>
          {pendingCount} pending
        </Badge>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-2" role="search" aria-label="Filter invitations">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search invitations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            aria-label="Search invitations by title or description"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by priority">
            <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
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
      <Tabs value={activeTab} onValueChange={setActiveTab} aria-labelledby="inbox-title">
        <TabsList className="grid w-full grid-cols-3" role="tablist">
          <TabsTrigger value="pending" role="tab" aria-selected={activeTab === "pending"}>
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="accepted" role="tab" aria-selected={activeTab === "accepted"}>
            Accepted ({acceptedCount})
          </TabsTrigger>
          <TabsTrigger value="rejected" role="tab" aria-selected={activeTab === "rejected"}>
            Rejected ({rejectedCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4" role="tabpanel" aria-labelledby="pending-tab">
          <div
            ref={parentRef}
            className="h-[400px] md:h-[500px] overflow-auto"
            aria-label="Pending invitations list"
          >
            {filteredInvitations.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  {searchQuery || priorityFilter !== "all"
                    ? "No invitations match your filters"
                    : "No pending invitations"}
                </CardContent>
              </Card>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const invitation = filteredInvitations[virtualItem.index];
                  return (
                    <div
                      key={invitation.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <Card className="m-1 md:m-2" aria-labelledby={`invitation-${invitation.id}-title`}>
                        <CardHeader className="p-4 md:p-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base md:text-lg" id={`invitation-${invitation.id}-title`}>{invitation.tasks.title}</CardTitle>
                              <p className="text-xs md:text-sm text-muted-foreground mt-1">
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
                              aria-label={`Priority: ${invitation.tasks.priority}`}
                            >
                              {invitation.tasks.priority}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 pt-0 space-y-3 md:space-y-4">
                          <p className="text-xs md:text-sm" aria-describedby={`invitation-${invitation.id}-title`}>
                            {invitation.tasks.description}
                          </p>

                          {invitation.tasks.required_skills?.length > 0 && (
                            <div className="flex flex-wrap gap-1 md:gap-2" aria-label="Required skills">
                              {invitation.tasks.required_skills.map((skill, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs" aria-label={skill}>
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {invitation.tasks.deadline && (
                            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
                              <span>Deadline: {new Date(invitation.tasks.deadline).toLocaleDateString()}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
                            <span>Received: {new Date(invitation.created_at).toLocaleString()}</span>
                          </div>

                          <Form {...form}>
                            <form onSubmit={form.handleSubmit((data) => handleResponse(invitation.id, invitation.task_id, "rejected", data.reason))} className="space-y-2">
                              <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel htmlFor={`rejection-reason-${invitation.id}`} className="text-xs md:text-sm">
                                      Reason for rejection (optional)
                                    </FormLabel>
                                    <FormControl>
                                      <Textarea
                                        id={`rejection-reason-${invitation.id}`}
                                        placeholder="Enter reason for rejection..."
                                        {...field}
                                        rows={2}
                                        className="text-xs md:text-sm"
                                        aria-describedby={`rejection-reason-help-${invitation.id}`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleResponse(invitation.id, invitation.task_id, "accepted")}
                                  disabled={loading[invitation.id]}
                                  className="flex-1 text-xs md:text-sm"
                                  aria-busy={loading[invitation.id]}
                                >
                                  <Check className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" aria-hidden="true" />
                                  Accept Task
                                </Button>
                                <Button
                                  type="submit"
                                  variant="destructive"
                                  disabled={loading[invitation.id]}
                                  className="flex-1 text-xs md:text-sm"
                                  aria-busy={loading[invitation.id]}
                                >
                                  <X className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" aria-hidden="true" />
                                  Reject
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="accepted" className="space-y-4" role="tabpanel" aria-labelledby="accepted-tab">
          <div
            ref={parentRef}
            className="h-[300px] md:h-[400px] overflow-auto"
            aria-label="Accepted invitations list"
          >
            {filteredInvitations.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No accepted invitations
                </CardContent>
              </Card>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const invitation = filteredInvitations[virtualItem.index];
                  return (
                    <div
                      key={invitation.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <Card key={invitation.id} className="border-green-200 dark:border-green-900 m-2" aria-labelledby={`accepted-${invitation.id}-title`}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2" id={`accepted-${invitation.id}-title`}>
                                <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
                                {invitation.tasks.title}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                From: {invitation.profiles?.full_name}
                              </p>
                            </div>
                            <Badge variant="outline" aria-label="Status: Accepted">Accepted</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-sm" aria-describedby={`accepted-${invitation.id}-title`}>
                            {invitation.tasks.description}
                          </p>
                          {invitation.tasks.deadline && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" aria-hidden="true" />
                              <span>Deadline: {new Date(invitation.tasks.deadline).toLocaleDateString()}</span>
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            Accepted: {invitation.responded_at ? new Date(invitation.responded_at).toLocaleString() : "N/A"}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4" role="tabpanel" aria-labelledby="rejected-tab">
          {filteredInvitations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No rejected invitations
              </CardContent>
            </Card>
          ) : (
            filteredInvitations.map((invitation) => (
              <Card key={invitation.id} className="border-red-200 dark:border-red-900" aria-labelledby={`rejected-${invitation.id}-title`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2" id={`rejected-${invitation.id}-title`}>
                        <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
                        {invitation.tasks.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        From: {invitation.profiles?.full_name}
                      </p>
                    </div>
                    <Badge variant="destructive" aria-label="Status: Rejected">Rejected</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm" aria-describedby={`rejected-${invitation.id}-title`}>
                    {invitation.tasks.description}
                  </p>
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
