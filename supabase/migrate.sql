
-- Adicionar campos para rastreamento de lotes de sincronização
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES sync_logs(id);
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS batch INTEGER;
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS total_batches INTEGER;
