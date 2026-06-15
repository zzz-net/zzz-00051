import { create } from "zustand";
import type {
  Store as StoreType,
  Anomaly,
  AnomalyStatus,
  DashboardStats,
  ImportBatch,
  ImportBatchDetail,
  ImportBatchType,
  ImportBatchStatus,
  ThresholdConfig,
  TrendData,
  ReviewLog,
  BatchFilter,
  CockpitRun,
  CockpitSummary,
  CockpitCheckpoint,
  AcceptanceRun,
  AcceptanceSummary,
  AcceptancePackageInfo,
  AcceptanceExportFile,
} from "../../shared/types";

const LS_BATCH_FILTERS = "dm_batch_filters";
const LS_RECENT_BATCHES = "dm_recent_batches";
const LS_ANOMALY_FILTERS = "dm_anomaly_filters";
const MAX_RECENT = 5;

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

function saveToLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

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
  batchFilters: BatchFilter;
  recentBatchIds: string[];
  selectedBatchDetail: ImportBatchDetail | null;
  thresholds: ThresholdConfig[];
  selectedTrend: TrendData | null;
  reviewLogs: ReviewLog[];
  currentUser: string;
  setCurrentUser: (user: string) => void;
  setAnomalyFilters: (filters: Partial<AppState["anomalyFilters"]>) => void;
  setBatchFilters: (filters: Partial<BatchFilter>) => void;
  clearBatchFilters: () => void;
  clearAnomalyFilters: () => void;
  markRecentBatch: (batchId: string) => void;
  clearRecentBatches: () => void;
  fetchStores: () => Promise<void>;
  fetchAnomalies: () => Promise<void>;
  fetchDashboardStats: () => Promise<void>;
  fetchImportBatches: () => Promise<void>;
  fetchBatchDetail: (batchId: string) => Promise<ImportBatchDetail | null>;
  fetchThresholds: () => Promise<void>;
  fetchTrendData: (storeId: string) => Promise<void>;
  fetchReviewLogs: (anomalyId: string) => Promise<void>;
  reviewAnomaly: (id: string, payload: any) => Promise<void>;
  saveThreshold: (storeId: string | null, config: any) => Promise<void>;
  importData: (
    type: string,
    fileContent: string,
    fileType: string,
    batchId?: string,
    fileName?: string
  ) => Promise<any>;
  retryImport: (parentBatchId: string, correctedContent: string, newBatchId?: string) => Promise<any>;
  exportBatch: (batchId: string, format: "csv" | "json") => void;
  recalculateAnomalies: () => Promise<void>;
  cockpitSummary: CockpitSummary | null;
  cockpitCurrentRun: CockpitRun | null;
  cockpitRuns: CockpitRun[];
  cockpitCheckpoints: CockpitCheckpoint[];
  cockpitRunning: boolean;
  fetchCockpitSummary: () => Promise<void>;
  startCockpitRun: (prefix?: string) => Promise<CockpitRun>;
  fetchCockpitRuns: () => Promise<void>;
  fetchCockpitRunDetail: (runId: string) => Promise<void>;
  fetchCockpitCheckpoints: (runId: string) => Promise<void>;
  acceptanceSummary: AcceptanceSummary | null;
  acceptanceCurrentRun: AcceptanceRun | null;
  acceptanceRuns: AcceptanceRun[];
  acceptanceRunning: boolean;
  acceptancePackageInfo: AcceptancePackageInfo | null;
  acceptanceFiles: AcceptanceExportFile[];
  fetchAcceptanceSummary: () => Promise<void>;
  startAcceptanceDrill: (name?: string) => Promise<AcceptanceRun>;
  resumeAcceptanceDrill: (runId: string) => Promise<AcceptanceRun>;
  verifyRestartRecovery: (runId: string) => Promise<AcceptanceRun>;
  fetchAcceptanceRuns: () => Promise<void>;
  fetchAcceptanceRunDetail: (runId: string) => Promise<void>;
  fetchAcceptancePackageInfo: (runId: string) => Promise<void>;
  fetchAcceptanceFiles: (runId: string) => Promise<void>;
  downloadAcceptanceFile: (runId: string, filename: string) => void;
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
    const err = data.error || data.message || (data.errors?.join?.("; ") || "请求失败");
    throw new Error(err);
  }
  return data.data;
}

