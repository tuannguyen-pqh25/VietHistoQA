// ─── Shared Types for VietHistoQA (Sử Việt AI) ───────────────────────────

export interface SourceMetadata {
  historical_period?: string;
  year_mentions?: string[];
  source_title?: string;
  chunk_id?: number | string;
  content?: string;
  similarity_score?: number;
}

export interface SourceItem {
  text: string;
  metadata?: SourceMetadata;
  score?: number;
}

export interface ChatMsg {
  id: number;
  role: "user" | "ai";
  text: string;
  fullText?: string;
  sources?: SourceItem[];
  is_in_domain?: boolean;
  blocked_by_verifier?: boolean;
  verifier_confidence?: number;
  confidence_score?: number;
  verifier_reason?: string;
  retrieval_mode?: string;
  isStreaming?: boolean;
  timestamp?: string;
}

export interface HistoricalEra {
  id: string;
  title: string;
  period: string;
  badge: string;
  description: string;
  queries: string[];
}

export interface PipelineConfig {
  use_rag: boolean;
  top_k: number;
  use_verifier: boolean;
  use_rerank: boolean;
}
