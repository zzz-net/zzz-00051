import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "app.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    area REAL NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meter_readings (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    reading REAL NOT NULL,
    batch_id TEXT NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    UNIQUE(store_id, date, batch_id)
  );

  CREATE TABLE IF NOT EXISTS business_hours (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    open_hour REAL NOT NULL,
    close_hour REAL NOT NULL,
    batch_id TEXT NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    UNIQUE(store_id, date, batch_id)
  );

  CREATE TABLE IF NOT EXISTS maintenance_records (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS threshold_config (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    daily_limit REAL NOT NULL,
    fluctuation_rate REAL NOT NULL,
    hours_correction_factor REAL NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS anomalies (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    daily_consumption REAL NOT NULL,
    expected_consumption REAL NOT NULL,
    deviation_rate REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attribution TEXT,
    note TEXT,
    evidence_source TEXT,
    reviewer TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  );

  CREATE TABLE IF NOT EXISTS review_logs (
    id TEXT PRIMARY KEY,
    anomaly_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    note TEXT NOT NULL,
    evidence_source TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (anomaly_id) REFERENCES anomalies(id)
  );

  CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    file_type TEXT,
    file_name TEXT,
    record_count INTEGER NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    errors TEXT,
    original_content TEXT,
    parent_batch_id TEXT,
    coverage_start_date TEXT,
    coverage_end_date TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS import_batch_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    record_data TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    is_duplicate INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES import_batches(id)
  );

  CREATE TABLE IF NOT EXISTS cockpit_runs (
    id TEXT PRIMARY KEY,
    prefix TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    steps_json TEXT NOT NULL DEFAULT '[]',
    snapshot_before TEXT,
    snapshot_after TEXT,
    isolation_cleaned INTEGER NOT NULL DEFAULT 0,
    import_conflict_handled INTEGER NOT NULL DEFAULT 0,
    filter_preserved INTEGER NOT NULL DEFAULT 0,
    review_preserved INTEGER NOT NULL DEFAULT 0,
    export_complete INTEGER NOT NULL DEFAULT 0,
    export_comparison_match INTEGER NOT NULL DEFAULT 0,
    logs_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS cockpit_checkpoints (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES cockpit_runs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_cockpit_runs_prefix ON cockpit_runs(prefix);
  CREATE INDEX IF NOT EXISTS idx_cockpit_checkpoints_run ON cockpit_checkpoints(run_id);

  CREATE INDEX IF NOT EXISTS idx_batch_records_batch ON import_batch_records(batch_id);

  CREATE INDEX IF NOT EXISTS idx_readings_store_date ON meter_readings(store_id, date);
  CREATE INDEX IF NOT EXISTS idx_hours_store_date ON business_hours(store_id, date);
  CREATE INDEX IF NOT EXISTS idx_maintenance_store_date ON maintenance_records(store_id, date);
  CREATE INDEX IF NOT EXISTS idx_anomalies_store ON anomalies(store_id);
  CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
  CREATE INDEX IF NOT EXISTS idx_anomalies_date ON anomalies(date);
  CREATE INDEX IF NOT EXISTS idx_review_logs_anomaly ON review_logs(anomaly_id);

  CREATE TABLE IF NOT EXISTS acceptance_runs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    current_phase TEXT,
    steps_json TEXT NOT NULL DEFAULT '[]',
    filter_criteria_json TEXT,
    review_records_json TEXT NOT NULL DEFAULT '[]',
    interface_checks_json TEXT NOT NULL DEFAULT '[]',
    export_files_json TEXT NOT NULL DEFAULT '[]',
    snapshot_before_drill TEXT,
    snapshot_after_drill TEXT,
    snapshot_after_restart TEXT,
    first_drill_result TEXT,
    second_drill_result TEXT,
    consistency_verified INTEGER NOT NULL DEFAULT 0,
    restart_recovery_verified INTEGER NOT NULL DEFAULT 0,
    type_check_passed INTEGER NOT NULL DEFAULT 0,
    build_check_passed INTEGER NOT NULL DEFAULT 0,
    service_version TEXT,
    service_start_time TEXT,
    logs_json TEXT NOT NULL DEFAULT '[]',
    package_ready INTEGER NOT NULL DEFAULT 0,
    package_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    finished_at TEXT,
    recovery_mode TEXT,
    recovery_source_run_id TEXT,
    pause_reason TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_acceptance_runs_status ON acceptance_runs(status);
  CREATE INDEX IF NOT EXISTS idx_acceptance_runs_created ON acceptance_runs(created_at);
  CREATE INDEX IF NOT EXISTS idx_acceptance_runs_recovery ON acceptance_runs(recovery_source_run_id);

  CREATE TABLE IF NOT EXISTS drill_recovery_snapshots (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    snapshot_type TEXT NOT NULL,
    step_index INTEGER NOT NULL DEFAULT 0,
    current_phase TEXT,
    filter_criteria_json TEXT,
    review_records_json TEXT NOT NULL DEFAULT '[]',
    interface_checks_json TEXT NOT NULL DEFAULT '[]',
    steps_json TEXT NOT NULL DEFAULT '[]',
    anomaly_stats_json TEXT NOT NULL DEFAULT '{}',
    system_state_json TEXT NOT NULL,
    service_version TEXT NOT NULL,
    service_start_time TEXT NOT NULL,
    operation_logs_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES acceptance_runs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_drill_snapshots_run ON drill_recovery_snapshots(run_id);
  CREATE INDEX IF NOT EXISTS idx_drill_snapshots_type ON drill_recovery_snapshots(snapshot_type);
  CREATE INDEX IF NOT EXISTS idx_drill_snapshots_created ON drill_recovery_snapshots(created_at);

  CREATE TABLE IF NOT EXISTS drill_comparisons (
    id TEXT PRIMARY KEY,
    first_run_id TEXT NOT NULL,
    second_run_id TEXT NOT NULL,
    comparison_time TEXT NOT NULL,
    overall_match INTEGER NOT NULL DEFAULT 0,
    match_score REAL NOT NULL DEFAULT 0,
    total_diffs INTEGER NOT NULL DEFAULT 0,
    critical_diffs INTEGER NOT NULL DEFAULT 0,
    diffs_json TEXT NOT NULL DEFAULT '[]',
    step_comparison_json TEXT NOT NULL DEFAULT '[]',
    anomaly_comparison_json TEXT NOT NULL DEFAULT '{}',
    interface_comparison_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (first_run_id) REFERENCES acceptance_runs(id),
    FOREIGN KEY (second_run_id) REFERENCES acceptance_runs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_drill_comparisons_runs ON drill_comparisons(first_run_id, second_run_id);
  CREATE INDEX IF NOT EXISTS idx_drill_comparisons_time ON drill_comparisons(comparison_time);
`);

function columnExists(table: string, column: string): boolean {
  const row = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return row.some((c) => c.name === column);
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  if (!columnExists(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("import_batches", "file_type", "TEXT");
addColumnIfMissing("import_batches", "file_name", "TEXT");
addColumnIfMissing("import_batches", "success_count", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("import_batches", "failure_count", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("import_batches", "original_content", "TEXT");
addColumnIfMissing("import_batches", "parent_batch_id", "TEXT");
addColumnIfMissing("import_batches", "coverage_start_date", "TEXT");
addColumnIfMissing("import_batches", "coverage_end_date", "TEXT");

addColumnIfMissing("acceptance_runs", "recovery_mode", "TEXT");
addColumnIfMissing("acceptance_runs", "recovery_source_run_id", "TEXT");
addColumnIfMissing("acceptance_runs", "pause_reason", "TEXT");

const importBatchRecordsExists = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='import_batch_records'").get() as any) !== undefined;
if (!importBatchRecordsExists) {
  db.exec(`
    CREATE TABLE import_batch_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      record_data TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id)
    );
    CREATE INDEX idx_batch_records_batch ON import_batch_records(batch_id);
  `);
}

export default db;
