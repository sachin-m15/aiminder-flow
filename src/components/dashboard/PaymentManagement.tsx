import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DollarSign, TrendingUp, TrendingDown, Check, X, Search, Filter } from "lucide-react";
import { toast } from "sonner";

interface Payment {
    id: string;
    user_id: string;
    task_id: string;
    amount_manual: number;
    amount_ai_suggested: number;
    status: "pending" | "approved" | "paid";
    created_at: string;
    paid_at?: string;
    tasks: {
        title: string;
        description: string;
    };
    profiles: {
        full_name: string;
        email: string;
    };
}

interface PaymentManagementProps {
    userId: string;
    userRole: string;
}

const PaymentManagement = ({ userId, userRole }: PaymentManagementProps) => {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [activeTab, setActiveTab] = useState<string>("all");
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);

    const loadPayments = useCallback(async () => {
        try {
            let query = supabase
                .from("payments")
                .select(`
          *,
          tasks (title, description),
          profiles:user_id (full_name, email)
        `)
                .order("created_at", { ascending: false });

            // If employee, only show their payments
            if (userRole === "employee") {
                query = query.eq("user_id", userId);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (data) setPayments(data as unknown as Payment[]);
        } catch (error) {
            console.error("Error loading payments:", error);
            toast.error("Failed to load payments");
        }
    }, [userId, userRole]);

    useEffect(() => {
        loadPayments();

        // Subscribe to payment updates
        const channel = supabase
            .channel("payment-updates")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "payments" },
                () => {
                    loadPayments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadPayments]);

    const handleApprovePayment = async (paymentId: string) => {
        setLoading({ ...loading, [paymentId]: true });

        try {
            const { error } = await supabase
                .from("payments")
                .update({ status: "approved" })
                .eq("id", paymentId);

            if (error) throw error;

            toast.success("✅ Payment approved successfully!");
            setShowApprovalDialog(false);
            setSelectedPayment(null);
            loadPayments();
        } catch (error) {
            console.error("Error approving payment:", error);
            toast.error("Failed to approve payment");
        } finally {
            setLoading({ ...loading, [paymentId]: false });
        }
    };

    const handleMarkAsPaid = async (paymentId: string) => {
        setLoading({ ...loading, [paymentId]: true });

        try {
            const { error } = await supabase
                .from("payments")
                .update({
                    status: "paid",
                    paid_at: new Date().toISOString(),
                })
                .eq("id", paymentId);

            if (error) throw error;

            toast.success("💰 Payment marked as paid!");
            loadPayments();
        } catch (error) {
            console.error("Error marking payment as paid:", error);
            toast.error("Failed to mark payment as paid");
        } finally {
            setLoading({ ...loading, [paymentId]: false });
        }
    };

    const handleUpdateManualAmount = async (paymentId: string, newAmount: number) => {
        setLoading({ ...loading, [paymentId]: true });

        try {
            const { error } = await supabase
                .from("payments")
                .update({ amount_manual: newAmount })
                .eq("id", paymentId);

            if (error) throw error;

            toast.success("✏️ Manual amount updated!");
            loadPayments();
        } catch (error) {
            console.error("Error updating manual amount:", error);
            toast.error("Failed to update amount");
        } finally {
            setLoading({ ...loading, [paymentId]: false });
        }
    };

    // Calculate AI vs Manual difference
    const calculateDifference = (payment: Payment) => {
        const diff = payment.amount_ai_suggested - payment.amount_manual;
        const percentage = ((diff / payment.amount_manual) * 100).toFixed(1);
        return { diff, percentage };
    };

    // Filter payments
    const filteredByTab = payments.filter((payment) => {
        if (activeTab === "all") return true;
        return payment.status === activeTab;
    });

    const filteredBySearch = filteredByTab.filter((payment) =>
        payment.tasks.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.profiles?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredPayments =
        statusFilter === "all"
            ? filteredBySearch
            : filteredBySearch.filter((payment) => payment.status === statusFilter);

    // Calculate counts
    const pendingCount = payments.filter((p) => p.status === "pending").length;
    const approvedCount = payments.filter((p) => p.status === "approved").length;
    const paidCount = payments.filter((p) => p.status === "paid").length;

    // Calculate totals
    const totalPending = payments
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + (p.amount_manual || 0), 0);
    const totalApproved = payments
        .filter((p) => p.status === "approved")
        .reduce((sum, p) => sum + (p.amount_manual || 0), 0);
    const totalPaid = payments
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + (p.amount_manual || 0), 0);

    const openApprovalDialog = (payment: Payment, action: "approve" | "reject") => {
        setSelectedPayment(payment);
        setApprovalAction(action);
        setShowApprovalDialog(true);
    };

    const renderPaymentRow = (payment: Payment) => {
        const { diff, percentage } = calculateDifference(payment);
        const isAISuggestionHigher = diff > 0;

        return (
            <TableRow key={payment.id}>
                <TableCell>
                    <div>
                        <div className="font-medium">{payment.profiles?.full_name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">{payment.profiles?.email}</div>
                    </div>
                </TableCell>
                <TableCell>
                    <div>
                        <div className="font-medium">{payment.tasks.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                            {payment.tasks.description}
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="font-mono">${payment.amount_manual.toFixed(2)}</div>
                </TableCell>
                <TableCell>
                    <div className="font-mono">${payment.amount_ai_suggested.toFixed(2)}</div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        {isAISuggestionHigher ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span
                            className={`font-mono ${isAISuggestionHigher ? "text-green-600" : "text-red-600"
                                }`}
                        >
                            ${Math.abs(diff).toFixed(2)} ({percentage}%)
                        </span>
                    </div>
                </TableCell>
                <TableCell>
                    <Badge
                        variant={
                            payment.status === "paid"
                                ? "default"
                                : payment.status === "approved"
                                    ? "secondary"
                                    : "outline"
                        }
                    >
                        {payment.status}
                    </Badge>
                </TableCell>
                {userRole !== "employee" && (
                    <TableCell>
                        <div className="flex gap-2">
                            {payment.status === "pending" && (
                                <>
                                    <Button
                                        size="sm"
                                        onClick={() => openApprovalDialog(payment, "approve")}
                                        disabled={loading[payment.id]}
                                    >
                                        <Check className="h-4 w-4 mr-1" />
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            const newAmount = prompt(
                                                "Enter new manual amount:",
                                                payment.amount_manual.toString()
                                            );
                                            if (newAmount) {
                                                handleUpdateManualAmount(payment.id, parseFloat(newAmount));
                                            }
                                        }}
                                    >
                                        Edit
                                    </Button>
                                </>
                            )}
                            {payment.status === "approved" && (
                                <Button
                                    size="sm"
                                    onClick={() => handleMarkAsPaid(payment.id)}
                                    disabled={loading[payment.id]}
                                >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Mark Paid
                                </Button>
                            )}
                            {payment.status === "paid" && payment.paid_at && (
                                <div className="text-sm text-muted-foreground">
                                    {new Date(payment.paid_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </TableCell>
                )}
            </TableRow>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header with Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Pending Payments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalPending.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">{pendingCount} payments</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Approved Payments
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalApproved.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">{approvedCount} payments</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Paid Out
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">{paidCount} payments</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by employee or task..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">All ({payments.length})</TabsTrigger>
                    <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                    <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
                    <TabsTrigger value="paid">Paid ({paidCount})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {filteredPayments.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    {searchQuery || statusFilter !== "all"
                                        ? "No payments match your filters"
                                        : "No payments found"}
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Task</TableHead>
                                            <TableHead>Manual Amount</TableHead>
                                            <TableHead>AI Suggested</TableHead>
                                            <TableHead>Difference</TableHead>
                                            <TableHead>Status</TableHead>
                                            {userRole !== "employee" && <TableHead>Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPayments.map((payment) => renderPaymentRow(payment))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Approval Dialog */}
            <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {approvalAction === "approve" ? "Approve Payment" : "Reject Payment"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedPayment && (
                                <div className="space-y-2 mt-4">
                                    <div>
                                        <strong>Employee:</strong> {selectedPayment.profiles?.full_name}
                                    </div>
                                    <div>
                                        <strong>Task:</strong> {selectedPayment.tasks.title}
                                    </div>
                                    <div>
                                        <strong>Manual Amount:</strong> ${selectedPayment.amount_manual.toFixed(2)}
                                    </div>
                                    <div>
                                        <strong>AI Suggested:</strong> $
                                        {selectedPayment.amount_ai_suggested.toFixed(2)}
                                    </div>
                                    <div>
                                        <strong>Difference:</strong>{" "}
                                        {(() => {
                                            const { diff, percentage } = calculateDifference(selectedPayment);
                                            return `$${Math.abs(diff).toFixed(2)} (${percentage}%)`;
                                        })()}
                                    </div>
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (selectedPayment && approvalAction === "approve") {
                                    handleApprovePayment(selectedPayment.id);
                                }
                            }}
                        >
                            {approvalAction === "approve" ? "Approve" : "Reject"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default PaymentManagement;
