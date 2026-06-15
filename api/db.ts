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
    record_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    errors TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_readings_store_date ON meter_readings(store_id, date);
  CREATE INDEX IF NOT EXISTS idx_hours_store_date ON business_hours(store_id, date);
  CREATE INDEX IF NOT EXISTS idx_maintenance_store_date ON maintenance_records(store_id, date);
  CREATE INDEX IF NOT EXISTS idx_anomalies_store ON anomalies(store_id);
  CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
  CREATE INDEX IF NOT EXISTS idx_anomalies_date ON anomalies(date);
  CREATE INDEX IF NOT EXISTS idx_review_logs_anomaly ON review_logs(anomaly_id);
`);

export default db;
