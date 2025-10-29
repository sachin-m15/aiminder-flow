import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { paymentAmountSchema, type PaymentAmountFormData } from '@/lib/validation';

export interface Payment {
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

interface PaymentState {
  payments: Payment[];
  selectedPayment: Payment | null;
  loading: { [key: string]: boolean };
  searchQuery: string;
  statusFilter: string;
  activeTab: string;
  showApprovalDialog: boolean;
  approvalAction: "approve" | "reject" | null;
  showAmountEdit: string | null;
  
  // Actions
  loadPayments: (userId: string, userRole: string) => Promise<void>;
  setSelectedPayment: (payment: Payment | null) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: string) => void;
  setActiveTab: (tab: string) => void;
  setShowApprovalDialog: (show: boolean) => void;
  setApprovalAction: (action: "approve" | "reject" | null) => void;
  setShowAmountEdit: (paymentId: string | null) => void;
  
  approvePayment: (paymentId: string) => Promise<void>;
  markAsPaid: (paymentId: string) => Promise<void>;
  updateManualAmount: (paymentId: string, data: PaymentAmountFormData) => Promise<void>;
  subscribeToPaymentUpdates: (userId: string, userRole: string) => () => void;
  
  // Computed values
  getFilteredPayments: () => Payment[];
  getPaymentStats: () => {
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
  };
  calculateDifference: (payment: Payment) => { diff: number; percentage: string };
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  selectedPayment: null,
  loading: {},
  searchQuery: "",
  statusFilter: "all",
  activeTab: "all",
  showApprovalDialog: false,
  approvalAction: null,
  showAmountEdit: null,
  
  loadPayments: async (userId: string, userRole: string) => {
    try {
      // First, get payments with tasks
      let paymentsQuery = supabase
        .from("payments")
        .select(`*, tasks (title, description)`)
        .order("created_at", { ascending: false });

      if (userRole === "employee") {
        paymentsQuery = paymentsQuery.eq("user_id", userId);
      }

      const { data: paymentsData, error: paymentsError } = await paymentsQuery;
      
      if (paymentsError) throw paymentsError;
      
      if (!paymentsData || paymentsData.length === 0) {
        set({ payments: [] });
        return;
      }

      // Get user IDs from payments
      const userIds = [...new Set(paymentsData.map(p => p.user_id))];
      
      // Fetch profiles for those users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      if (profilesError) throw profilesError;
      
      // Merge the data
      const paymentsWithProfiles = paymentsData.map(payment => ({
        ...payment,
        profiles: profilesData?.find(p => p.id === payment.user_id) || { full_name: "", email: "" }
      }));

      set({ payments: paymentsWithProfiles as unknown as Payment[] });
    } catch (error) {
      console.error("Error loading payments:", error);
      toast.error("Failed to load payments");
    }
  },
  
  setSelectedPayment: (payment) => set({ selectedPayment: payment }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  setShowApprovalDialog: (show) => set({ showApprovalDialog: show }),
  
  setApprovalAction: (action) => set({ approvalAction: action }),
  
  setShowAmountEdit: (paymentId) => set({ showAmountEdit: paymentId }),
  
  approvePayment: async (paymentId: string) => {
    set((state) => ({ loading: { ...state.loading, [paymentId]: true } }));
    
    try {
      const { error } = await supabase
        .from("payments")
        .update({ status: "approved" })
        .eq("id", paymentId);

      if (error) throw error;

      toast.success("✅ Payment approved successfully!");
      set({ showApprovalDialog: false, selectedPayment: null });
      get().loadPayments('', ''); // Reload payments
    } catch (error) {
      console.error("Error approving payment:", error);
      toast.error("Failed to approve payment");
    } finally {
      set((state) => ({ loading: { ...state.loading, [paymentId]: false } }));
    }
  },
  
  markAsPaid: async (paymentId: string) => {
    set((state) => ({ loading: { ...state.loading, [paymentId]: true } }));
    
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
      get().loadPayments('', ''); // Reload payments
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      toast.error("Failed to mark payment as paid");
    } finally {
      set((state) => ({ loading: { ...state.loading, [paymentId]: false } }));
    }
  },
  