export const useStore = create<AppState>((set, get) => ({
  loading: false,
  error: null,
  stores: [],
  anomalies: [],
  anomalyFilters: loadFromLS(LS_ANOMALY_FILTERS, {}),
  dashboardStats: null,
  importBatches: [],
  batchFilters: loadFromLS<BatchFilter>(LS_BATCH_FILTERS, {}),
  recentBatchIds: loadFromLS<string[]>(LS_RECENT_BATCHES, []),
  selectedBatchDetail: null,
  thresholds: [],
  selectedTrend: null,
  reviewLogs: [],
  currentUser: "张管理员",

  setCurrentUser: (user) => set({ currentUser: user }),
  setAnomalyFilters: (filters) => {
    const merged = { ...get().anomalyFilters, ...filters };
    Object.keys(merged).forEach((k) => {
      const key = k as keyof AppState["anomalyFilters"];
      if (merged[key] === undefined || merged[key] === "" || merged[key] === null) {
        delete merged[key];
      }
    });
    set({ anomalyFilters: merged });
    saveToLS(LS_ANOMALY_FILTERS, merged);
  },
  clearError: () => set({ error: null }),

  setBatchFilters: (filters) => {
    const merged = { ...get().batchFilters, ...filters };
    Object.keys(merged).forEach((k) => {
      const key = k as keyof BatchFilter;
      if (merged[key] === undefined || merged[key] === "" || merged[key] === null) {
        delete merged[key];
      }
    });
    set({ batchFilters: merged });
    saveToLS(LS_BATCH_FILTERS, merged);
  },

  clearBatchFilters: () => {
    set({ batchFilters: {} });
    saveToLS(LS_BATCH_FILTERS, {});
  },

  clearAnomalyFilters: () => {
    set({ anomalyFilters: {} });
    saveToLS(LS_ANOMALY_FILTERS, {});
  },

  markRecentBatch: (batchId) => {
    const list = [batchId, ...get().recentBatchIds.filter((id) => id !== batchId)].slice(0, MAX_RECENT);
    set({ recentBatchIds: list });
    saveToLS(LS_RECENT_BATCHES, list);
  },

  clearRecentBatches: () => {
    set({ recentBatchIds: [] });
    saveToLS(LS_RECENT_BATCHES, []);
  },

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
      const params = new URLSearchParams();
      const f = get().batchFilters;
      if (f.type) params.append("type", f.type);
      if (f.status) params.append("status", f.status);
      if (f.startDate) params.append("startDate", f.startDate);
      if (f.endDate) params.append("endDate", f.endDate);
      const qs = params.toString();
      const data = await apiCall<ImportBatch[]>(`/import/batches${qs ? "?" + qs : ""}`);
      set({ importBatches: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchBatchDetail: async (batchId) => {
    try {
      const data = await apiCall<ImportBatchDetail>(`/import/batches/${batchId}`);
      set({ selectedBatchDetail: data });
      get().markRecentBatch(batchId);
      return data;
    } catch (e) {
      set({ error: (e as Error).message });
      return null;
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

  importData: async (type, fileContent, fileType, batchId, fileName) => {
    set({ loading: true });
    try {
      const result = await apiCall(`/import/${type}`, {
        method: "POST",
        body: JSON.stringify({ fileContent, fileType, batchId, fileName }),
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

  retryImport: async (parentBatchId, correctedContent, newBatchId) => {
    set({ loading: true });
    try {
      const result = await apiCall(`/import/batches/${parentBatchId}/retry`, {
        method: "POST",
        body: JSON.stringify({ correctedContent, newBatchId }),
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

  exportBatch: (batchId, format) => {
    const url = `${API_BASE}/import/batches/${batchId}/export?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
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

  cockpitSummary: null,
  cockpitCurrentRun: null,
  cockpitRuns: [],
  cockpitCheckpoints: [],
  cockpitRunning: false,

  fetchCockpitSummary: async () => {
    try {
      const data = await apiCall<CockpitSummary>("/cockpit/summary");
      set({ cockpitSummary: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  startCockpitRun: async (prefix?: string) => {
    set({ cockpitRunning: true, loading: true });
    try {
      const body: any = {};
      if (prefix) body.prefix = prefix;
      const data = await apiCall<CockpitRun>("/cockpit/run", {
        method: "POST",
        body: JSON.stringify(body),
      });
      set({ cockpitCurrentRun: data });
      await get().fetchCockpitSummary();
      await get().fetchCockpitRuns();
      return data;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ cockpitRunning: false, loading: false });
    }
  },

  fetchCockpitRuns: async () => {
    try {
      const data = await apiCall<CockpitRun[]>("/cockpit/runs");
      set({ cockpitRuns: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchCockpitRunDetail: async (runId: string) => {
    try {
      const data = await apiCall<CockpitRun>(`/cockpit/runs/${runId}`);
      set({ cockpitCurrentRun: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchCockpitCheckpoints: async (runId: string) => {
    try {
      const data = await apiCall<CockpitCheckpoint[]>(`/cockpit/runs/${runId}/checkpoints`);
      set({ cockpitCheckpoints: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  acceptanceSummary: null,
  acceptanceCurrentRun: null,
  acceptanceRuns: [],
  acceptanceRunning: false,
  acceptancePackageInfo: null,
  acceptanceFiles: [],

  fetchAcceptanceSummary: async () => {
    try {
      const data = await apiCall<AcceptanceSummary>("/acceptance/summary");
      set({ acceptanceSummary: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  startAcceptanceDrill: async (name?: string) => {
    set({ acceptanceRunning: true, loading: true });
    try {
      const body: any = {};
      if (name) body.name = name;
      const data = await apiCall<AcceptanceRun>("/acceptance/run", {
        method: "POST",
        body: JSON.stringify(body),
      });
      set({ acceptanceCurrentRun: data });
      await get().fetchAcceptanceSummary();
      await get().fetchAcceptanceRuns();
      return data;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ acceptanceRunning: false, loading: false });
    }
  },

  resumeAcceptanceDrill: async (runId: string) => {
    set({ acceptanceRunning: true, loading: true });
    try {
      const data = await apiCall<AcceptanceRun>(`/acceptance/resume/${runId}`, {
        method: "POST",
      });
      set({ acceptanceCurrentRun: data });
      await get().fetchAcceptanceSummary();
      await get().fetchAcceptanceRuns();
      return data;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ acceptanceRunning: false, loading: false });
    }
  },

  verifyRestartRecovery: async (runId: string) => {
    set({ acceptanceRunning: true, loading: true });
    try {
      const data = await apiCall<AcceptanceRun>(`/acceptance/restart-verify/${runId}`, {
        method: "POST",
      });
      set({ acceptanceCurrentRun: data });
      await get().fetchAcceptanceSummary();
      await get().fetchAcceptanceRuns();
      return data;
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    } finally {
      set({ acceptanceRunning: false, loading: false });
    }
  },

  fetchAcceptanceRuns: async () => {
    try {
      const data = await apiCall<AcceptanceRun[]>("/acceptance/runs");
      set({ acceptanceRuns: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchAcceptanceRunDetail: async (runId: string) => {
    try {
      const data = await apiCall<AcceptanceRun>(`/acceptance/runs/${runId}`);
      set({ acceptanceCurrentRun: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchAcceptancePackageInfo: async (runId: string) => {
    try {
      const data = await apiCall<AcceptancePackageInfo>(`/acceptance/runs/${runId}/package`);
      set({ acceptancePackageInfo: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchAcceptanceFiles: async (runId: string) => {
    try {
      const data = await apiCall<AcceptanceExportFile[]>(`/acceptance/runs/${runId}/files`);
      set({ acceptanceFiles: data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  downloadAcceptanceFile: (runId: string, filename: string) => {
    const url = `${API_BASE}/acceptance/runs/${runId}/file/${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  },
}));
