'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

export function PhotoUploader({
  workOrderId,
  type,
  onUploaded,
}: {
  workOrderId: string;
  type: 'Before' | 'After';
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const { t } = useI18n();
  const typeLabel = t(`board.workOrder.${type === 'Before' ? 'before' : 'after'}`);

  const upload = async (file?: File) => {
    if (!file || uploading) return;

    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    setUploading(true);
    setProgress(0);

    try {
      await api.post(`/work-orders/${workOrderId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      });
      toast.success(t('board.workOrder.uploadSuccess', { type: typeLabel }));
      onUploaded();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('board.workOrder.uploadFailed')));
    } finally {
      setUploading(false);
      setDragging(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <button
      type="button"
      disabled={uploading}
      aria-busy={uploading}
      aria-label={t('board.workOrder.uploadLabel', { type: typeLabel })}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (uploading) return;
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        if (uploading) return;
        upload(event.dataTransfer.files[0]);
      }}
      className={`flex h-24 w-full flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-70 ${dragging ? 'border-[var(--color-primary)] bg-[var(--color-primary-muted)]' : 'border-[var(--color-border)]'}`}
    >
      <Upload size={18} />
      {uploading ? t('board.workOrder.uploadingLabel', { progress }) : t('board.workOrder.uploadLabel', { type: typeLabel })}
      {uploading && <span className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-[var(--color-border)]"><span className="block h-full bg-[var(--color-primary)]" style={{ width: `${progress}%` }} /></span>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
    </button>
  );
}
