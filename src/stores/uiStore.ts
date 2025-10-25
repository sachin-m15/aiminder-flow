import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Theme preferences
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  
  // Dashboard states
  activeView: string;
  searchQuery: string;
  refreshTrigger: number;
  
  // Filters and sorting
  statusFilter: string;
  priorityFilter: string;
  sortBy: string;
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveView: (view: string) => void;
  setSearchQuery: (query: string) => void;
  triggerRefresh: () => void;
  setStatusFilter: (filter: string) => void;
  setPriorityFilter: (filter: string) => void;
  setSortBy: (sort: string) => void;
  
  // Computed values
  isDarkMode: () => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      sidebarOpen: true,
      sidebarCollapsed: false,
      activeView: 'dashboard',
      searchQuery: '',
      refreshTrigger: 0,
      statusFilter: 'all',
      priorityFilter: 'all',
      sortBy: 'created_at',
      
      setTheme: (theme) => set({ theme }),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      setActiveView: (view) => set({ activeView: view }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
      
      setStatusFilter: (filter) => set({ statusFilter: filter }),
      
      setPriorityFilter: (filter) => set({ priorityFilter: filter }),
      
      setSortBy: (sort) => set({ sortBy: sort }),
      
      isDarkMode: () => {
        const { theme } = get();
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return theme === 'dark';
      }
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        activeView: state.activeView,
        statusFilter: state.statusFilter,
        priorityFilter: state.priorityFilter,
        sortBy: state.sortBy,
      }),
    }
  )
);

// Selectors for optimized re-renders
export const useTheme = () => useUIStore((state) => state.theme);
export const useSidebarState = () => useUIStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  sidebarCollapsed: state.sidebarCollapsed
}));
export const useActiveView = () => useUIStore((state) => state.activeView);
export const useSearchQuery = () => useUIStore((state) => state.searchQuery);
export const useRefreshTrigger = () => useUIStore((state) => state.refreshTrigger);
export const useFilters = () => useUIStore((state) => ({
  statusFilter: state.statusFilter,
  priorityFilter: state.priorityFilter,
  sortBy: state.sortBy
}));
export const useUIActions = () => useUIStore((state) => ({
  setTheme: state.setTheme,
  toggleSidebar: state.toggleSidebar,
  setSidebarOpen: state.setSidebarOpen,
  setSidebarCollapsed: state.setSidebarCollapsed,
  setActiveView: state.setActiveView,
  setSearchQuery: state.setSearchQuery,
  triggerRefresh: state.triggerRefresh,
  setStatusFilter: state.setStatusFilter,
  setPriorityFilter: state.setPriorityFilter,
  setSortBy: state.setSortBy
}));