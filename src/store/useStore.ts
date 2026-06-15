import { create } from "zustand";
import type {
  Store as StoreType,
  Anomaly,
  AnomalyStatus,
  DashboardStats,
  ImportBatch,
  ThresholdConfig,
  TrendData,
  ReviewLog,
} from "../../shared/types";

interface AppState {
  loading: boolean;
  error: string | null;
  stores: StoreType[];
  anomalies: (Anomaly & { storeName: string })[];
  anomalyFilters: {
    status?: AnomalyStatus;
    storeId?: string;
    startDate?: string;
    endDate?: string;
  };
  dashboardStats: DashboardStats | null;
  importBatches: ImportBatch[];
  thresholds: ThresholdConfig[];
  selectedTrend: TrendData | null;
  reviewLogs: ReviewLog[];
  currentUser: string;
  setCurrentUser: (user: string) => void;
  setAnomalyFilters: (filters: Partial<AppState["anomalyFilters"]>) => void;
  fetchStores: () => Promise<void>;
  fetchAnomalies: () => Promise<void>;
  fetchDashboardStats: () => Promise<void>;
  fetchImportBatches: () => Promise<void>;
  fetchThresholds: () => Promise<void>;
  fetchTrendData: (storeId: string) => Promise<void>;
  fetchReviewLogs: (anomalyId: string) => Promise<void>;
  reviewAnomaly: (id: string, payload: any) => Promise<void>;
  saveThreshold: (storeId: string | null, config: any) => Promise<void>;
  importData: (type: string, fileContent: string, fileType: string, batchId?: string) => Promise<any>;
  recalculateAnomalies: () => Promise<void>;
  clearError: () => void;
}

const API_BASE = "/api";

async function apiCall<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || "请求失败");
  }
  return data.data;
}

export const useStore = create<AppState>((set, get) => ({
  loading: false,
  error: null,
  stores: [],
  anomalies: [],
  anomalyFilters: {},
  dashboardStats: null,
  importBatches: [],
  thresholds: [],
  selectedTrend: null,
  reviewLogs: [],
  currentUser: "张管理员",

  setCurrentUser: (user) => set({ currentUser: user }),
  setAnomalyFilters: (filters) => set((state) => ({ anomalyFilters: { ...state.anomalyFilters, ...filters } })),
  clearError: () => set({ error: null }),

  fetchStores: async () => {
    set({ loading: true });
    try {
      const data = await apiCall<StoreType[]>("/stores");
      set({ stores: data });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAnomalies: async () => {
    set({ loading: true });
    try {
      const filters = get().anomalyFilters;
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.storeId) params.append("storeId", filters.storeId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      const data = await apiCall<(Anomaly & { storeName: string })[]>(
        `/anomalies?${params.toString()}`
      );
      set({ anomalies: data });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchDashboardStats: async () => {
    set({ loading: true });
    try {
      const data = await apiCall<DashboardStats>("/trends/stats");
      set({ dashboardStats: data });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchImportBatches: async () => {
    try {
      const data = await apiCall<ImportBatch[]>("/import/batches");
      set({ importBatches: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchThresholds: async () => {
    try {
      const data = await apiCall<ThresholdConfig[]>("/thresholds");
      set({ thresholds: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchTrendData: async (storeId) => {
    set({ loading: true });
    try {
      const data = await apiCall<TrendData>(`/trends/${storeId}`);
      set({ selectedTrend: data });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchReviewLogs: async (anomalyId) => {
    try {
      const data = await apiCall<ReviewLog[]>(`/anomalies/${anomalyId}/logs`);
      set({ reviewLogs: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  reviewAnomaly: async (id, payload) => {
    set({ loading: true });
    try {
      await apiCall(`/anomalies/${id}/review`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await get().fetchAnomalies();
      await get().fetchDashboardStats();
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  saveThreshold: async (storeId, config) => {
    set({ loading: true });
    try {
      const url = storeId ? `/thresholds/${storeId}` : "/thresholds/global";
      await apiCall(url, {
        method: "PUT",
        body: JSON.stringify(config),
      });
      await get().fetchThresholds();
      await get().fetchAnomalies();
      await get().fetchDashboardStats();
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  importData: async (type, fileContent, fileType, batchId) => {
    set({ loading: true });
    try {
      const result = await apiCall(`/import/${type}`, {
        method: "POST",
        body: JSON.stringify({ fileContent, fileType, batchId }),
      });
      await get().fetchImportBatches();
      await get().fetchAnomalies();
      await get().fetchDashboardStats();
      return result;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  recalculateAnomalies: async () => {
    set({ loading: true });
    try {
      const result = await apiCall("/anomalies/recalculate", { method: "POST" });
      await get().fetchAnomalies();
      await get().fetchDashboardStats();
      return result;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));
