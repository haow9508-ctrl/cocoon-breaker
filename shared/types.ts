// 领域节点 - 可细分的领域树
export interface DomainNode {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  level: number; // 0=根领域, 1=子领域, 2=孙领域...
  description?: string;
  children?: DomainNode[];
}

// 专家观点 - 每日推送的核心内容
export interface ExpertView {
  id: string;
  date: string;
  dailyTheme: string;
  dailyType: 'breadth' | 'depth'; // 广度日/深度日
  coreClue: string;
  views: SingleView[];
}

// 单个专家观点
export interface SingleView {
  id: string;
  expertId: string;
  expertName: string;
  expertBio: string;
  bookTitle: string;
  bookYear: number;
  conceptName: string;
  conceptIntro: string;
  coreQuotes: string[];
  coreArguments: string[];
  examples: string[];
  answeringQuestion: string;
  hiddenAssumptions: string[];
  fightingWith: string[];
  personalInsights: string[];
  summary: string;
  domainIds: string[]; // 关联的领域
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  readTimeMinutes: number;
}

// 用户偏好
export interface UserPreference {
  type: 'specialist' | 'generalist'; // 深耕型 / 跨界型
  interestedDomains: string[]; // 感兴趣的领域ID
  excludedDomains: string[]; // 不感兴趣的领域ID
  contentDepth: 'lite' | 'standard' | 'deep'; // 浅度/标准/深度
  onboarded: boolean; // 是否完成偏好收集
}

// 聊天消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: string[]; // 快捷回复建议
}

// 维度暴露度
export interface DomainExposure {
  domainId: string;
  exposureCount: number; // 该维度的阅读次数
  lastExposedAt?: string;
}

// 阅读反馈
export interface ReadingFeedback {
  viewId: string;
  insight: string; // "这刷新了我什么认知"
  submittedAt: string;
}

// 推荐原因
export interface RecommendationReason {
  viewId: string;
  blindSpotDomain: string;
  reason: string;
}

// 用户进度
export interface UserProgress {
  readViewIds: string[];
  totalReads: number;
  streakDays: number;
  savedViewIds: string[];
  unlockedBadgeIds: string[];
  domainExposure: DomainExposure[]; // 各维度的暴露追踪
  feedbacks: ReadingFeedback[]; // 阅读反馈记录
}

// 勋章
export interface Badge {
  id: string;
  domainId: string;
  name: string;
  level: 'bronze' | 'silver' | 'gold';
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  requirements: number;
}
