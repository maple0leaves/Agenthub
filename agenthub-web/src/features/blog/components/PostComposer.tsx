import { useState } from 'react';
import { resolveImageUrl } from '../../../utils/image';

type ComposerForm = {
  title: string;
  content: string;
  images: string;
};

type PostComposerProps = {
  showForm: boolean;
  message: string;
  error: string;
  form: ComposerForm;
  imageUploading: boolean;
  onToggle: (show: boolean) => void;
  onChange: (next: ComposerForm) => void;
  onSubmit: () => void;
  onUploadImage: (file: File) => Promise<void>;
};

export function PostComposer({
  showForm,
  message,
  error,
  form,
  imageUploading,
  onToggle,
  onChange,
  onSubmit,
  onUploadImage,
}: PostComposerProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const imageList = form.images
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const removeImage = (index: number) => {
    const next = imageList.filter((_, i) => i !== index).join(',');
    onChange({ ...form, images: next });
  };
  const reorderImages = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= imageList.length || to >= imageList.length) return;
    const next = [...imageList];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...form, images: next.join(',') });
  };
  if (!showForm) {
    return <button className="xh-btn primary full" type="button" onClick={() => onToggle(true)}>发布动态</button>;
  }

  return (
    <>
      {message && <p className="xh-success">{message}</p>}
      {error && <p className="xh-error">{error}</p>}
      <label>标题<input value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} /></label>
      <label>内容<textarea value={form.content} onChange={(e) => onChange({ ...form, content: e.target.value })} rows={6} /></label>
      <div className="xh-composer-upload-row">
        <label className="xh-create-cover-upload">
          {imageUploading ? '上传中...' : '上传图片'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={imageUploading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await onUploadImage(file);
              event.target.value = '';
            }}
          />
        </label>
        {imageList.length > 0 && <span className="xh-muted">已上传 {imageList.length} 张</span>}
      </div>
      {!!imageList.length && (
        <div className="xh-composer-image-list">
          {imageList.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className={dragIndex === index ? 'xh-composer-image-item is-dragging' : 'xh-composer-image-item'}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex === null) return;
                reorderImages(dragIndex, index);
                setDragIndex(null);
              }}
            >
              <img src={resolveImageUrl(url)} alt={`已上传图片 ${index + 1}`} />
              <div className="xh-composer-image-actions">
                <button className="xh-btn ghost" type="button" onClick={() => removeImage(index)}>移除</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="xh-inline-buttons">
        <button className="xh-btn primary" type="button" onClick={onSubmit}>发布</button>
        <button className="xh-btn ghost" type="button" onClick={() => onToggle(false)}>取消</button>
      </div>
    </>
  );
}
