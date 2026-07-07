import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, clearToken, getToken, setToken } from './api';
import type { AgentCard, AgentComment, AgentDetail, BlogComment, BlogPost, Category, ChatMessage, CopyResponse, SourceRef, UserInfo, UserLite, UserProfile, Voucher } from './types';
import { useHashView } from './hooks/useHashView';
import { appNavItems, type AppView } from './routes/appRoutes';
import { BlogHub } from './features/blog/BlogHub';
import { PostCard } from './features/blog/components/PostCard';
import './styles.css';


type View = AppView;
type AiHistoryItem = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string;
};

const emptyList = { data: [] as AgentCard[], loading: false, error: '' };
const loadingList = { data: [] as AgentCard[], loading: true, error: '' };

function mergeAgentLists(...lists: AgentCard[][]) {
  const map = new Map<number, AgentCard>();
  lists.flat().forEach((item) => {
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [authOpen, setAuthOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [sysNotifications, setSysNotifications] = useState<Array<{ id: string; type: string; title: string; body: string; time: string; agentId?: number }>>([
    { id: 'sys-1', type: 'system', title: '欢迎来到 AgentHub 社区', body: '这里是 AI Agent 模板的发现与分享平台。你可以浏览、收藏、Fork 模板，也可以发布自己的创作。', time: '置顶' },
    { id: 'sys-2', type: 'system', title: '新功能上线：多Agent工作流', body: '现在你可以创建包含多个步骤的工作流模板，让 Agent 之间协作完成复杂任务。', time: '近期' },
    { id: 'sys-3', type: 'system', title: '社区规范提醒', body: '请确保发布的内容符合社区规范，尊重他人创作，共建友好社区。', time: '' },
  ]);

  const addSysNotification = (title: string, body: string, agentId?: number) => {
    const id = `sys-${Date.now()}`;
    setSysNotifications((prev) => [{ id, type: 'system', title, body, time: '刚刚', agentId }, ...prev]);
  };
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('agenthub-ai-history') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('agenthub-ai-history', JSON.stringify(aiHistory));
  }, [aiHistory]);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [topSearchInput, setTopSearchInput] = useState('');
  const [topSearchKeyword, setTopSearchKeyword] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('agenthub-search-history') || '[]'); } catch { return []; }
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<AgentCard | null>(null);
  const [creatorId, setCreatorId] = useState<number | null>(null);
  const [pendingBlogId, setPendingBlogId] = useState<number | null>(null);

  useHashView(view, setView, ['home', 'explore', 'create', 'mine', 'feed', 'blog', 'trial', 'ai', 'message', 'creator']);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const isLoggedIn = Boolean(token && user);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    const hydrateUser = async () => {
      try {
        const profile = await api.me();
        if (cancelled) return;
        if (profile && profile.id) {
          setUser(profile);
          return;
        }
      } catch {
        // Treat fetch failures as invalid session to avoid stale "logged-in" UI.
      }
      if (cancelled) return;
      clearToken();
      setTokenState('');
      setUser(null);
    };
    hydrateUser();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signOut = async () => {
    try {
      await api.logout();
    } catch {
      // Even if network fails, keep local sign-out to avoid stale UI.
    } finally {
      clearToken();
      setTokenState('');
      setUser(null);
      setSelected(null);
      setCreatorId(null);
      setTopSearchInput('');
      setTopSearchKeyword('');
      setView('home');
    }
  };

  const handleLoggedIn = async (newToken: string) => {
    setToken(newToken);
    setTokenState(newToken);
    // Optimistic user state: avoid UI flicker when /user/me is delayed or fails temporarily.
    setUser((prev) => prev || { id: 0, nickName: '我', icon: '' });
    try {
      setUser(await api.me());
    } catch {
      // Keep optimistic state instead of falling back to unauthenticated UI.
    }
    setSelected(null);
    setCreatorId(null);
    setView('home');
    setAuthOpen(false);
  };

  const navItems: Array<{ id: View; label: string; icon: string }> = appNavItems;

  const showRightRail = !selected && view !== 'create' && view !== 'ai' && view !== 'creator' && view !== 'trial';
  const runTopSearch = (override?: string) => {
    const keyword = (override ?? topSearchInput).trim();
    if (!keyword) return;
    setTopSearchInput(keyword);
    setTopSearchKeyword(keyword);
    setSearchFocused(false);
    setSelected(null);
    setCreatorId(null);
    setSearchHistory((prev) => {
      const next = [keyword, ...prev.filter((h) => h !== keyword)].slice(0, 10);
      localStorage.setItem('agenthub-search-history', JSON.stringify(next));
      return next;
    });
    if (view !== 'home' && view !== 'explore' && view !== 'blog' && view !== 'trial') {
      setView('home');
    }
  };
  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('agenthub-search-history');
  };

  return (
    <div className="xh-app">
      <aside className="xh-sidebar">
        <button className="xh-logo" onClick={() => { setSelected(null); setCreatorId(null); setView('home'); }} type="button">
          <span className="xh-logo-mark" aria-hidden>🔥</span>
          <span>AgentHub</span>
        </button>
        <nav className="xh-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'xh-nav-item active' : 'xh-nav-item'}
              onClick={() => { setSelected(null); setCreatorId(null); setView(item.id); }}
              type="button"
            >
              {item.id === 'ai' ? (
                <>
                  <span className="xh-nav-icon xh-nav-icon-ai" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 15a4 4 0 0 1-4 4H8l-4 3v-7a4 4 0 0 1-2-3.46A4 4 0 0 1 6 7h10a4 4 0 0 1 4 4v4z" />
                    </svg>
                  </span>
                  <span className="xh-nav-ai-label">
                    火火
                    <span className="xh-nav-ai-badge">ai</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="xh-nav-icon">{item.icon}</span>
                  {item.label}
                </>
              )}
            </button>
          ))}
        </nav>
        <div className="xh-session-card">
          {isLoggedIn && (
            <button
              className={view === 'mine' ? 'xh-session-user is-active' : 'xh-session-user'}
              onClick={() => { setSelected(null); setView('mine'); }}
              type="button"
            >
              {user?.icon ? (
                <img className="xh-session-avatar" src={user.icon} alt="用户头像" />
              ) : (
                <div className="xh-session-avatar xh-session-avatar-fallback" aria-hidden>我</div>
              )}
              <div>
                <p className="xh-session-title">{user?.nickName || '已登录用户'}</p>
              </div>
            </button>
          )}
          {!isLoggedIn && (
            <>
              <p className="xh-session-title">未登录</p>
              <p className="xh-session-meta">登录后获取更多有趣内容</p>
            </>
          )}
          {isLoggedIn ? (
            <button className="xh-btn ghost full" onClick={signOut} type="button">退出登录</button>
          ) : (
            <button className="xh-btn primary full" onClick={() => setAuthOpen(true)} type="button">立即登录</button>
          )}
        </div>
      </aside>

      <main className="xh-main">
        {view !== 'ai' && (
          <header className="xh-topbar">
            <div className="xh-search-wrap">
              <span className="xh-search-icon">⌕</span>
              <input
                className="xh-search-input"
                placeholder="搜索 Agent 模板、工作流、关键词..."
                value={topSearchInput}
                onChange={(event) => {
                  const next = event.target.value;
                  setTopSearchInput(next);
                  if (!next.trim()) {
                    setTopSearchKeyword('');
                  }
                }}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runTopSearch();
                  if (event.key === 'Escape') setSearchFocused(false);
                }}
              />
              {searchFocused && (
                <div className="xh-search-panel" onMouseDown={(e) => e.preventDefault()}>
                  {searchHistory.length > 0 && (
                    <div className="xh-search-section">
                      <div className="xh-search-section-head">
                        <span>搜索历史</span>
                        <button type="button" onClick={clearSearchHistory}>清除</button>
                      </div>
                      <div className="xh-search-tags">
                        {searchHistory.map((h) => (
                          <button key={h} className="xh-search-tag" type="button" onClick={() => runTopSearch(h)}>{h}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="xh-search-section">
                    <div className="xh-search-section-head"><span>热门搜索</span></div>
                    <div className="xh-search-tags">
                      {categories.slice(0, 6).map((c) => (
                        <button key={c.id} className="xh-search-tag" type="button" onClick={() => runTopSearch(c.name)}>{c.name}</button>
                      ))}
                      {['PROMPT 模板', '多Agent工作流', '客服 Agent'].map((t) => (
                        <button key={t} className="xh-search-tag hot" type="button" onClick={() => runTopSearch(t)}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {searchFocused && <div className="xh-search-overlay" onClick={() => setSearchFocused(false)} />}
            </div>
            <div className="xh-top-links">
              <button className="xh-text-btn" type="button" onClick={() => setContactOpen(true)}>联系我们</button>
            </div>
          </header>
        )}

        <div className="xh-body">
          <section className={showRightRail ? 'xh-content with-rail' : 'xh-content'}>
            {selected ? (
              <Detail
                agentId={selected.id}
                categories={categories}
                onBack={() => setSelected(null)}
                onOpen={setSelected}
                onOpenCreator={(id) => { setSelected(null); setCreatorId(id); setView('creator'); }}
              />
            ) : (
              <>
                {view === 'home' && <Home categories={categories} onOpen={setSelected} searchKeyword={topSearchKeyword} />}
                {view === 'explore' && <Explore categories={categories} onOpen={setSelected} searchKeyword={topSearchKeyword} />}
                {view === 'blog' && <LoginGate isLoggedIn={isLoggedIn} onLogin={() => setAuthOpen(true)}><BlogHub searchKeyword={topSearchKeyword} pendingBlogId={pendingBlogId} onClearPending={() => setPendingBlogId(null)} /></LoginGate>}
                {view === 'trial' && <LoginGate isLoggedIn={isLoggedIn} onLogin={() => setAuthOpen(true)}><TrialCenter addSysNotification={addSysNotification} /></LoginGate>}
                {view === 'create' && <LoginGate isLoggedIn={isLoggedIn} onLogin={() => setAuthOpen(true)}><Create categories={categories} onCreated={(agent) => setSelected(agent)} /></LoginGate>}
                {view === 'mine' && <Mine user={user} onUserUpdated={setUser} onOpen={setSelected} onViewBlog={(id) => { setPendingBlogId(id); setView('blog'); }} />}
                {view === 'feed' && <LoginGate isLoggedIn={isLoggedIn} onLogin={() => setAuthOpen(true)}><Feed onOpen={setSelected} /></LoginGate>}
                {view === 'message' && <LoginGate isLoggedIn={isLoggedIn} onLogin={() => setAuthOpen(true)}><MessageCenter sysNotifications={sysNotifications} onOpen={setSelected} /></LoginGate>}
                {view === 'ai' && <AIWorkbench messages={aiMessages} setMessages={setAiMessages} history={aiHistory} setHistory={setAiHistory} sessionId={aiSessionId} setSessionId={setAiSessionId} />}
                {view === 'creator' && <CreatorHub creatorId={creatorId} />}
              </>
            )}
          </section>
          {showRightRail && <RightRail user={user} categories={categories} onLogin={() => setAuthOpen(true)} />}
        </div>
      </main>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} user={user} onLoggedIn={handleLoggedIn} />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

function LoginGate({ isLoggedIn, onLogin, children }: { isLoggedIn: boolean; onLogin: () => void; children: React.ReactNode }) {
  if (isLoggedIn) return <>{children}</>;
  return (
    <div className="xh-page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <section className="xh-section-card" style={{ textAlign: 'center', maxWidth: 400, width: '100%' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🔒</span>
        <h2 style={{ margin: '0 0 8px' }}>请先登录</h2>
        <p className="xh-muted">登录后才能使用此功能</p>
        <button className="xh-btn primary full" type="button" onClick={onLogin} style={{ marginTop: 16 }}>立即登录</button>
      </section>
    </div>
  );
}

function RightRail({ user, categories, onLogin }: { user: UserProfile | null; categories: Category[]; onLogin: () => void }) {
  return (
    <aside className="xh-right-rail">
      <div className="xh-rail-card">
        <h3>{user ? `Hi, ${user.nickName}` : '加入 AgentHub 社区'}</h3>
        <p>{user ? '你可以发布、收藏、Fork 模板，分享使用案例。' : '登录后可发布模板、关注创作者、参与社区讨论。'}</p>
        {!user && <button className="xh-btn primary full" onClick={onLogin} type="button">立即登录</button>}
      </div>
      <div className="xh-rail-card">
        <h3>热门场景</h3>
        <div className="xh-chip-list">
          {categories.slice(0, 8).map((category) => (
            <span key={category.id} className="xh-chip">{category.name}</span>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Home({ categories, onOpen, searchKeyword }: { categories: Category[]; onOpen: (agent: AgentCard) => void; searchKeyword: string }) {
  const [rank, setRank] = useState<LoadState<AgentCard[]>>(loadingList);
  const [latest, setLatest] = useState<LoadState<AgentCard[]>>(loadingList);
  const [search, setSearch] = useState<LoadState<AgentCard[]>>(emptyList);
  const [latestPage, setLatestPage] = useState(1);
  const [latestHasMore, setLatestHasMore] = useState(true);
  const [latestLoadingMore, setLatestLoadingMore] = useState(false);
  const latestSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchKeyword) return;
    setRank({ data: [], loading: true, error: '' });
    setLatest({ data: [], loading: true, error: '' });
    setLatestPage(1);
    setLatestHasMore(true);
    api.rank('weekly').then((data) => setRank({ data, loading: false, error: '' })).catch((error) => setRank({ data: [], loading: false, error: error.message }));
    api.list({ current: 1 }).then((data) => {
      // 稍微打乱顺序，确保与本周热门前几个不重样
      const shuffled = [...data];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * Math.min(i + 1, 6));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      // 把周报自动生成置顶
      const pinnedId = 5;
      const pinned = shuffled.find((a) => a.id === pinnedId);
      const rest = shuffled.filter((a) => a.id !== pinnedId);
      setLatest({ data: pinned ? [pinned, ...rest] : rest, loading: false, error: '' });
      setLatestHasMore(data.length >= 10);
    }).catch((error) => setLatest({ data: [], loading: false, error: error.message }));
  }, [searchKeyword]);

  // 为你推荐：排除本周热门中已出现的卡片
  const latestFiltered = useMemo(() => {
    const rankIds = new Set(rank.data.map((a) => a.id));
    return { ...latest, data: latest.data.filter((a) => !rankIds.has(a.id)) };
  }, [latest, rank.data]);
  const loadMoreLatest = useCallback(() => {
    if (latest.loading || latestLoadingMore || !latestHasMore) return;
    setLatestLoadingMore(true);
    const nextPage = latestPage + 1;
    api.list({ current: nextPage })
      .then((data) => {
        setLatest((prev) => ({ ...prev, data: [...prev.data, ...data] }));
        setLatestPage(nextPage);
        setLatestHasMore(data.length >= 10);
        setLatestLoadingMore(false);
      })
      .catch(() => setLatestLoadingMore(false));
  }, [latest.loading, latestLoadingMore, latestHasMore, latestPage]);

  // 触底自动加载
  useEffect(() => {
    const sentinel = latestSentinelRef.current;
    if (!sentinel || !latestHasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreLatest();
      },
      { rootMargin: '100px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreLatest, latestHasMore]);

  useEffect(() => {
    if (!searchKeyword) {
      setSearch(emptyList);
      return;
    }
    setSearch({ data: [], loading: true, error: '' });
    Promise.allSettled([
      api.semanticSearch(searchKeyword),
      api.list({ keyword: searchKeyword }),
    ])
      .then((results) => {
        const semantic = results[0].status === 'fulfilled' ? results[0].value : [];
        const keyword = results[1].status === 'fulfilled' ? results[1].value : [];
        setSearch({ data: mergeAgentLists(semantic, keyword), loading: false, error: '' });
      })
      .catch((error) => setSearch({ data: [], loading: false, error: error.message }));
  }, [searchKeyword]);

  if (searchKeyword) {
    return (
      <div className="xh-page">
        <section className="xh-section-card">
          <h2>搜索结果</h2>
          <p className="xh-muted">关键词：「{searchKeyword}」</p>
        </section>
        <NoteWall state={search} onOpen={onOpen} />
      </div>
    );
  }

  return (
    <div className="xh-page">
      <section className="xh-section-card">
        <h2>🔥 本周热门</h2>
        {rank.loading ? (
          <p className="xh-muted">加载中...</p>
        ) : rank.error ? (
          <p className="xh-error">{rank.error}</p>
        ) : !rank.data.length ? (
          <p className="xh-muted">暂无热门 Agent</p>
        ) : (
          <div className="xh-rank-list">
            {rank.data.slice(0, 10).map((agent, i) => (
              <div key={agent.id} className="xh-rank-item" onClick={() => onOpen(agent)}>
                <span className={`xh-rank-badge rank-${i + 1}`}>{i + 1}</span>
                <div className="xh-rank-info">
                  <b>{agent.name}</b>
                  <p>{agent.description || '暂无描述'}</p>
                </div>
                <span className="xh-rank-stats">⭐ {agent.starCount}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="xh-section-card">
        <h2>为你推荐</h2>
        <NoteWall state={latest} onOpen={onOpen} />
        <div ref={latestSentinelRef} style={{ textAlign: 'center', padding: '20px' }}>
          {latestLoadingMore ? <span className="xh-muted">加载中...</span> : latestHasMore ? <span className="xh-muted">下拉加载更多</span> : latest.data.length > 0 ? <span className="xh-muted">— 已经到底了 —</span> : null}
        </div>
      </section>
    </div>
  );
}

function Explore({ categories, onOpen, searchKeyword }: { categories: Category[]; onOpen: (agent: AgentCard) => void; searchKeyword: string }) {
  const [state, setState] = useState<LoadState<AgentCard[]>>(loadingList);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 切换分类或搜索关键词时重置
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setState({ data: [], loading: true, error: '' });
    if (!searchKeyword) {
      api.list({ categoryId: selectedCategory ?? undefined, sortBy: 'starCount', current: 1 })
        .then((data) => {
          setState({ data, loading: false, error: '' });
          setHasMore(data.length >= 10);
        })
        .catch((error) => setState({ data: [], loading: false, error: error.message }));
      return;
    }
    Promise.allSettled([
      api.list({ categoryId: selectedCategory ?? undefined, keyword: searchKeyword }),
      api.semanticSearch(searchKeyword),
    ])
      .then((results) => {
        const keyword = results[0].status === 'fulfilled' ? results[0].value : [];
        const semantic = results[1].status === 'fulfilled' ? results[1].value : [];
        const merged = mergeAgentLists(keyword, semantic);
        setState({ data: merged, loading: false, error: '' });
        setHasMore(false); // 搜索结果不分页
      })
      .catch((error) => setState({ data: [], loading: false, error: error.message }));
  }, [searchKeyword, selectedCategory]);

  const loadMore = useCallback(() => {
    if (state.loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    api.list({ categoryId: selectedCategory ?? undefined, sortBy: 'starCount', current: nextPage })
      .then((data) => {
        setState((prev) => ({ ...prev, data: [...prev.data, ...data] }));
        setPage(nextPage);
        setHasMore(data.length >= 10);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }, [state.loading, loadingMore, hasMore, page, selectedCategory]);

  // 触底自动加载
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '100px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  return (
    <div className="xh-page">
      <div className="xh-tab-row">
        <button
          className={selectedCategory === null ? 'xh-tab active' : 'xh-tab'}
          type="button"
          onClick={() => setSelectedCategory(null)}
        >
          全部
        </button>
        {categories.slice(0, 8).map((category) => (
          <button
            key={category.id}
            className={selectedCategory === category.id ? 'xh-tab active' : 'xh-tab'}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <NoteWall state={state} onOpen={onOpen} />
      <div ref={sentinelRef} style={{ textAlign: 'center', padding: '20px' }}>
        {loadingMore ? <span className="xh-muted">加载中...</span> : hasMore ? <span className="xh-muted">下拉加载更多</span> : state.data.length > 0 ? <span className="xh-muted">— 已经到底了 —</span> : null}
      </div>
    </div>
  );
}

function NoteWall({
  state,
  onOpen,
  renderActions,
}: {
  state: LoadState<AgentCard[]>;
  onOpen: (agent: AgentCard) => void;
  renderActions?: (agent: AgentCard) => React.ReactNode;
}) {
  if (state.loading) return <p className="xh-muted">加载中...</p>;
  if (state.error) return <p className="xh-error">{state.error}</p>;
  if (!state.data.length) return <p className="xh-muted">暂无模板，快来发布第一个 Agent 模板吧。</p>;
  return (
    <div className="xh-note-wall">
      {state.data.map((agent) => <NoteCard key={agent.id} agent={agent} onOpen={onOpen} renderActions={renderActions} />)}
    </div>
  );
}

function NoteCard({
  agent,
  onOpen,
  renderActions,
}: {
  agent: AgentCard;
  onOpen: (agent: AgentCard) => void;
  renderActions?: (agent: AgentCard) => React.ReactNode;
}) {
  const hasAvatar = Boolean(agent.avatar);
  const hasDesc = Boolean(agent.description);
  const coverClass = ['xh-cover-1', 'xh-cover-2', 'xh-cover-3', 'xh-cover-4', 'xh-cover-5'][agent.id % 5];

  return (
    <article className="xh-note-card" onClick={() => onOpen(agent)}>
      <div className={`xh-note-cover ${coverClass}`}>
        {hasAvatar ? (
          <img className="xh-cover-img" src={agent.avatar} alt={agent.name} />
        ) : (
          <div className="xh-cover-poster">
            <span>{agent.name}</span>
          </div>
        )}
        <span className="xh-cover-type">{agent.type}</span>
      </div>
      <div className="xh-note-footer">
        <p className="xh-note-desc">{agent.description || agent.name}</p>
        <div className="xh-note-author">
          <span className="xh-author-avatar">{agent.authorName?.[0] || '?'}</span>
          <span className="xh-author-name">{agent.authorName || '匿名作者'}</span>
          <span className="xh-author-star">⭐ {agent.starCount}</span>
        </div>
        {renderActions && (
          <div className="xh-note-actions">
            {renderActions(agent)}
          </div>
        )}
      </div>
    </article>
  );
}

function BlogWall({
  state,
  onLike,
  onOpen,
}: {
  state: LoadState<BlogPost[]>;
  onLike?: (id: number) => Promise<void>;
  onOpen?: (id: number) => void;
}) {
  const [actionError, setActionError] = useState('');
  if (state.loading) return <p className="xh-muted">加载中...</p>;
  if (state.error) return <p className="xh-error">{state.error}</p>;
  if (!state.data.length) return <p className="xh-muted">暂无社区动态，来发布第一条使用心得吧。</p>;
  const handleLike = async (id: number) => {
    if (!onLike) return;
    setActionError('');
    try {
      await onLike(id);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  return (
    <div className="xh-blog-wall">
      {actionError && <p className="xh-error">{actionError}</p>}
      {state.data.map((blog) => (
        <PostCard
          key={blog.id}
          blog={blog}
          onOpen={onOpen}
          onLike={onLike ? handleLike : undefined}
        />
      ))}
    </div>
  );
}

function Detail({
  agentId,
  categories,
  onBack,
  onOpen,
  onOpenCreator,
}: {
  agentId: number;
  categories: Category[];
  onBack: () => void;
  onOpen: (agent: AgentCard) => void;
  onOpenCreator: (userId: number) => void;
}) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState<CopyResponse | null>(null);
  const [forkName, setForkName] = useState('');
  const [forkCategoryId, setForkCategoryId] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [comments, setComments] = useState<AgentComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState('');
  const load = () => api.detail(agentId)
    .then(async (data) => {
      let versions = data.versions || [];
      try {
        versions = await api.versions(agentId);
      } catch {
        // Fallback to detail payload when versions endpoint is temporarily unavailable.
      }
      setDetail({ ...data, versions });
      setError('');
      if (data.agent.userId) {
        try {
          setFollowing(await api.isFollow(data.agent.userId));
        } catch {
          setFollowing(false);
        }
      }
    })
    .catch((err) => setError(err.message));

  const loadComments = async () => {
    try {
      setComments(await api.comments(agentId));
    } catch {
      setComments([]);
    }
  };

  useEffect(() => {
    load();
    loadComments();
    setExpandedReplies({});
    setInlineReply(null);
  }, [agentId]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});
  const [inlineReply, setInlineReply] = useState<{ id: number; name: string; text: string } | null>(null);

  const insertCommentToTree = (list: AgentComment[], next: AgentComment): AgentComment[] => {
    if (!next.parentId) {
      return [...list, { ...next, replies: next.replies || [] }];
    }

    let inserted = false;
    const appendInto = (items: AgentComment[]): AgentComment[] => items.map((item) => {
      if (item.id === next.parentId) {
        inserted = true;
        return { ...item, replies: [...(item.replies || []), { ...next, replies: next.replies || [] }] };
      }
      if (!item.replies?.length) return item;
      return { ...item, replies: appendInto(item.replies) };
    });

    const updated = appendInto(list);
    if (inserted) return updated;
    // Parent not found in current tree (stale list): keep comment visible at root.
    return [...updated, { ...next, replies: next.replies || [] }];
  };

  const updateCommentInTree = (
    list: AgentComment[],
    commentId: number,
    updater: (comment: AgentComment) => AgentComment,
  ): AgentComment[] => list.map((comment) => {
    if (comment.id === commentId) {
      return updater(comment);
    }
    if (!comment.replies?.length) return comment;
    return { ...comment, replies: updateCommentInTree(comment.replies, commentId, updater) };
  });

  const removeCommentFromTree = (list: AgentComment[], commentId: number): AgentComment[] =>
    list
      .filter((comment) => comment.id !== commentId)
      .map((comment) => {
        if (!comment.replies?.length) return comment;
        return { ...comment, replies: removeCommentFromTree(comment.replies, commentId) };
      });

  const submitComment = async (content: string, parentId?: number) => {
    if (!content.trim()) return;
    setCommentLoading(true);
    setCommentError('');
    try {
      const created = await api.addComment(agentId, content.trim(), parentId);
      setComments((prev) => insertCommentToTree(prev, created));
    } catch (err) {
      setCommentError((err as Error).message);
    } finally {
      setCommentLoading(false);
    }
  };

  const submitTopLevelComment = async () => {
    await submitComment(commentText);
    setCommentText('');
  };

  const submitInlineReply = async () => {
    if (!inlineReply) return;
    await submitComment(inlineReply.text, inlineReply.id);
    setInlineReply(null);
  };

  const handleLike = async (commentId: number) => {
    try {
      const liked = await api.likeComment(commentId);
      setComments((prev) => updateCommentInTree(prev, commentId, (comment) => {
        const currentLiked = Boolean(comment.isLiked);
        if (currentLiked === liked) return comment;
        const nextLikes = Math.max(0, (comment.likes || 0) + (liked ? 1 : -1));
        return { ...comment, isLiked: liked, likes: nextLikes };
      }));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!window.confirm('确定删除这条评论？')) return;
    const previous = comments;
    setComments((prev) => removeCommentFromTree(prev, commentId));
    try {
      await api.deleteComment(commentId);
    } catch {
      setComments(previous);
    }
  };

  const handleEdit = async (commentId: number) => {
    if (!editText.trim()) return;
    const value = editText.trim();
    try {
      await api.editComment(commentId, value);
      setComments((prev) => updateCommentInTree(prev, commentId, (comment) => ({ ...comment, content: value, updated: 1 })));
      setEditingId(null);
      setEditText('');
    } catch {
      // ignore
    }
  };

  const countCommentTree = (comment: AgentComment): number =>
    1 + (comment.replies || []).reduce((sum, child) => sum + countCommentTree(child), 0);
  const countTotal = (list: AgentComment[]): number =>
    list.reduce((sum, c) => sum + countCommentTree(c), 0);

  if (error) return <div className="xh-page"><button className="xh-btn ghost" onClick={onBack} type="button">返回</button><p className="xh-error">{error}</p></div>;
  if (!detail) return <div className="xh-page"><p className="xh-muted">加载中...</p></div>;

  const latest = detail.latestVersion;
  const star = async () => {
    setActionError('');
    try {
      await api.star(agentId);
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  const toggleFollow = async () => {
    if (!detail.agent.userId) return;
    setActionError('');
    try {
      await api.follow(detail.agent.userId, !following);
      setFollowing(!following);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  const copy = async () => {
    setActionError('');
    try {
      const data = await api.copy(agentId, latest?.id);
      setCopied(data);
      const text = data.promptTemplate || data.workflowConfig || '';
      if (navigator.clipboard && text) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Ignore clipboard permission issues, copy action is already recorded on server.
        }
      }
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  const fork = async () => {
    setActionError('');
    try {
      const id = await api.fork(agentId, { name: forkName || `${detail.agent.name} Fork`, categoryId: forkCategoryId || detail.agent.categoryId });
      const created = await api.detail(id);
      onOpen(created.agent);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };
  return (
    <div className="xh-page">
      <button className="xh-btn ghost" onClick={onBack} type="button" style={{marginBottom:12}}>返回</button>
      {actionError && <p className="xh-error">{actionError}</p>}

      <div className="xh-detail-grid">
        <div className="xh-detail-col-right">
          <h1>{detail.agent.name}</h1>
          <div className="xh-detail-tags">
            <span className="xh-detail-tag">{detail.agent.categoryName || '未分类'}</span>
            <span className="xh-detail-tag type">{detail.agent.type}</span>
            {latest?.modelSuggestion && <span className="xh-detail-tag model">{latest.modelSuggestion}</span>}
          </div>
          <div className="xh-detail-author-row">
            <button className="xh-text-btn" type="button" onClick={() => detail.agent.userId && onOpenCreator(detail.agent.userId)}>
              {detail.agent.authorName || '匿名作者'}
            </button>
            <span className="xh-muted">⭐ {detail.agent.starCount} 🍴 {detail.agent.forkCount} 📋 {detail.agent.copyCount}</span>
          </div>
          <div className="xh-detail-actions">
            <button className="xh-btn primary" onClick={copy} type="button">📋 获取模板</button>
            <button className="xh-btn ghost" onClick={star} type="button">{detail.agent.isStar ? '已收藏' : '⭐ 收藏'}</button>
            <button className="xh-btn ghost" onClick={toggleFollow} type="button">{following ? '已关注' : '关注'}</button>
          </div>
          {copied && <p className="xh-success">已复制</p>}

          {detail.agent.description && (
            <>
              <h2>💬 描述</h2>
              <p className="xh-detail-body-desc">{detail.agent.description}</p>
            </>
          )}

          {/* Type-aware content sections */}
          {(() => {
            const isWorkflow = detail.agent.type === 'WORKFLOW';

            return (
              <>
                {/* Primary content */}
                <h2>📝 Prompt 模板</h2>
                <div className="xh-prompt-block">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{latest?.promptTemplate || '暂无 Prompt 模板'}</ReactMarkdown>
                </div>

                {/* Workflow config — only for WORKFLOW type */}
                {isWorkflow && latest?.workflowConfig && (
                  <>
                    <h2>⚙️ Workflow 配置</h2>
                    <WorkflowSteps workflowConfig={latest.workflowConfig} />
                  </>
                )}
              </>
            );
          })()}

          {/* Comments */}
          <h2>评论 ({countTotal(comments)})</h2>
          <div className="xh-comment-input">
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={2} placeholder="写下你的想法..." />
            <button className="xh-btn primary" type="button" onClick={submitTopLevelComment} disabled={commentLoading || !commentText.trim()}>
              {commentLoading ? '发送中...' : '发送'}
            </button>
          </div>
          {commentError && <p className="xh-error">{commentError}</p>}
          {!comments.length ? (
            <p className="xh-muted">暂无评论，快来第一个评论吧</p>
          ) : (
            <div className="xh-comment-list">
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} depth={0}
                  onLike={handleLike} onDelete={handleDelete}
                  onReply={(id, name) => setInlineReply({ id, name, text: `@${name} ` })}
                  editingId={editingId} editText={editText}
                  onEditStart={(id, text) => { setEditingId(id); setEditText(text); }}
                  onEditCancel={() => { setEditingId(null); setEditText(''); }}
                  onEditSave={handleEdit} setEditText={setEditText}
                  expandedReplies={expandedReplies}
                  onToggleReplies={(commentId) => setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }))}
                  inlineReply={inlineReply}
                  onInlineReplyChange={(value) => setInlineReply((prev) => (prev ? { ...prev, text: value } : prev))}
                  onInlineReplySubmit={submitInlineReply}
                  onInlineReplyCancel={() => setInlineReply(null)}
                  commentLoading={commentLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowSteps({ workflowConfig }: { workflowConfig: string }) {
  const steps = useMemo(() => {
    try {
      const parsed = JSON.parse(workflowConfig);
      return Array.isArray(parsed.steps) ? parsed.steps : [];
    } catch {
      return [];
    }
  }, [workflowConfig]);

  if (!steps.length) {
    return <div className="xh-prompt-block"><ReactMarkdown remarkPlugins={[remarkGfm]}>{workflowConfig}</ReactMarkdown></div>;
  }

  return (
    <div className="xh-workflow-steps">
      {steps.map((step: { name?: string; description?: string; prompt?: string; model?: string }, i: number) => (
        <div key={i} className="xh-workflow-step">
          <div className="xh-workflow-step-head">
            <span className="xh-workflow-step-num">{i + 1}</span>
            <div>
              <b>{step.name || `步骤 ${i + 1}`}</b>
              {step.description && <span className="xh-muted" style={{ marginLeft: 8, fontSize: 13 }}>{step.description}</span>}
            </div>
            {step.model && <span className="xh-detail-tag model" style={{ marginLeft: 'auto' }}>{step.model}</span>}
          </div>
          {step.prompt && (
            <div className="xh-prompt-block" style={{ marginTop: 8 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.prompt}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CommentItem({ comment, depth, onLike, onDelete, onReply, editingId, editText, onEditStart, onEditCancel, onEditSave, setEditText, expandedReplies, onToggleReplies, inlineReply, onInlineReplyChange, onInlineReplySubmit, onInlineReplyCancel, commentLoading }: {
  comment: AgentComment; depth: number;
  onLike: (id: number) => void; onDelete: (id: number) => void;
  onReply: (id: number, name: string) => void;
  editingId: number | null; editText: string;
  onEditStart: (id: number, text: string) => void;
  onEditCancel: () => void; onEditSave: (id: number) => void;
  setEditText: (v: string) => void;
  expandedReplies: Record<number, boolean>;
  onToggleReplies: (commentId: number) => void;
  inlineReply: { id: number; name: string; text: string } | null;
  onInlineReplyChange: (value: string) => void;
  onInlineReplySubmit: () => void;
  onInlineReplyCancel: () => void;
  commentLoading: boolean;
}) {
  const flattenReplies = (items: AgentComment[]): AgentComment[] => {
    const result: AgentComment[] = [];
    const walk = (nodes: AgentComment[]) => {
      nodes.forEach((node) => {
        result.push(node);
        if (node.replies?.length) walk(node.replies);
      });
    };
    walk(items);
    return result;
  };

  const allReplies = flattenReplies(comment.replies || []);
  const orderedReplies = [...allReplies].sort((a, b) => a.id - b.id);
  const isExpanded = Boolean(expandedReplies[comment.id]);

  const topLiked = allReplies.length
    ? [...allReplies].sort((a, b) => {
      const likeDelta = (b.likes || 0) - (a.likes || 0);
      if (likeDelta !== 0) return likeDelta;
      return a.id - b.id;
    })[0]
    : undefined;
  const latest = allReplies.length
    ? [...allReplies].sort((a, b) => b.id - a.id)[0]
    : undefined;

  const previewMap = new Map<number, AgentComment>();
  if (topLiked) previewMap.set(topLiked.id, topLiked);
  if (latest) previewMap.set(latest.id, latest);
  const previewReplies = Array.from(previewMap.values()).sort((a, b) => a.id - b.id);
  const canCollapse = depth === 0 && orderedReplies.length > previewReplies.length;
  const visibleReplies = canCollapse && !isExpanded ? previewReplies : orderedReplies;
  const hiddenCount = orderedReplies.length - visibleReplies.length;
  const isEditing = editingId === comment.id;
  const isRoot = depth === 0;
  if (!isRoot) return null;

  return (
    <div className="xh-comment-thread">
      <div className="xh-comment-item">
        <div className="xh-comment-avatar">
          {comment.userIcon ? (
            <img src={comment.userIcon} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            comment.userName?.[0] || '?'
          )}
        </div>
        <div className="xh-comment-body">
          <div className="xh-comment-head">
            <b>{comment.userName || '匿名用户'}</b>
            <span className="xh-muted">{comment.createTime ? new Date(comment.createTime).toLocaleDateString() : ''}</span>
            {comment.updated === 1 && <span className="xh-muted">(已编辑)</span>}
          </div>
          {isEditing ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} style={{ fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="xh-btn primary" type="button" onClick={() => onEditSave(comment.id)} style={{ padding: '2px 10px', fontSize: 12 }}>保存</button>
                <button className="xh-btn ghost" type="button" onClick={onEditCancel} style={{ padding: '2px 10px', fontSize: 12 }}>取消</button>
              </div>
            </div>
          ) : (
            <p>{comment.content}</p>
          )}
          <div className="xh-comment-actions">
            <button type="button" onClick={() => onLike(comment.id)}>{comment.isLiked ? '❤️' : '🤍'} {comment.likes || 0}</button>
            <button type="button" onClick={() => onReply(comment.id, comment.userName || '匿名')}>回复</button>
            <button type="button" onClick={() => onEditStart(comment.id, comment.content)}>编辑</button>
            <button type="button" onClick={() => onDelete(comment.id)}>删除</button>
          </div>
          {inlineReply?.id === comment.id && (
            <InlineReplyBox
              value={inlineReply.text}
              name={inlineReply.name}
              loading={commentLoading}
              onChange={onInlineReplyChange}
              onSubmit={onInlineReplySubmit}
              onCancel={onInlineReplyCancel}
            />
          )}
        </div>
      </div>
      {!!visibleReplies.length && (
        <div className="xh-comment-children">
          {visibleReplies.map((r) => (
            <ReplyItem key={r.id} comment={r}
              onLike={onLike} onDelete={onDelete} onReply={onReply}
              editingId={editingId} editText={editText}
              onEditStart={onEditStart} onEditCancel={onEditCancel}
              onEditSave={onEditSave} setEditText={setEditText}
              inlineReply={inlineReply}
              onInlineReplyChange={onInlineReplyChange}
              onInlineReplySubmit={onInlineReplySubmit}
              onInlineReplyCancel={onInlineReplyCancel}
              commentLoading={commentLoading}
            />
          ))}
        </div>
      )}
      {canCollapse && (
        <button className="xh-comment-toggle" type="button" onClick={() => onToggleReplies(comment.id)}>
          {isExpanded ? '收起回复' : `展开其余 ${hiddenCount} 条回复`}
        </button>
      )}
    </div>
  );
}

function ReplyItem({ comment, onLike, onDelete, onReply, editingId, editText, onEditStart, onEditCancel, onEditSave, setEditText, inlineReply, onInlineReplyChange, onInlineReplySubmit, onInlineReplyCancel, commentLoading }: {
  comment: AgentComment;
  onLike: (id: number) => void; onDelete: (id: number) => void;
  onReply: (id: number, name: string) => void;
  editingId: number | null; editText: string;
  onEditStart: (id: number, text: string) => void;
  onEditCancel: () => void; onEditSave: (id: number) => void;
  setEditText: (v: string) => void;
  inlineReply: { id: number; name: string; text: string } | null;
  onInlineReplyChange: (value: string) => void;
  onInlineReplySubmit: () => void;
  onInlineReplyCancel: () => void;
  commentLoading: boolean;
}) {
  const isEditing = editingId === comment.id;
  return (
    <div className="xh-comment-thread level-1">
      <div className="xh-comment-item">
        <div className="xh-comment-avatar">
          {comment.userIcon ? (
            <img src={comment.userIcon} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            comment.userName?.[0] || '?'
          )}
        </div>
        <div className="xh-comment-body">
          <div className="xh-comment-head">
            <b>{comment.userName || '匿名用户'}</b>
            <span className="xh-muted">{comment.createTime ? new Date(comment.createTime).toLocaleDateString() : ''}</span>
            {comment.updated === 1 && <span className="xh-muted">(已编辑)</span>}
          </div>
          {isEditing ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} style={{ fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="xh-btn primary" type="button" onClick={() => onEditSave(comment.id)} style={{ padding: '2px 10px', fontSize: 12 }}>保存</button>
                <button className="xh-btn ghost" type="button" onClick={onEditCancel} style={{ padding: '2px 10px', fontSize: 12 }}>取消</button>
              </div>
            </div>
          ) : (
            <p>{comment.content}</p>
          )}
          <div className="xh-comment-actions">
            <button type="button" onClick={() => onLike(comment.id)}>{comment.isLiked ? '❤️' : '🤍'} {comment.likes || 0}</button>
            <button type="button" onClick={() => onReply(comment.id, comment.userName || '匿名')}>回复</button>
            <button type="button" onClick={() => onEditStart(comment.id, comment.content)}>编辑</button>
            <button type="button" onClick={() => onDelete(comment.id)}>删除</button>
          </div>
          {inlineReply?.id === comment.id && (
            <InlineReplyBox
              value={inlineReply.text}
              name={inlineReply.name}
              loading={commentLoading}
              onChange={onInlineReplyChange}
              onSubmit={onInlineReplySubmit}
              onCancel={onInlineReplyCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function InlineReplyBox({ value, name, loading, onChange, onSubmit, onCancel }: {
  value: string;
  name: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="xh-inline-reply-box">
      <div className="xh-inline-reply-title">回复 @{name}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="写下你的回复..." />
      <div className="xh-inline-reply-actions">
        <button className="xh-btn ghost" type="button" onClick={onCancel}>取消</button>
        <button className="xh-btn primary" type="button" onClick={onSubmit} disabled={loading || !value.trim()}>
          {loading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
}

function Create({ categories, onCreated }: { categories: Category[]; onCreated: (agent: AgentCard) => void }) {
  const [form, setForm] = useState({
    categoryId: 1,
    name: '',
    description: '',
    avatar: '',
    type: 'PROMPT' as string,
    visibility: 'PUBLIC',
    promptTemplate: '',
    workflowConfig: '',
    modelSuggestion: '',
  });
  const [workflowSteps, setWorkflowSteps] = useState([
    { name: '', description: '', prompt: '', model: 'gpt-4o' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addStep = () => setWorkflowSteps([...workflowSteps, { name: '', description: '', prompt: '', model: 'gpt-4o' }]);
  const removeStep = (i: number) => setWorkflowSteps(workflowSteps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, key: string, value: string) => {
    const updated = [...workflowSteps];
    (updated[i] as any)[key] = value;
    setWorkflowSteps(updated);
  };

  const update = (key: string, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }));
  useEffect(() => {
    if (!categories.length) return;
    setForm((prev) => {
      if (categories.some((category) => category.id === prev.categoryId)) {
        return prev;
      }
      return { ...prev, categoryId: categories[0].id };
    });
  }, [categories]);

  const submit = async () => {
    setError('');
    if (!form.name.trim()) { setError('请输入 Agent 名称'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (form.type === 'WORKFLOW') {
        payload.workflowConfig = JSON.stringify({ steps: workflowSteps }, null, 2);
      }
      const id = await api.create(payload);
      onCreated({ id, name: form.name, description: form.description, type: form.type, categoryId: form.categoryId } as AgentCard);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  const coverClass = ['xh-cover-1','xh-cover-2','xh-cover-3','xh-cover-4','xh-cover-5'][form.name.length % 5];

  return (
    <div className="xh-page">
      <section className="xh-form-card">
        <h1>发布模板</h1>
        <p className="xh-muted">分享你的模板到社区</p>
        {error && <p className="xh-error">{error}</p>}

        {/* Type selector */}
        <div className="xh-create-type">
          {[
            { value: 'PROMPT', label: 'Prompt 模板' },
            { value: 'WORKFLOW', label: '多智能体工作流' },
          ].map((t) => (
            <button
              key={t.value}
              className={form.type === t.value ? 'xh-btn primary' : 'xh-btn ghost'}
              type="button" onClick={() => update('type', t.value)}
            >{t.label}</button>
          ))}
        </div>

        {/* Cover preview — poster style */}
        <div className="xh-create-cover-area">
          <div className="xh-create-cover-preview">
            <div className={`xh-create-cover-empty ${coverClass}`}>
              <span>{form.name || '封面预览'}</span>
            </div>
          </div>
        </div>

        {/* Common fields */}
        <div className="xh-form-grid">
          <label>名称<input value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
          <label>分类<select value={form.categoryId} onChange={(e) => update('categoryId', Number(e.target.value))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <label>描述<textarea value={form.description} onChange={(e) => update('description', e.target.value)} /></label>
        <div className="xh-form-grid">
          <label>模型建议<input value={form.modelSuggestion} onChange={(e) => update('modelSuggestion', e.target.value)} /></label>
          <label>可见性<select value={form.visibility} onChange={(e) => update('visibility', e.target.value)}><option value="PUBLIC">公开</option><option value="PRIVATE">私有</option></select></label>
        </div>

        {/* Type-specific fields */}
        {form.type === 'WORKFLOW' ? (
          <>
            <div className="xh-workflow-steps">
              {workflowSteps.map((step, i) => (
                <div key={i} className="xh-workflow-step">
                  <div className="xh-workflow-step-head">
                    <span>步骤 {i + 1}</span>
                    {workflowSteps.length > 1 && (
                      <button className="xh-btn ghost" type="button" onClick={() => removeStep(i)} style={{padding:'2px 8px',fontSize:12}}>删除</button>
                    )}
                  </div>
                  <div className="xh-form-grid">
                    <label>步骤名<input value={step.name} onChange={(e) => updateStep(i, 'name', e.target.value)} /></label>
                    <label>模型<input value={step.model} onChange={(e) => updateStep(i, 'model', e.target.value)} /></label>
                  </div>
                  <label>描述<textarea value={step.description} onChange={(e) => updateStep(i, 'description', e.target.value)} rows={2} /></label>
                  <label>Prompt<textarea value={step.prompt} onChange={(e) => updateStep(i, 'prompt', e.target.value)} rows={4} /></label>
                </div>
              ))}
            </div>
            <button className="xh-btn ghost" type="button" onClick={addStep} style={{marginTop:8}}>+ 添加步骤</button>
          </>
        ) : (
          <label>Prompt<textarea value={form.promptTemplate} onChange={(e) => update('promptTemplate', e.target.value)} rows={10} /></label>
        )}

        <button className="xh-btn primary full" onClick={submit} type="button" disabled={submitting} style={{marginTop:16}}>{submitting ? '发布中...' : '立即发布'}</button>
      </section>
    </div>
  );
}

function Mine({
  user,
  onUserUpdated,
  onOpen,
  onViewBlog,
}: {
  user: UserProfile | null;
  onUserUpdated: (user: UserProfile | null) => void;
  onOpen: (agent: AgentCard) => void;
  onViewBlog: (id: number) => void;
}) {
  const [mine, setMine] = useState<LoadState<AgentCard[]>>(loadingList);
  const [stars, setStars] = useState<LoadState<AgentCard[]>>(loadingList);
  const [myBlogs, setMyBlogs] = useState<LoadState<BlogPost[]>>({ data: [], loading: false, error: '' });
  const [activeTab, setActiveTab] = useState<'mine' | 'stars' | 'blogs'>('mine');
  const [profileOpen, setProfileOpen] = useState(false);
  const [nickName, setNickName] = useState(user?.nickName || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [actionError, setActionError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const loadAll = async () => {
    setMine(loadingList); setStars(loadingList); setMyBlogs({ data: [], loading: true, error: '' });
    api.mine().then((d) => setMine({ data: d, loading: false, error: '' })).catch((e) => setMine({ data: [], loading: false, error: e.message }));
    api.stars().then((d) => setStars({ data: d, loading: false, error: '' })).catch((e) => setStars({ data: [], loading: false, error: e.message }));
    api.blogMine(1).then((d) => setMyBlogs({ data: d, loading: false, error: '' })).catch((e) => setMyBlogs({ data: [], loading: false, error: e.message }));
  };
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { setNickName(user?.nickName || ''); }, [user?.nickName]);

  const saveProfile = async () => {
    const value = nickName.trim();
    if (!value) { setProfileError('用户名不能为空'); return; }
    setProfileSaving(true); setProfileError('');
    try { onUserUpdated(await api.updateProfile(value)); setProfileOpen(false); }
    catch (err) { setProfileError((err as Error).message); }
    finally { setProfileSaving(false); }
  };
  const deleteAgent = async (agent: AgentCard) => {
    setActionError('');
    if (!window.confirm('确认删除该模板？')) return;
    try { await api.delete(agent.id); await loadAll(); } catch (err) { setActionError((err as Error).message); }
  };
  const unstarAgent = async (agent: AgentCard) => {
    setActionError('');
    try { await api.star(agent.id); await loadAll(); } catch (err) { setActionError((err as Error).message); }
  };
  const deleteBlog = async (id: number) => {
    setActionError('');
    if (!window.confirm('确认删除该动态？')) return;
    try { await api.deleteBlog(id); setMyBlogs((prev) => ({ ...prev, data: prev.data.filter((b) => b.id !== id) })); } catch (err) { setActionError((err as Error).message); }
  };

  const tabData = activeTab === 'mine' ? mine : stars;

  return (
    <div className="xh-page xh-stack">
      <section className="xh-profile-banner">
        <div className="xh-profile-banner-bg" />
        <div className="xh-profile-info">
          <div className="xh-profile-avatar-wrap">
            {user?.icon ? (
              <img className="xh-profile-avatar" src={user.icon} alt="" />
            ) : (
              <div className="xh-profile-avatar xh-profile-avatar-fallback">{user?.nickName?.[0] || '我'}</div>
            )}
          </div>
          <div className="xh-profile-meta">
            <div className="xh-profile-name-row">
              <h1>{user?.nickName || '未登录用户'}</h1>
              <button className="xh-btn ghost" type="button" onClick={() => setProfileOpen((p) => !p)} style={{ padding: '2px 12px', fontSize: 12 }}>
                {profileOpen ? '收起' : '编辑资料'}
              </button>
            </div>
            <div className="xh-profile-stats">
              <div className="xh-profile-stat"><b>{mine.data.length}</b><span>模板</span></div>
              <div className="xh-profile-stat"><b>{stars.data.length}</b><span>收藏</span></div>
              <div className="xh-profile-stat"><b>{myBlogs.data.length}</b><span>动态</span></div>
            </div>
          </div>
        </div>
        {profileOpen && (
          <div className="xh-profile-edit" style={{ flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={nickName} onChange={(e) => setNickName(e.target.value)} placeholder="输入新的用户名" />
              <button className="xh-btn primary" type="button" onClick={saveProfile} disabled={profileSaving}>
                {profileSaving ? '保存中...' : '保存'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label className="xh-btn ghost" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUploading ? '上传中...' : '更换头像'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={avatarUploading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setAvatarUploading(true);
                    try {
                      const updated = await api.uploadAvatar(file);
                      onUserUpdated(updated);
                    } catch (err) {
                      setActionError((err as Error).message);
                    } finally {
                      setAvatarUploading(false);
                      event.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        )}
        {profileError && <p className="xh-error">{profileError}</p>}
      </section>

      {actionError && <p className="xh-error">{actionError}</p>}

      <div className="xh-profile-tabs">
        <button className={activeTab === 'mine' ? 'xh-profile-tab active' : 'xh-profile-tab'} type="button" onClick={() => setActiveTab('mine')}>
          我的模板 ({mine.data.length})
        </button>
        <button className={activeTab === 'stars' ? 'xh-profile-tab active' : 'xh-profile-tab'} type="button" onClick={() => setActiveTab('stars')}>
          收藏 ({stars.data.length})
        </button>
        <button className={activeTab === 'blogs' ? 'xh-profile-tab active' : 'xh-profile-tab'} type="button" onClick={() => setActiveTab('blogs')}>
          我的动态 ({myBlogs.data.length})
        </button>
      </div>

      {activeTab === 'blogs' ? (
        <>
          {myBlogs.loading && <p className="xh-muted" style={{ textAlign: 'center', padding: 20 }}>加载中...</p>}
          {myBlogs.error && <p className="xh-error">{myBlogs.error}</p>}
          {!myBlogs.loading && !myBlogs.data.length && !myBlogs.error && (
            <p className="xh-muted" style={{ textAlign: 'center', padding: 20 }}>还没有发布动态</p>
          )}
          {myBlogs.data.length > 0 && (
            <div className="xh-blog-wall">
              {myBlogs.data.map((blog) => (
                <PostCard key={blog.id} blog={blog} onOpen={() => onViewBlog(blog.id)} onDelete={deleteBlog} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <NoteWall
            state={tabData}
            onOpen={onOpen}
            renderActions={activeTab === 'mine' ? (agent) => (
              <button className="xh-note-action-btn danger" type="button" onClick={(e) => { e.stopPropagation(); deleteAgent(agent); }}>删除</button>
            ) : (agent) => (
              <button className="xh-note-action-btn" type="button" onClick={(e) => { e.stopPropagation(); unstarAgent(agent); }}>取消收藏</button>
            )}
          />
          {!tabData.loading && !tabData.data.length && !tabData.error && (
            <p className="xh-muted" style={{ textAlign: 'center', padding: 20 }}>
              {activeTab === 'mine' ? '还没有发布模板，去发布第一个吧' : '还没有收藏模板'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CreatorHub({ creatorId }: { creatorId: number | null }) {
  const [profile, setProfile] = useState<UserLite | null>(null);
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [blogs, setBlogs] = useState<LoadState<BlogPost[]>>({ data: [], loading: false, error: '' });
  const [commons, setCommons] = useState<UserLite[]>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState('');
  useEffect(() => {
    if (!creatorId) return;
    api.userById(creatorId).then(setProfile).catch(() => setProfile(null));
    api.userInfo(creatorId).then(setInfo).catch(() => setInfo(null));
    setBlogs({ data: [], loading: true, error: '' });
    api.blogByUser(creatorId, 1).then((data) => setBlogs({ data, loading: false, error: '' })).catch((err) => setBlogs({ data: [], loading: false, error: err.message }));
    api.followCommons(creatorId).then(setCommons).catch(() => setCommons([]));
    api.isFollow(creatorId).then(setFollowing).catch(() => setFollowing(false));
  }, [creatorId]);
  const toggleFollow = async () => {
    if (!creatorId) return;
    setFollowLoading(true);
    setFollowError('');
    try {
      await api.follow(creatorId, !following);
      setFollowing(!following);
      api.followCommons(creatorId).then(setCommons).catch(() => setCommons([]));
    } catch (err) {
      setFollowError((err as Error).message);
    } finally {
      setFollowLoading(false);
    }
  };
  if (!creatorId) return <div className="xh-page"><p className="xh-muted">请选择创作者</p></div>;
  return (
    <div className="xh-page xh-stack">
      <section className="xh-section-card">
        <h2>{profile?.nickName || '创作者'}</h2>
        <p className="xh-muted">{info?.introduce || '这位创作者很神秘，暂无简介'}</p>
        {followError && <p className="xh-error">{followError}</p>}
        <button className="xh-btn primary" type="button" onClick={toggleFollow} disabled={followLoading}>
          {followLoading ? '处理中...' : following ? '取消关注' : '关注作者'}
        </button>
      </section>
      <section className="xh-section-card">
        <h2>共同关注的创作者</h2>
        {!commons.length ? <p className="xh-muted">暂无共同关注的创作者</p> : <div className="xh-chip-list">{commons.map((user) => <span key={user.id} className="xh-chip">{user.nickName}</span>)}</div>}
      </section>
      <section className="xh-section-card">
        <h2>TA 的分享</h2>
        <BlogWall state={blogs} />
      </section>
    </div>
  );
}

function AIWorkbench({ messages, setMessages, history, setHistory, sessionId, setSessionId }: {
  messages: ChatMessage[];
  setMessages: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  history: AiHistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<AiHistoryItem[]>>;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}) {
  const normalizeAssistantMarkdown = (content: string) =>
    content
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinkingText]);

  const activeSession = useMemo(
    () => history.find((session) => session.id === sessionId) || null,
    [history, sessionId],
  );
  const hasConversation = messages.some((msg) => msg.role === 'user');

  const quickActions = [
    { icon: '🔍', label: '搜模板', desc: '帮我找一个客服Agent模板', action: '帮我找一个适合电商场景的客服Agent模板' },
    { icon: '⚡', label: '写Prompt', desc: '帮我写一段系统提示词', action: '帮我写一个前端代码审查Agent的系统提示词' },
    { icon: '🔗', label: '搭工作流', desc: '设计多Agent协作流程', action: '帮我设计一个内容创作的多Agent工作流，包含选题、撰写、审核三个步骤' },
    { icon: '💡', label: '找灵感', desc: '推荐热门模板和用法', action: '最近社区里有哪些热门模板？推荐几个实用的' },
  ];

  const updateSession = (sessionId: string, nextMessages: ChatMessage[], titleFallback?: string) => {
    const nextTitle = titleFallback || nextMessages.find((msg) => msg.role === 'user')?.content || '新会话';
    setHistory((prev) => {
      const remaining = prev.filter((session) => session.id !== sessionId);
      const updated = {
        id: sessionId,
        title: nextTitle.slice(0, 24),
        updatedAt: Date.now(),
        messages: nextMessages,
      };
      return [updated, ...remaining];
    });
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const sessionId2 = sessionId || String(Date.now());
    const baseline = activeSession?.messages || messages;
    const nextMessages = [...baseline, userMsg];
    if (!sessionId) {
      setSessionId(sessionId2);
    }
    setMessages(nextMessages);
    updateSession(sessionId2, nextMessages, text);
    setInput('');
    setSending(true);
    setThinking(true);
    setThinkingText('正在检索相关模板...');

    // 创建占位 assistant 消息用于流式追加
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    let streamedContent = '';
    let sources: SourceRef[] = [];

    try {
      for await (const chunk of api.chatStream(text, baseline.filter((msg) => !msg.loading))) {
        if (chunk.type === 'sources') {
          sources = Array.isArray(chunk.data) ? chunk.data : [chunk.data];
          setThinkingText('正在生成回复...');
        } else if (chunk.type === 'token') {
          streamedContent += chunk.data;
          assistantMsg.content = streamedContent;
          assistantMsg.sources = sources;
          setThinking(false);
          setThinkingText('');
          setMessages([...nextMessages, { ...assistantMsg }]);
        } else if (chunk.type === 'done') {
          if (chunk.data?.content) {
            streamedContent = chunk.data.content;
            assistantMsg.content = streamedContent;
          }
        } else if (chunk.type === 'error') {
          throw new Error(String(chunk.data));
        }
      }
      setThinking(false);
      setThinkingText('');
      const final: ChatMessage = { ...assistantMsg, content: streamedContent || '收到空回复', sources };
      const resolved = [...nextMessages, final];
      setMessages(resolved);
      updateSession(sessionId2, resolved, text);
    } catch {
      setThinking(false);
      setThinkingText('');
      const failed = [...nextMessages, { role: 'assistant', content: '抱歉，AI 服务暂时不可用，请稍后再试。' } as ChatMessage];
      setMessages(failed);
      updateSession(sessionId2, failed, text);
    } finally {
      setSending(false);
    }
  };

  const openSession = (sessionId: string) => {
    const target = history.find((session) => session.id === sessionId);
    if (!target) return;
    setSessionId(target.id);
    setMessages(target.messages);
  };

  const createSession = () => {
    setSessionId(null);
    setMessages([]);
    setInput('');
    setThinking(false);
    setThinkingText('');
  };

  const deleteSession = (e: React.MouseEvent, sessionId2: string) => {
    e.stopPropagation();
    if (sessionId === sessionId2) {
      createSession();
    }
    setHistory((prev) => prev.filter((s) => s.id !== sessionId2));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="xh-page dd-chat-layout">
      <aside className={historyCollapsed ? 'dd-sidebar collapsed' : 'dd-sidebar'}>
        {historyCollapsed ? (
          <button
            className="dd-sidebar-toggle-single"
            type="button"
            onClick={() => setHistoryCollapsed(false)}
            aria-label="展开对话记录"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        ) : (
          <>
            <div className="dd-sidebar-header">
              <button className="dd-new-chat-btn" type="button" onClick={createSession}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                新建会话
              </button>
              <button
                className="dd-sidebar-toggle-btn"
                type="button"
                onClick={() => setHistoryCollapsed(true)}
                aria-label="收起对话记录"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            </div>
            <div className="dd-history-title">对话记录</div>
            <div className="dd-history-list">
              {!history.length ? (
                <button className="dd-history-item active" type="button" onClick={createSession}>新对话</button>
              ) : (
                history.map((session) => (
                  <div key={session.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      className={session.id === sessionId ? 'dd-history-item active' : 'dd-history-item'}
                      type="button"
                      style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      onClick={() => openSession(session.id)}
                    >
                      {session.title}
                    </button>
                    <span
                      onClick={(e) => deleteSession(e, session.id)}
                      title="删除对话"
                      style={{
                        cursor: 'pointer', fontSize: 14, color: '#bbb', padding: '2px 6px',
                        borderRadius: 4, flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#e74c3c'; e.currentTarget.style.background = '#fff0f0'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.background = 'transparent'; }}
                    >×</span>
                  </div>
                ))
              )}
              {history.length > 1 && (
                <button
                  type="button"
                  onClick={() => { createSession(); setHistory([]); }}
                  style={{
                    border: 0, background: 'transparent', color: '#c0c0c8', fontSize: 12,
                    cursor: 'pointer', padding: '4px 8px', textAlign: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#e74c3c'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#c0c0c8'; }}
                >清空全部对话</button>
              )}
              <div className="dd-history-footer">没有更多了</div>
            </div>
          </>
        )}
      </aside>

      <section className="dd-main">
        {!hasConversation ? (
          <div className="dd-empty">
            <div className="dd-title-wrapper">
              <span className="dd-title-blob"></span>
              <h1>嗨，我是火火 🔥</h1>
            </div>

            {/* Quick action cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxWidth: 560, width: '100%', marginTop: 8 }}>
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => send(qa.action)}
                  disabled={sending}
                  style={{
                    border: '1px solid #e8e8ef', borderRadius: 14, background: '#fff',
                    padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c7dbff'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(120,157,235,0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e8e8ef'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{qa.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{qa.label}</div>
                    <div style={{ fontSize: 12, color: '#8a8a94', lineHeight: 1.4 }}>{qa.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="dd-composer dd-composer-hero">
              <textarea
                className="dd-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="搜模板、问问题、找灵感..."
              />
              <button className="dd-send-btn" type="button" onClick={() => send()} disabled={sending || !input.trim()}>↑</button>
            </div>
          </div>
        ) : (
          <>
            <div className="dd-chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`dd-msg-row ${msg.role}`}>
                  {msg.loading ? (
                    <div className="dd-msg-bubble assistant">正在生成...</div>
                  ) : (
                    <div className={msg.role === 'assistant' ? 'dd-msg-bubble assistant' : 'dd-msg-bubble user'}>
                      <div className={sending && i === messages.length - 1 && msg.role === 'assistant' ? 'dd-msg-content streaming' : 'dd-msg-content'}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.role === 'assistant' ? normalizeAssistantMarkdown(msg.content || (sending ? '▊' : '')) : (msg.content || '')}</ReactMarkdown>
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="dd-msg-sources">
                          {msg.sources.map((src, j) => (
                            <span key={j} className="dd-source-chip">{src.agentName}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {thinking && (
                <div className="dd-msg-row assistant">
                  <div className="dd-msg-bubble assistant" style={{ color: '#8a8a94', fontSize: 13, fontStyle: 'italic' }}>
                    💭 {thinkingText}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
        {hasConversation && (
          <div className="dd-composer dd-composer-bottom">
            <textarea
              className="dd-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="继续提问..."
            />
            <button className="dd-send-btn" type="button" onClick={() => send()} disabled={sending || !input.trim()}>↑</button>
          </div>
        )}
      </section>
    </div>
  );
}

function MessageCenter({ sysNotifications: externalSys, onOpen }: { sysNotifications: Array<{ id: string; type: string; title: string; body: string; time: string; agentId?: number }>; onOpen: (agent: AgentCard) => void }) {
  const [tab, setTab] = useState<'interaction' | 'system'>('interaction');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; body: string; time: string; agentId?: number }>>([]);
  const [detailModal, setDetailModal] = useState<{ show: boolean; title: string; body: string }>({ show: false, title: '', body: '' });

  useEffect(() => {
    setLoading(true);
    const fetchNotifications = async () => {
      const items: Array<{ id: string; type: string; title: string; body: string; time: string; agentId?: number }> = [];
      try {
        const myAgents = await api.mine();
        const agentSlice = myAgents.slice(0, 5);
        const commentResults = await Promise.allSettled(agentSlice.map((a) => api.comments(a.id)));
        commentResults.forEach((result, i) => {
          if (result.status !== 'fulfilled') return;
          result.value.slice(0, 3).forEach((c) => {
            items.push({
              id: `comment-${c.id}`,
              type: 'comment',
              title: `${c.userName || '匿名用户'} 评论了你的模板「${agentSlice[i].name}」`,
              body: c.content.length > 60 ? c.content.slice(0, 60) + '...' : c.content,
              time: c.createTime ? new Date(c.createTime).toLocaleDateString() : '',
              agentId: agentSlice[i].id,
            });
          });
        });
        myAgents.forEach((a) => {
          if (a.starCount > 0) {
            items.push({
              id: `star-${a.id}`,
              type: 'star',
              title: `你的模板「${a.name}」获得了 ${a.starCount} 次收藏`,
              body: '继续创作优质模板吧！',
              time: '',
              agentId: a.id,
            });
          }
        });
      } catch {
        // ignore
      }
      try {
        const myBlogs = await api.blogMine(1);
        myBlogs.slice(0, 5).forEach((b) => {
          if ((b.liked || 0) > 0) {
            items.push({
              id: `blog-like-${b.id}`,
              type: 'like',
              title: `你的动态「${b.title || '无标题'}」获得了 ${b.liked} 个赞`,
              body: '',
              time: b.createTime ? new Date(b.createTime).toLocaleDateString() : '',
            });
          }
        });
      } catch {
        // ignore
      }
      setNotifications(items);
      setLoading(false);
    };
    fetchNotifications();
  }, []);

  const systemNotices = externalSys;

  const displayList = tab === 'interaction' ? notifications : systemNotices;

  const iconMap: Record<string, string> = { comment: '💬', star: '⭐', like: '❤️', system: '📢' };

  return (
    <div className="xh-page xh-stack">
      <section className="xh-section-card">
        <h2>消息中心</h2>
        <div className="xh-inline-buttons" style={{ marginBottom: 4 }}>
          <button className={tab === 'interaction' ? 'xh-btn primary' : 'xh-btn ghost'} type="button" onClick={() => setTab('interaction')}>互动消息</button>
          <button className={tab === 'system' ? 'xh-btn primary' : 'xh-btn ghost'} type="button" onClick={() => setTab('system')}>系统通知</button>
        </div>
      </section>
      {tab === 'interaction' && loading && <p className="xh-muted" style={{ padding: '0 14px' }}>加载消息中...</p>}
      {!loading && tab === 'interaction' && !displayList.length && (
        <section className="xh-msg-empty">
          <span className="xh-msg-empty-icon">✉</span>
          <p>暂无互动消息</p>
          <p className="xh-muted">当有人评论、收藏你的模板时，你会在这里收到通知</p>
        </section>
      )}
      {displayList.length > 0 && (
        <div className="xh-msg-list">
          {displayList.map((n) => (
            <div
              key={n.id}
              className="xh-msg-item"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (n.type === 'system') {
                  setDetailModal({ show: true, title: n.title, body: n.body });
                } else if (n.agentId) {
                  onOpen({ id: n.agentId, name: '', starCount: 0, forkCount: 0, copyCount: 0, viewCount: 0, versionCount: 0, score: 0, categoryId: 0, type: '', visibility: '', userId: 0 } as AgentCard);
                }
              }}
            >
              <span className="xh-msg-icon">{iconMap[n.type] || '🔔'}</span>
              <div className="xh-msg-body">
                <p className="xh-msg-title">{n.title}</p>
                {n.body && <p className="xh-msg-text">{n.body}</p>}
              </div>
              {n.time && <span className="xh-msg-time">{n.time}</span>}
            </div>
          ))}
        </div>
      )}
      {detailModal.show && (
        <div className="xh-modal-mask" onClick={() => setDetailModal({ show: false, title: '', body: '' })}>
          <section className="xh-auth-card xh-auth-modal" onClick={(e) => e.stopPropagation()} style={{ minHeight: 'auto', gap: 12 }}>
            <button className="xh-modal-close" type="button" onClick={() => setDetailModal({ show: false, title: '', body: '' })}>×</button>
            <h1 style={{ fontSize: 20, transform: 'none', marginTop: 10 }}>📢 {detailModal.title}</h1>
            {detailModal.body && <p className="xh-muted" style={{ lineHeight: 1.8 }}>{detailModal.body}</p>}
            <button className="xh-btn primary full" type="button" onClick={() => setDetailModal({ show: false, title: '', body: '' })}>关闭</button>
          </section>
        </div>
      )}
    </div>
  );
}

function TrialCenter({ addSysNotification }: { addSysNotification: (title: string, body: string, agentId?: number) => void }) {
  const ACTIVITY_AGENT_ID = 1;
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [successModal, setSuccessModal] = useState<{ show: boolean; orderId: string; title: string }>({ show: false, orderId: '', title: '' });
  const [tab, setTab] = useState<'ongoing' | 'upcoming' | 'ended'>('ongoing');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setVouchers(await api.voucherList(ACTIVITY_AGENT_ID));
    } catch (err) {
      setError((err as Error).message);
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categorize = (v: Voucher) => {
    const begin = v.beginTime ? new Date(v.beginTime).getTime() : 0;
    const end = v.endTime ? new Date(v.endTime).getTime() : 0;
    if (end && now > end) return 'ended';
    if (begin && now < begin) return 'upcoming';
    return 'ongoing';
  };

  const filtered = vouchers.filter((v) => categorize(v) === tab);

  const seckill = async (voucherId: number) => {
    setActionMessage('');
    setActionError('');
    try {
      const orderId = await api.seckillVoucher(voucherId);
      const v = vouchers.find((item) => item.id === voucherId);
      setSuccessModal({ show: true, orderId: String(orderId), title: v?.title || '社区活动' });
      addSysNotification('恭喜报名成功', `你已成功报名活动「${v?.title || '社区活动'}」，报名编号：${orderId}，请联系我们`);
      await load();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const fmtCountdown = (target: number) => {
    const diff = target - now;
    if (diff <= 0) return '已开始';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="xh-page xh-stack">
      <section className="xh-section-card">
        <h2>活动中心</h2>
        <p className="xh-muted">社区活动不定期更新，限量名额先到先得</p>
        <div className="xh-inline-buttons">
          <button className={tab === 'ongoing' ? 'xh-btn primary' : 'xh-btn ghost'} type="button" onClick={() => setTab('ongoing')}>进行中</button>
          <button className={tab === 'upcoming' ? 'xh-btn primary' : 'xh-btn ghost'} type="button" onClick={() => setTab('upcoming')}>即将开始</button>
          <button className={tab === 'ended' ? 'xh-btn primary' : 'xh-btn ghost'} type="button" onClick={() => setTab('ended')}>已结束</button>
        </div>
      </section>

      {actionError && <p className="xh-error">{actionError}</p>}

      {successModal.show && (
        <div className="xh-modal-mask" onClick={() => setSuccessModal({ show: false, orderId: '', title: '' })}>
          <section className="xh-auth-card xh-auth-modal" onClick={(e) => e.stopPropagation()} style={{ minHeight: 'auto', gap: 12 }}>
            <button className="xh-modal-close" type="button" onClick={() => setSuccessModal({ show: false, orderId: '', title: '' })}>×</button>
            <h1 style={{ fontSize: 22, transform: 'none', marginTop: 10 }}>🎉 报名成功！</h1>
            <p className="xh-muted" style={{ textAlign: 'center' }}>你已成功报名活动「{successModal.title}」</p>
            <div style={{ background: '#f7f8fa', borderRadius: 12, padding: 12, textAlign: 'center' }}>
              <span className="xh-muted" style={{ fontSize: 12 }}>报名编号</span>
              <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{successModal.orderId}</p>
            </div>
            <button className="xh-btn primary full" type="button" onClick={() => setSuccessModal({ show: false, orderId: '', title: '' })}>确定</button>
          </section>
        </div>
      )}

      {loading && <p className="xh-muted">加载活动列表...</p>}
      {error && <p className="xh-error">{error}</p>}

      {!loading && !error && !filtered.length && (
        <section className="xh-section-card">
          <p className="xh-muted">
            {tab === 'ongoing' ? '暂无进行中的活动' : tab === 'upcoming' ? '暂无即将开始的活动' : '暂无已结束的活动'}
          </p>
        </section>
      )}

      {filtered.map((voucher) => {
        const cat = categorize(voucher);
        const beginTs = voucher.beginTime ? new Date(voucher.beginTime).getTime() : 0;
        const endTs = voucher.endTime ? new Date(voucher.endTime).getTime() : 0;
        const stock = voucher.stock ?? 0;
        const isEnded = cat === 'ended';
        const isUpcoming = cat === 'upcoming';

        return (
          <section key={voucher.id} className="xh-section-card xh-trial-card">
            <div className="xh-trial-head">
              <div>
                <h3>{voucher.title || '社区活动'}</h3>
                <p className="xh-muted">{voucher.subTitle || '限量名额，先到先得'}</p>
              </div>
              <span className={`xh-trial-badge ${isEnded ? 'ended' : isUpcoming ? 'upcoming' : 'ongoing'}`}>
                {isEnded ? '已结束' : isUpcoming ? '即将开始' : '进行中'}
              </span>
            </div>
            {voucher.rules && <p className="xh-muted" style={{ whiteSpace: 'pre-wrap' }}>{voucher.rules}</p>}
            <div className="xh-trial-info">
              <div>
                <span className="xh-muted">剩余名额</span>
                <b>{stock} 人</b>
              </div>
            </div>
            {isUpcoming && beginTs > 0 && (
              <div className="xh-trial-countdown">
                <span>距开始：</span>
                <b>{fmtCountdown(beginTs)}</b>
              </div>
            )}
            {!isUpcoming && !isEnded && endTs > 0 && (
              <div className="xh-trial-countdown">
                <span>距结束：</span>
                <b>{fmtCountdown(endTs)}</b>
              </div>
            )}
            {stock > 0 && !isEnded && !isUpcoming && (
              <button className="xh-btn primary full" type="button" onClick={() => seckill(voucher.id)}>立即报名</button>
            )}
            {stock === 0 && !isEnded && !isUpcoming && (
              <button className="xh-btn ghost full" type="button" disabled>已满员</button>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Feed({ onOpen }: { onOpen: (agent: AgentCard) => void }) {
  const [state, setState] = useState<LoadState<AgentCard[]>>(loadingList);
  const [blogState, setBlogState] = useState<LoadState<BlogPost[]>>({ data: [], loading: true, error: '' });
  useEffect(() => {
    setState(loadingList);
    api.feed()
      .then((data) => setState({ data: data?.list || [], loading: false, error: '' }))
      .catch((e) => setState({ data: [], loading: false, error: e.message }));
    setBlogState({ data: [], loading: true, error: '' });
    api.blogFollow()
      .then((data) => setBlogState({ data: data?.list || [], loading: false, error: '' }))
      .catch((e) => setBlogState({ data: [], loading: false, error: e.message }));
  }, []);
  return (
    <div className="xh-page xh-stack">
      <Section title="关注创作者的新模板" state={state} onOpen={onOpen} />
      <section className="xh-section-card">
        <h2>关注创作者的最新评测</h2>
        <BlogWall state={blogState} />
      </section>
    </div>
  );
}

function Section({ title, state, onOpen }: { title: string; state: LoadState<AgentCard[]>; onOpen: (agent: AgentCard) => void }) {
  return (
    <section className="xh-section-card">
      <h2>{title}</h2>
      <NoteWall state={state} onOpen={onOpen} />
    </section>
  );
}

function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="xh-modal-mask" onClick={onClose}>
      <section className="xh-auth-card xh-auth-modal" onClick={(event) => event.stopPropagation()} style={{ minHeight: 'auto', gap: 12 }}>
        <button className="xh-modal-close" onClick={onClose} type="button">×</button>
        <h1 style={{ fontSize: 24, transform: 'none', marginTop: 20 }}>联系我们</h1>
        <p className="xh-muted" style={{ textAlign: 'center', fontSize: 15, lineHeight: 1.8 }}>
          如果遇到任何问题或合作，请联系我们
        </p>
        <div style={{ background: '#f7f8fa', borderRadius: 12, padding: 16, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#555' }}>微信号</p>
          <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 700, color: '#111' }}>18749094166</p>
        </div>
        <button className="xh-btn primary full" type="button" onClick={onClose} style={{ marginTop: 8 }}>关闭</button>
      </section>
    </div>
  );
}

function AuthModal({
  open,
  onClose,
  user,
  onLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onLoggedIn: (token: string) => Promise<void>;
}) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const login = async () => {
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();
    if (!trimmedPhone || !trimmedPassword) {
      setError('请输入手机号和登录密码');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const token = await api.loginByPassword(trimmedPhone, trimmedPassword);
      await onLoggedIn(token);
      setMessage('登录成功');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="xh-modal-mask" onClick={onClose}>
      <section className="xh-auth-card xh-auth-modal" onClick={(event) => event.stopPropagation()}>
        <button className="xh-modal-close" onClick={onClose} type="button">×</button>
        <h1>手机号登录</h1>
        {user && <p className="xh-success">当前账号：{user.nickName}</p>}
        {message && <p className="xh-success">{message}</p>}
        {error && <p className="xh-error">{error}</p>}
        <div className="xh-auth-fields">
          <div className="xh-auth-row">
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="输入手机号" />
          </div>
          <div className="xh-auth-row">
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入密码（至少 6 位）" />
          </div>
        </div>
        <button className="xh-btn primary xh-auth-submit" onClick={login} disabled={loading} type="button">登录</button>
        <p className="xh-muted">新用户自动注册</p>
      </section>
    </div>
  );
}
