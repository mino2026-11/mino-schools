import fs from 'fs';
import path from 'path';

export interface WebhookMeta {
  latencyMs: number;
  statusCode: number;
  urlCalled: string;
  isTestMode?: boolean;
  rawResponse?: any;
  error?: string;
  source: 'activepieces' | 'gemini-hybrid' | 'fallback' | 'system';
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

export interface DatabaseSchema {
  version: number;
  conversations: Conversation[];
  messages: Message[];
  settings: WebhookSettings;
  syncVersion: number;
}

const DEFAULT_WEBHOOK_URL =
  process.env.ACTIVEPIECES_WEBHOOK_URL ||
  'https://cloud.activepieces.com/api/v1/webhooks/XV7ZjjsRNy2BNosAm1HjH';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'chat_database.json');

const INITIAL_DATA: DatabaseSchema = {
  version: 1,
  syncVersion: 1,
  settings: {
    url: DEFAULT_WEBHOOK_URL,
    fallbackToTestUrl: true,
    assistantName: 'Glass Activepieces AI',
    systemPrompt: 'You are a helpful, knowledgeable, and articulate AI assistant.',
  },
  conversations: [],
  messages: [],
};

class LocalDatabase {
  private data: DatabaseSchema;
  private subscribers: Set<(event: { type: string; payload: any; syncVersion: number }) => void> = new Set();

