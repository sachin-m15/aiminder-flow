import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  id: string;
  task_id: string;
  status: string;
  created_at: string;
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
  }, [userId]);

  const loadInvitations = async () => {
    const { data } = await supabase
      .from("invitations")
      .select(`
        *,
        tasks (title, description, priority, deadline, required_skills),
        profiles:from_user_id (full_name)
      `)
      .eq("to_user_id", userId)
      .order("created_at", { ascending: false });

    if (data) setInvitations(data as any);
  };

  const handleResponse = async (invitationId: string, status: "accepted" | "rejected") => {
    setLoading({ ...loading, [invitationId]: true });

    try {
      const updateData: any = {
        status,
        responded_at: new Date().toISOString(),
      };

      if (status === "rejected" && rejectionReason[invitationId]) {
        updateData.rejection_reason = rejectionReason[invitationId];
      }

      const { error } = await supabase
        .from("invitations")
        .update(updateData)
        .eq("id", invitationId);

      if (error) throw error;

      toast.success(status === "accepted" ? "Task accepted!" : "Invitation rejected");
      loadInvitations();
    } catch (error: any) {
      toast.error(error.message || "Failed to update invitation");
    } finally {
      setLoading({ ...loading, [invitationId]: false });
    }
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Task Invitations</h2>

      {pendingInvitations.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No pending invitations
          </CardContent>
        </Card>
      ) : (
        pendingInvitations.map((invitation) => (
          <Card key={invitation.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{invitation.tasks.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    From: {invitation.profiles?.full_name}
                  </p>
                </div>
                <Badge variant={
                  invitation.tasks.priority === "high" ? "destructive" :
                  invitation.tasks.priority === "medium" ? "default" : "secondary"
                }>
                  {invitation.tasks.priority}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{invitation.tasks.description}</p>

              {invitation.tasks.required_skills?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {invitation.tasks.required_skills.map((skill, idx) => (
                    <Badge key={idx} variant="outline">{skill}</Badge>
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
                    onClick={() => handleResponse(invitation.id, "accepted")}
                    disabled={loading[invitation.id]}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Accept Task
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleResponse(invitation.id, "rejected")}
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
    </div>
  );
};

export default EmployeeInbox;
