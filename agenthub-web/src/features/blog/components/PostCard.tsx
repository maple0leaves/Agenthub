import type { BlogPost } from '../../../types';
import { PostImageGrid } from './PostImageGrid';
import { resolveImageUrl } from '../../../utils/image';

type PostCardProps = {
  blog: BlogPost;
  onOpen?: (id: number) => void;
  onLike?: (id: number) => void;
  onDelete?: (id: number) => void;
};

function formatBlogTime(value?: string) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function PostCard({ blog, onOpen, onLike, onDelete }: PostCardProps) {
  const images = (blog.images || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    <article
      className={onOpen ? 'xh-blog-card is-clickable' : 'xh-blog-card'}
      onClick={onOpen ? () => onOpen(blog.id) : undefined}
    >
      <div className="xh-blog-meta">
        <div className="xh-blog-author">
          {blog.icon ? (
            <img className="xh-blog-author-avatar" src={resolveImageUrl(blog.icon)} alt={blog.name || '作者头像'} />
          ) : (
            <span className="xh-blog-author-avatar xh-blog-author-avatar-fallback" aria-hidden>
              {blog.name?.[0] || '?'}
            </span>
          )}
          <span className="xh-blog-author-name">{blog.name || '匿名作者'}</span>
        </div>
        <span className="xh-muted">{formatBlogTime(blog.createTime)}</span>
      </div>
      <h3>{blog.title || '社区动态'}</h3>
      <p>{blog.content || '暂无内容'}</p>
      <PostImageGrid images={images} />
      {(onLike || onDelete) && (
        <div className="xh-note-actions">
          {onLike && (
            <button
              className="xh-note-action-btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLike(blog.id);
              }}
            >
              {blog.isLike ? '❤️' : '🤍'} {blog.liked || 0}
            </button>
          )}
          {onDelete && (
            <button
              className="xh-note-action-btn danger"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(blog.id);
              }}
            >
              删除
            </button>
          )}
        </div>
      )}
    </article>
  );
}
