import { useState } from 'react';
import { resolveImageUrl } from '../../../utils/image';

type PostImageGridProps = {
  images: string[];
  large?: boolean;
};

export function PostImageGrid({ images, large = false }: PostImageGridProps) {
  const [fullIndex, setFullIndex] = useState<number | null>(null);
  if (!images.length) return null;
  const visible = images.slice(0, 9);
  return (
    <>
      <div className={`xh-post-image-grid ${large ? 'is-large' : ''} cols-${Math.min(3, visible.length)}`}>
        {visible.map((url, index) => (
          <img
            key={`${url}-${index}`}
            src={resolveImageUrl(url)}
            alt={`动态配图 ${index + 1}`}
            onClick={(e) => { e.stopPropagation(); setFullIndex(index); }}
          />
        ))}
      </div>
      {fullIndex !== null && (
        <div className="xh-image-lightbox" onClick={(e) => { e.stopPropagation(); setFullIndex(null); }}>
          <img src={resolveImageUrl(visible[fullIndex])} alt="查看原图" />
          <button type="button" onClick={(e) => { e.stopPropagation(); setFullIndex(null); }}>✕</button>
        </div>
      )}
    </>
  );
}