  constructor() {
    this.data = this.load();
    // Ensure initial welcome conversation if completely empty
    if (this.data.conversations.length === 0) {
      this.seedInitialConversation();
    }
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...INITIAL_DATA,
          ...parsed,
          settings: {
            ...INITIAL_DATA.settings,
            ...(parsed.settings || {}),
          },
        };
      }
    } catch (err) {
      console.error('[DB] Error loading database file, initializing fresh database:', err);
    }
    this.persist(INITIAL_DATA);
    return INITIAL_DATA;
  }

  private persist(dataToSave: DatabaseSchema = this.data) {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('[DB] Error persisting database to disk:', err);
    }
  }

  private incrementSync(type: string, payload: any) {
    this.data.syncVersion = (this.data.syncVersion || 0) + 1;
    this.persist();
    const event = { type, payload, syncVersion: this.data.syncVersion };
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        // ignore client push error
      }
    });
  }

  public subscribe(callback: (event: { type: string; payload: any; syncVersion: number }) => void) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private seedInitialConversation() {
    const convId = 'welcome-session';
    const now = new Date().toISOString();
    const welcomeConv: Conversation = {
      id: convId,
      title: 'Welcome to Glass AI Assistant',
      createdAt: now,
      updatedAt: now,
      isArchived: false,
      pinned: true,
      tags: ['guide', 'activepieces'],
      summary: 'Introduction to your Activepieces webhook AI and real-time frosted glass workspace.',
      messageCount: 2,
      lastMessage: 'Your AI Assistant is connected and ready to chat.',
    };

    const welcomeMessages: Message[] = [
      {
        id: 'msg-welcome-user',
        conversationId: convId,
        role: 'user',
        content: 'Hello! Is this connected to my Activepieces webhook?',
        timestamp: new Date(Date.now() - 30000).toISOString(),
        status: 'delivered',
      },
      {
        id: 'msg-welcome-assistant',
        conversationId: convId,
        role: 'assistant',
        content: `### Welcome to your Glass AI Assistant! 

I'm directly configured with your **Activepieces webhook**:
\`https://cloud.activepieces.com/api/v1/webhooks/XV7ZjjsRNy2BNosAm1HjH\`

Here's what you can do right now:
- **Instant Chat & Webhook Dispatch**: Send any query; payloads are dispatched to your Activepieces automation flow with smart fallback detection.
- **Local Database Persistence**: Every message and conversation thread is stored locally and synchronized in real-time across all your tabs and devices.
- **Archive Logs Dashboard**: Easily manage, search, inspect webhook latencies, and export archived chat logs.
- **iOS 26 Frosted Glass Design**: Enjoy transparent fluid glass cards, soft glow transitions, and full dark/light mode toggles.

Type a message below to test your webhook flow!`,
        timestamp: now,
        status: 'delivered',
        webhookMeta: {
          latencyMs: 120,
          statusCode: 200,
          urlCalled: this.data.settings.url,
          source: 'system',
        },
      },
    ];

    this.data.conversations = [welcomeConv];
    this.data.messages = welcomeMessages;
    this.persist();
  }

  // Conversation operations
  public getConversations(filter?: { archived?: boolean; search?: string }): Conversation[] {
    let list = [...this.data.conversations];
    if (filter?.archived !== undefined) {
      list = list.filter((c) => Boolean(c.isArchived) === filter.archived);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.summary?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    // Sort pinned first, then by updatedAt desc
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  public getConversationById(id: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.id === id);
  }

  public createConversation(title?: string): Conversation {
    const id = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const conv: Conversation = {
      id,
      title: title || 'New Conversation',
      createdAt: now,
      updatedAt: now,
      isArchived: false,
      pinned: false,
      tags: ['chat'],
      messageCount: 0,
    };
    this.data.conversations.unshift(conv);
    this.incrementSync('conversation_created', conv);
    return conv;
  }

  public updateConversation(id: string, updates: Partial<Conversation>): Conversation | null {
    const idx = this.data.conversations.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    this.data.conversations[idx] = {
      ...this.data.conversations[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const updated = this.data.conversations[idx];
    this.incrementSync('conversation_updated', updated);
    return updated;
  }

  public setArchived(id: string, isArchived: boolean): Conversation | null {
    const idx = this.data.conversations.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    this.data.conversations[idx].isArchived = isArchived;
    this.data.conversations[idx].archivedAt = isArchived ? new Date().toISOString() : undefined;
    this.data.conversations[idx].updatedAt = new Date().toISOString();
    const updated = this.data.conversations[idx];
    this.incrementSync(isArchived ? 'conversation_archived' : 'conversation_unarchived', updated);
    return updated;
  }

  public togglePin(id: string): Conversation | null {
    const idx = this.data.conversations.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.data.conversations[idx].pinned = !this.data.conversations[idx].pinned;
    const updated = this.data.conversations[idx];
    this.incrementSync('conversation_updated', updated);
    return updated;
  }

  public deleteConversation(id: string): boolean {
    const initialLen = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter((c) => c.id !== id);
    this.data.messages = this.data.messages.filter((m) => m.conversationId !== id);
    if (this.data.conversations.length !== initialLen) {
      this.incrementSync('conversation_deleted', { id });
      return true;
    }
    return false;
  }

  // Messages
  public getMessages(conversationId: string): Message[] {
    return this.data.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  public addMessage(msg: Omit<Message, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Message {
    const message: Message = {
      id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: msg.timestamp || new Date().toISOString(),
      ...msg,
    };
    this.data.messages.push(message);

    // Update parent conversation
    const convIdx = this.data.conversations.findIndex((c) => c.id === msg.conversationId);
    if (convIdx !== -1) {
      this.data.conversations[convIdx].updatedAt = message.timestamp;
      this.data.conversations[convIdx].lastMessage = message.content.slice(0, 100);
      this.data.conversations[convIdx].messageCount = this.data.messages.filter(
        (m) => m.conversationId === msg.conversationId
      ).length;

      // Auto-title conversation if it was "New Conversation" and user sent first message
      if (
        this.data.conversations[convIdx].title === 'New Conversation' &&
        message.role === 'user'
      ) {
        const cleanTitle = message.content.trim().slice(0, 35);
        this.data.conversations[convIdx].title = cleanTitle.length < message.content.trim().length ? `${cleanTitle}...` : cleanTitle;
      }
    }

    this.incrementSync('message_added', message);
    return message;
  }

  public updateMessage(id: string, updates: Partial<Message>): Message | null {
    const idx = this.data.messages.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    this.data.messages[idx] = { ...this.data.messages[idx], ...updates };
    const updated = this.data.messages[idx];
    this.incrementSync('message_updated', updated);
    return updated;
  }

  // Settings
  public getSettings(): WebhookSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<WebhookSettings>): WebhookSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.incrementSync('settings_updated', this.data.settings);
    return this.data.settings;
  }

  // Stats for Dashboard
  public getStats() {
    const totalConversations = this.data.conversations.length;
    const archivedConversations = this.data.conversations.filter((c) => c.isArchived).length;
    const activeConversations = totalConversations - archivedConversations;
    const totalMessages = this.data.messages.length;
    const userMessages = this.data.messages.filter((m) => m.role === 'user').length;
    const assistantMessages = this.data.messages.filter((m) => m.role === 'assistant').length;

    // Average latency
    const messagesWithLatency = this.data.messages.filter(
      (m) => m.webhookMeta?.latencyMs && m.webhookMeta.latencyMs > 0
    );
    const avgLatency =
      messagesWithLatency.length > 0
        ? Math.round(
            messagesWithLatency.reduce((acc, m) => acc + (m.webhookMeta?.latencyMs || 0), 0) /
              messagesWithLatency.length
          )
        : 0;

    return {
      totalConversations,
      activeConversations,
      archivedConversations,
      totalMessages,
      userMessages,
      assistantMessages,
      avgLatencyMs: avgLatency,
      syncVersion: this.data.syncVersion,
      settings: this.data.settings,
    };
  }

  // Export / Import
  public exportData() {
    return this.data;
  }

  public importData(importedData: any) {
    if (importedData && Array.isArray(importedData.conversations) && Array.isArray(importedData.messages)) {
      this.data = {
        version: 1,
        syncVersion: (this.data.syncVersion || 0) + 1,
        settings: { ...this.data.settings, ...(importedData.settings || {}) },
        conversations: importedData.conversations,
        messages: importedData.messages,
      };
      this.persist();
      this.incrementSync('database_reset', { count: this.data.conversations.length });
      return true;
    }
    return false;
  }

  public clearAll(keepWelcome = true) {
    this.data.conversations = [];
    this.data.messages = [];
    if (keepWelcome) {
      this.seedInitialConversation();
    } else {
      this.persist();
      this.incrementSync('database_cleared', {});
    }
  }
}

export const db = new LocalDatabase();
