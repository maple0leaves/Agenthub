export type Category = {
  id: number;
  name: string;
  icon?: string;
  sort?: number;
};

export type AgentCard = {
  id: number;
  userId: number;
  categoryId: number;
  categoryName?: string;
  name: string;
  description?: string;
  avatar?: string;
  type: 'PROMPT' | 'WORKFLOW' | string;
  visibility: string;
  starCount: number;
  forkCount: number;
  copyCount: number;
  viewCount: number;
  versionCount: number;
  score: number;
  parentAgentId?: number;
  authorName?: string;
  authorIcon?: string;
  isStar?: boolean;
  createTime?: string;
  updateTime?: string;
};

export type AgentVersion = {
  id: number;
  agentId: number;
  version: string;
  promptTemplate?: string;
  inputSchema?: string;
  workflowConfig?: string;
  modelSuggestion?: string;
  changelog?: string;
  createTime?: string;
};

export type AgentDetail = {
  agent: AgentCard;
  latestVersion?: AgentVersion;
  versions: AgentVersion[];
  viewTime?: string;
};

export type CopyResponse = {
  agentId: number;
  versionId: number;
  promptTemplate?: string;
  inputSchema?: string;
  workflowConfig?: string;
  modelSuggestion?: string;
};

export type FeedResponse = {
  list?: AgentCard[];
  minTime?: number;
  offset?: number;
};

export type AgentComment = {
  id: number;
  agentId: number;
  parentId?: number;
  userId: number;
  content: string;
  likes?: number;
  updated?: number;
  userName?: string;
  userIcon?: string;
  isLiked?: boolean;
  createTime?: string;
  replies?: AgentComment[];
};
