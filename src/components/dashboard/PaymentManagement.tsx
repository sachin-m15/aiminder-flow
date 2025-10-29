import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { paymentAmountSchema, type PaymentAmountFormData } from "@/lib/validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import ErrorBoundary from "@/components/ui/error-boundary";
import { useAuthStore } from "@/stores/authStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { useUIStore } from "@/stores/uiStore";

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
  userRole: string;
}

const PaymentManagement = ({ userRole }: PaymentManagementProps) => {
  const { user } = useAuthStore();
  const { 
    payments, 
    selectedPayment, 
    loading, 
    searchQuery, 
    statusFilter, 
    activeTab, 
    showApprovalDialog, 
    approvalAction, 
    showAmountEdit,
    loadPayments, 
    setSelectedPayment, 
    setSearchQuery, 
    setStatusFilter, 
    setActiveTab, 
    setShowApprovalDialog, 
    setApprovalAction, 
    setShowAmountEdit,
    approvePayment, 
    markAsPaid, 
    updateManualAmount, 
    subscribeToPaymentUpdates,
    getFilteredPayments,
    getPaymentStats,
    calculateDifference
  } = usePaymentStore();

  const form = useForm<PaymentAmountFormData>({
    resolver: zodResolver(paymentAmountSchema),
    defaultValues: {
      amount: 0,
    },
  });

  useEffect(() => {
    if (user?.id) {
      loadPayments(user.id, userRole);
      const unsubscribe = subscribeToPaymentUpdates(user.id, userRole);
      return unsubscribe;
    }
  }, [user?.id, userRole, loadPayments, subscribeToPaymentUpdates]);

  const handleStartAmountEdit = (payment: Payment) => {
    setShowAmountEdit(payment.id);
    form.reset({ amount: payment.amount_manual });
  };

  const handleCancelAmountEdit = () => {
    setShowAmountEdit(null);
    form.reset({ amount: 0 });
  };

  const filteredPayments = getFilteredPayments();
  const { pendingCount, approvedCount, paidCount, totalPending, totalApproved, totalPaid } = getPaymentStats();

  const openApprovalDialog = (payment: Payment, action: "approve" | "reject") => {
    setSelectedPayment(payment);
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const renderPaymentRow = (payment: Payment) => {
    const { diff, percentage } = calculateDifference(payment);
    const isAISuggestionHigher = diff > 0;

    return (
      <TableRow key={payment.id} aria-label={`Payment for ${payment.tasks.title} by ${payment.profiles?.full_name || 'Unknown'}`}>
        <TableCell>
          <div>
            <div className="font-medium" aria-label={`Employee: ${payment.profiles?.full_name || "Unknown"}`}>
              {payment.profiles?.full_name || "Unknown"}
            </div>
            <div className="text-sm text-muted-foreground" aria-label={`Email: ${payment.profiles?.email}`}>
              {payment.profiles?.email}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div>
            <div className="font-medium" aria-label={`Task: ${payment.tasks.title}`}>
              {payment.tasks.title}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-1" aria-label={`Description: ${payment.tasks.description}`}>
              {payment.tasks.description}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="font-mono" aria-label={`Manual amount: $${payment.amount_manual.toFixed(2)}`}>
            ${payment.amount_manual.toFixed(2)}
          </div>
        </TableCell>
        <TableCell>
          <div className="font-mono" aria-label={`AI suggested amount: $${payment.amount_ai_suggested.toFixed(2)}`}>
            ${payment.amount_ai_suggested.toFixed(2)}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2" aria-label={`Difference: $${Math.abs(diff).toFixed(2)} (${percentage}%), ${isAISuggestionHigher ? 'AI suggestion higher' : 'Manual amount higher'}`}>
            {isAISuggestionHigher ? (
              <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" aria-hidden="true" />
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
            aria-label={`Status: ${payment.status}`}
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
                    aria-label={`Approve payment for ${payment.tasks.title}`}
                    aria-busy={loading[payment.id]}
                  >
                    <Check className="h-4 w-4 mr-1" aria-hidden="true" />
                    Approve
                  </Button>
                  {showAmountEdit === payment.id ? (
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit((data) => updateManualAmount(payment.id, data))}
                        className="flex gap-2"
                      >
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                                  className="h-8"
                                  aria-label="Edit manual amount"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          size="sm"
                          type="submit"
                          disabled={loading[payment.id]}
                          aria-label="Save amount"
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelAmountEdit}
                          disabled={loading[payment.id]}
                          aria-label="Cancel edit"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      </form>
                    </Form>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartAmountEdit(payment)}
                      aria-label={`Edit manual amount for ${payment.tasks.title}`}
                    >
                      Edit
                    </Button>
                  )}
                </>
              )}
              {payment.status === "approved" && (
                <Button
                  size="sm"
                  onClick={() => markAsPaid(payment.id)}
                  disabled={loading[payment.id]}
                  aria-label={`Mark payment as paid for ${payment.tasks.title}`}
                  aria-busy={loading[payment.id]}
                >
                  <DollarSign className="h-4 w-4 mr-1" aria-hidden="true" />
                  Mark Paid
                </Button>
              )}
              {payment.status === "paid" && payment.paid_at && (
                <div className="text-sm text-muted-foreground" aria-label={`Paid on ${new Date(payment.paid_at).toLocaleDateString()}`}>
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
    <ErrorBoundary componentName="PaymentManagement">
      <div className="space-y-6">
        {/* Header with Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4" aria-label="Payment summary">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" aria-label={`Total pending: $${totalPending.toFixed(2)}`}>
                ${totalPending.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground" aria-label={`${pendingCount} payments pending`}>
                {pendingCount} payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" aria-label={`Total approved: $${totalApproved.toFixed(2)}`}>
                ${totalApproved.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground" aria-label={`${approvedCount} payments approved`}>
                {approvedCount} payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paid Out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" aria-label={`Total paid: $${totalPaid.toFixed(2)}`}>
                ${totalPaid.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground" aria-label={`${paidCount} payments paid`}>
                {paidCount} payments
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2" role="search" aria-label="Filter payments">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search by employee or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
              aria-label="Search payments by employee name or task title"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by payment status">
              <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
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
        <Tabs value={activeTab} onValueChange={setActiveTab} aria-label="Payment status tabs">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4" role="tablist">
            <TabsTrigger value="all" role="tab" aria-selected={activeTab === "all"} className="text-xs sm:text-sm">
              All ({payments.length})
            </TabsTrigger>
            <TabsTrigger value="pending" role="tab" aria-selected={activeTab === "pending"} className="text-xs sm:text-sm">
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="approved" role="tab" aria-selected={activeTab === "approved"} className="text-xs sm:text-sm">
              Approved ({approvedCount})
            </TabsTrigger>
            <TabsTrigger value="paid" role="tab" aria-selected={activeTab === "paid"} className="text-xs sm:text-sm">
              Paid ({paidCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4" role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" aria-live="polite">
                    {searchQuery || statusFilter !== "all"
                      ? "No payments match your filters"
                      : "No payments found"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col" className="text-xs sm:text-sm">Employee</TableHead>
                          <TableHead scope="col" className="text-xs sm:text-sm">Task</TableHead>
                          <TableHead scope="col" className="text-xs sm:text-sm">Manual</TableHead>
                          <TableHead scope="col" className="text-xs sm:text-sm">AI</TableHead>
                          <TableHead scope="col" className="text-xs sm:text-sm">Diff</TableHead>
                          <TableHead scope="col" className="text-xs sm:text-sm">Status</TableHead>
                          {userRole !== "employee" && <TableHead scope="col" className="text-xs sm:text-sm">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPayments.map((payment) => renderPaymentRow(payment))}
                      </TableBody>
                    </Table>
                  </div>
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
                    approvePayment(selectedPayment.id);
                  }
                }}
              >
                {approvalAction === "approve" ? "Approve" : "Reject"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  );
};

export default PaymentManagement;