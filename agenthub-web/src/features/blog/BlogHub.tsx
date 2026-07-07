import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type { BlogComment, BlogPost, UserLite } from '../../types';
import { SectionCard } from '../../components/SectionCard';
import { PostCard } from './components/PostCard';
import { PostComposer } from './components/PostComposer';
import { PostImageGrid } from './components/PostImageGrid';

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string;
};

function BlogWall({
  state,
  onLike,
  onOpen,
  loadingMore,
  hasMore,
  onLoadMore,
}: {
  state: LoadState<BlogPost[]>;
  onLike?: (id: number) => Promise<void>;
  onOpen?: (id: number) => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [actionError, setActionError] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);

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
        <PostCard key={blog.id} blog={blog} onOpen={onOpen} onLike={onLike ? handleLike : undefined} />
      ))}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && <p className="xh-muted" style={{ textAlign: 'center', padding: 12 }}>加载中...</p>}
      {!hasMore && state.data.length > 0 && <p className="xh-muted" style={{ textAlign: 'center', padding: 12 }}>— 没有更多了 —</p>}
    </div>
  );
}

export function BlogHub({ searchKeyword, pendingBlogId, onClearPending }: { searchKeyword: string; pendingBlogId?: number | null; onClearPending?: () => void }) {
  const [mode, setMode] = useState<'list' | 'detail'>('list');
  const [tab, setTab] = useState<'hot' | 'publish'>('hot');
  const [state, setState] = useState<LoadState<BlogPost[]>>({ data: [], loading: true, error: '' });
  const [selectedBlogId, setSelectedBlogId] = useState<number | null>(null);
  const [blogDetail, setBlogDetail] = useState<BlogPost | null>(null);
  const [likeUsers, setLikeUsers] = useState<UserLite[]>([]);
  const [blogComments, setBlogComments] = useState<BlogComment[]>([]);
  const [commentText, setBlogCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', images: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const listScrollTopRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 10;

  const load = async () => {
    setPage(1);
    setHasMore(true);
    setState({ data: [], loading: true, error: '' });
    try {
      const data = await api.blogHot(1);
      setState({ data, loading: false, error: '' });
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err) {
      setState({ data: [], loading: false, error: (err as Error).message });
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await api.blogHot(nextPage);
      setPage(nextPage);
      setState((prev) => ({
        ...prev,
        data: [...prev.data, ...data],
      }));
      setHasMore(data.length >= PAGE_SIZE);
    } catch {
      // 加载失败静默处理，保留已有数据
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    if (pendingBlogId && onClearPending) {
      openBlog(pendingBlogId);
      onClearPending();
    }
  }, [pendingBlogId]); // eslint-disable-line
  useEffect(() => {
    if (mode !== 'list' || !shouldRestoreScrollRef.current) return;
    const targetY = listScrollTopRef.current;
    requestAnimationFrame(() => window.scrollTo({ top: targetY, behavior: 'auto' }));
    shouldRestoreScrollRef.current = false;
  }, [mode]);

  const updateBlogInList = (id: number, updater: (blog: BlogPost) => BlogPost) => {
    setState((prev) => ({ ...prev, data: prev.data.map((item) => (item.id === id ? updater(item) : item)) }));
  };

  const openBlog = async (id: number) => {
    listScrollTopRef.current = window.scrollY;
    setMode('detail');
    setSelectedBlogId(id);
    setDetailLoading(true);
    setDetailError('');
    setActionError('');
    setCommentError('');
    try {
      const [detail, likes, comments] = await Promise.all([api.blogById(id), api.blogLikes(id), api.blogComments(id)]);
      setBlogDetail(detail);
      setLikeUsers(likes);
      setBlogComments(comments);
      if (detail.userId) {
        try { setFollowing(await api.isFollow(detail.userId)); } catch { setFollowing(false); }
      }
    } catch (err) {
      setDetailError((err as Error).message);
      setBlogDetail(null);
      setLikeUsers([]);
      setBlogComments([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const backToList = () => {
    shouldRestoreScrollRef.current = true;
    setMode('list');
    setTab('hot');
    setSelectedBlogId(null);
    setDetailError('');
    setActionError('');
    setCommentError('');
  };

  const filteredState = useMemo<LoadState<BlogPost[]>>(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return state;
    const data = state.data.filter((blog) => {
      const t = (blog.title || '').toLowerCase();
      const c = (blog.content || '').toLowerCase();
      const a = (blog.name || '').toLowerCase();
      return t.includes(keyword) || c.includes(keyword) || a.includes(keyword);
    });
    return { ...state, data };
  }, [state, searchKeyword]);

  const submit = async () => {
    setError('');
    setMessage('');
    try {
      const createdId = await api.createBlog({ title: form.title, content: form.content, images: form.images });
      // 先将新动态插入列表头部，确保返回列表时可见
      try {
        const created = await api.blogById(createdId);
        setState((prev) => ({
          ...prev,
          data: [created, ...prev.data.filter((item) => item.id !== created.id)],
        }));
      } catch {
        // 获取详情失败不影响跳转，返回列表时会重新加载
      }
      // 发布成功后跳转到动态详情
      await openBlog(createdId);
      setMessage('');
      setForm({ title: '', content: '', images: '' });
      setShowForm(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const uploadBlogImage = async (file: File) => {
    setError('');
    setImageUploading(true);
    try {
      const fileName = await api.uploadBlogImage(file);
      const path = fileName.startsWith('/imgs/') ? fileName : `/imgs/${fileName}`;
      setForm((prev) => {
        const images = prev.images
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        images.push(path);
        return { ...prev, images: images.join(',') };
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImageUploading(false);
    }
  };

  const likeBlog = async (id: number) => {
    setActionError('');
    try {
      await api.likeBlog(id);
      const listItem = state.data.find((item) => item.id === id);
      const currentLiked = id === blogDetail?.id ? Boolean(blogDetail.isLike) : Boolean(listItem?.isLike);
      const nextLiked = !currentLiked;
      updateBlogInList(id, (item) => ({
        ...item,
        isLike: nextLiked,
        liked: Math.max(0, (item.liked || 0) + (nextLiked ? 1 : -1)),
      }));
      if (id === blogDetail?.id) {
        setBlogDetail((prev) => (prev ? {
          ...prev,
          isLike: nextLiked,
          liked: Math.max(0, (prev.liked || 0) + (nextLiked ? 1 : -1)),
        } : prev));
        try {
          setLikeUsers(await api.blogLikes(id));
        } catch {
          // keep current list when likes panel refresh fails
        }
      }
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const submitBlogComment = async () => {
    if (!commentText.trim() || !selectedBlogId) return;
    setCommentSubmitting(true);
    setCommentError('');
    try {
      await api.addBlogComment(selectedBlogId, commentText.trim());
      setBlogCommentText('');
      setBlogComments(await api.blogComments(selectedBlogId));
    } catch (err) {
      setCommentError((err as Error).message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleLikeBlogComment = async (commentId: number) => {
    try {
      await api.likeBlogComment(commentId);
      setBlogComments(await api.blogComments(selectedBlogId!));
    } catch { /* ignore */ }
  };

  const handleDeleteBlogComment = async (commentId: number) => {
    if (!window.confirm('确定删除？')) return;
    try {
      await api.deleteBlogComment(commentId);
      setBlogComments(await api.blogComments(selectedBlogId!));
    } catch { /* ignore */ }
  };

  const toggleFollow = async () => {
    if (!blogDetail?.userId) return;
    setFollowLoading(true);
    try {
      await api.follow(blogDetail.userId, !following);
      setFollowing(!following);
    } catch { /* ignore */ }
    finally { setFollowLoading(false); }
  };

  return (
    <div className="xh-page xh-stack">
      {mode === 'list' && (
        <SectionCard>
          <div className="xh-inline-buttons">
            <button className={tab === 'hot' ? 'xh-btn primary' : 'xh-btn ghost'} type="button" onClick={() => setTab('hot')}>热门</button>
            <button className={tab === 'publish' ? 'xh-btn primary' : 'xh-btn ghost'} type="button" onClick={() => setTab('publish')}>发布</button>
          </div>
          {actionError && <p className="xh-error">{actionError}</p>}
          {tab === 'hot' && <BlogWall state={filteredState} onLike={likeBlog} onOpen={openBlog} loadingMore={loadingMore} hasMore={hasMore} onLoadMore={loadMore} />}
        </SectionCard>
      )}

      {mode === 'detail' && (
        <section className="xh-section-card xh-blog-detail-shell">
          <div className="xh-blog-detail-head">
            <button className="xh-btn ghost" type="button" onClick={backToList}>返回动态列表</button>
            <h2>动态详情</h2>
          </div>
          {actionError && <p className="xh-error">{actionError}</p>}
          {detailLoading && <p className="xh-muted">加载中...</p>}
          {detailError && (
            <>
              <p className="xh-error">{detailError}</p>
              <button className="xh-btn ghost" type="button" onClick={backToList}>返回列表</button>
            </>
          )}
          {!detailLoading && !detailError && blogDetail && (
            <>
              <div className="xh-detail-author-row">
                {blogDetail.icon ? (
                  <img src={blogDetail.icon} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}} />
                ) : (
                  <div style={{width:32,height:32,borderRadius:'50%',background:'var(--accent)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,flexShrink:0}}>{blogDetail.name?.[0] || '?'}</div>
                )}
                <span>{blogDetail.name || '匿名作者'}</span>
                {blogDetail.userId && (
                  <button className="xh-btn ghost" type="button" onClick={toggleFollow} disabled={followLoading} style={{marginLeft:'auto',padding:'2px 12px',fontSize:12}}>
                    {followLoading ? '...' : following ? '已关注' : '+ 关注'}
                  </button>
                )}
              </div>
              <h3>{blogDetail.title || '无标题'}</h3>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{blogDetail.content || '暂无内容'}</p>
              {blogDetail.images ? (
                <PostImageGrid
                  large
                  images={blogDetail.images.split(',').map((item) => item.trim()).filter(Boolean)}
                />
              ) : null}
              <div className="xh-inline-buttons" style={{ margin: '12px 0' }}>
                <button className="xh-btn ghost" type="button" onClick={() => likeBlog(blogDetail.id)}>
                  {blogDetail.isLike ? '❤️' : '🤍'} {blogDetail.liked || 0}
                </button>
              </div>
              {!!likeUsers.length && <div className="xh-chip-list" style={{ marginBottom: 12 }}>{likeUsers.map((user) => <span key={user.id} className="xh-chip">{user.nickName}</span>)}</div>}
              <h4>评论 ({blogComments.length})</h4>
              {commentError && <p className="xh-error">{commentError}</p>}
              <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                <textarea value={commentText} onChange={(e) => setBlogCommentText(e.target.value)} rows={2} placeholder="写下你的想法..." style={{ borderRadius: 10, border: '1px solid var(--border)', padding: 8, fontSize: 13 }} />
                <button className="xh-btn primary" type="button" onClick={submitBlogComment} disabled={commentSubmitting || !commentText.trim()} style={{ justifySelf: 'end' }}>
                  {commentSubmitting ? '发送中...' : '发送'}
                </button>
              </div>
              {!blogComments.length ? <p className="xh-muted">暂无评论</p> : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {blogComments.map((c) => (
                    <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                      <div className="xh-comment-avatar">
                        {c.userIcon ? (
                          <img src={c.userIcon} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          c.userName?.[0] || '?'
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="xh-comment-head">
                          <b>{c.userName || '匿名'}</b>
                          <span className="xh-muted">{c.createTime ? new Date(c.createTime).toLocaleDateString() : ''}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 14 }}>{c.content}</p>
                        <div className="xh-comment-actions">
                          <button type="button" onClick={() => handleLikeBlogComment(c.id)}>
                            {c.isLiked ? '❤️' : '🤍'} {c.liked || 0}
                          </button>
                          <button type="button" onClick={() => handleDeleteBlogComment(c.id)}>删除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {mode === 'list' && tab === 'publish' && (
        <section className="xh-section-card">
          <PostComposer
            showForm={true}
            message={message}
            error={error}
            form={form}
            imageUploading={imageUploading}
            onToggle={setShowForm}
            onChange={setForm}
            onSubmit={submit}
            onUploadImage={uploadBlogImage}
          />
        </section>
      )}
    </div>
  );
}
