export interface WebhookMeta {
  latencyMs: number;
  statusCode: number;
  urlCalled: string;
  isTestMode?: boolean;
  rawResponse?: any;
  error?: string;
  source?: 'activepieces' | 'gemini-hybrid' | 'fallback' | 'system';
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status: 'sending' | 'delivered' | 'error';
  webhookMeta?: WebhookMeta;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt?: string;
  pinned?: boolean;
  tags?: string[];
  summary?: string;
  messageCount: number;
  lastMessage?: string;
}

export interface WebhookSettings {
  url: string;
  fallbackToTestUrl: boolean;
  customHeaders?: Record<string, string>;
  lastTestedAt?: string;
  lastStatus?: number;
  assistantName: string;
  systemPrompt?: string;
  aiMode?: 'hybrid' | 'activepieces_only';
}

export interface DashboardStats {
  totalConversations: number;
  activeConversations: number;
  archivedConversations: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  avgLatencyMs: number;
  syncVersion: number;
  settings: WebhookSettings;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  urlCalled: string;
  response: any;
  message: string;
}

export type ViewMode = 'chat' | 'dashboard';
export type FilterCategory = 'all' | 'active' | 'archived' | 'pinned';

export * from './types/index';

