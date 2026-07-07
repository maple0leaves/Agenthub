export type AiChatPayload = {
  message: string;
  x?: number;
  y?: number;
};

export type SourceRef = {
  agentId: number;
  agentName: string;
  snippet: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceRef[];
  loading?: boolean;
};