  updateManualAmount: async (paymentId: string, data: PaymentAmountFormData) => {
    set((state) => ({ loading: { ...state.loading, [paymentId]: true } }));
    
    try {
      const { error } = await supabase
        .from("payments")
        .update({ amount_manual: data.amount })
        .eq("id", paymentId);

      if (error) throw error;

      toast.success("✏️ Manual amount updated!");
      get().loadPayments('', ''); // Reload payments
      set({ showAmountEdit: null });
    } catch (error) {
      console.error("Error updating manual amount:", error);
      toast.error("Failed to update amount");
    } finally {
      set((state) => ({ loading: { ...state.loading, [paymentId]: false } }));
    }
  },
  
  subscribeToPaymentUpdates: (userId: string, userRole: string) => {
    const channel = supabase
      .channel("payment-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          get().loadPayments(userId, userRole);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
  
  getFilteredPayments: () => {
    const { payments, activeTab, searchQuery, statusFilter } = get();
    
    const filteredByTab = payments.filter((payment) => {
      if (activeTab === "all") return true;
      return payment.status === activeTab;
    });

    const filteredBySearch = filteredByTab.filter((payment) =>
      payment.tasks.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.profiles?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return statusFilter === "all"
      ? filteredBySearch
      : filteredBySearch.filter((payment) => payment.status === statusFilter);
  },
  
  getPaymentStats: () => {
    const { payments } = get();
    
    const pendingCount = payments.filter((p) => p.status === "pending").length;
    const approvedCount = payments.filter((p) => p.status === "approved").length;
    const paidCount = payments.filter((p) => p.status === "paid").length;
    
    const totalPending = payments
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + (p.amount_manual || 0), 0);
    
    const totalApproved = payments
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + (p.amount_manual || 0), 0);
    
    const totalPaid = payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + (p.amount_manual || 0), 0);
    
    return {
      pendingCount,
      approvedCount,
      paidCount,
      totalPending,
      totalApproved,
      totalPaid
    };
  },
  
  calculateDifference: (payment: Payment) => {
    const diff = payment.amount_ai_suggested - payment.amount_manual;
    const percentage = ((diff / payment.amount_manual) * 100).toFixed(1);
    return { diff, percentage };
  }
}));

// Selectors for optimized re-renders
export const usePayments = () => usePaymentStore((state) => state.payments);
export const useSelectedPayment = () => usePaymentStore((state) => state.selectedPayment);
export const usePaymentLoading = () => usePaymentStore((state) => state.loading);
export const usePaymentSearchQuery = () => usePaymentStore((state) => state.searchQuery);
export const usePaymentStatusFilter = () => usePaymentStore((state) => state.statusFilter);
export const usePaymentActiveTab = () => usePaymentStore((state) => state.activeTab);
export const usePaymentActions = () => usePaymentStore((state) => ({
  loadPayments: state.loadPayments,
  setSelectedPayment: state.setSelectedPayment,
  setSearchQuery: state.setSearchQuery,
  setStatusFilter: state.setStatusFilter,
  setActiveTab: state.setActiveTab,
  setShowApprovalDialog: state.setShowApprovalDialog,
  setApprovalAction: state.setApprovalAction,
  setShowAmountEdit: state.setShowAmountEdit,
  approvePayment: state.approvePayment,
  markAsPaid: state.markAsPaid,
  updateManualAmount: state.updateManualAmount,
  subscribeToPaymentUpdates: state.subscribeToPaymentUpdates,
  getFilteredPayments: state.getFilteredPayments,
  getPaymentStats: state.getPaymentStats,
  calculateDifference: state.calculateDifference
}));