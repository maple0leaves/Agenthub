export type AppView =
  | 'home'
  | 'explore'
  | 'blog'
  | 'trial'
  | 'create'
  | 'feed'
  | 'ai'
  | 'message'
  | 'mine'
  | 'creator';

export const appNavItems: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'home', label: '发现', icon: '◉' },
  { id: 'explore', label: '精选', icon: '◎' },
  { id: 'blog', label: '社区动态', icon: '✎' },
  { id: 'trial', label: '活动中心', icon: '◆' },
  { id: 'create', label: '发布', icon: '+' },
  { id: 'feed', label: '关注', icon: '◌' },
  { id: 'message', label: '消息', icon: '✉' },
  { id: 'ai', label: 'AI 助手', icon: '✦' },
];
