'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export interface Photo { id: string; photoUrl: string; uploadedAt: string; type?: string }

export function PhotoGrid({ photos, onDelete }: { photos: Photo[]; onDelete?: (id: string) => void }) {
  const [preview, setPreview] = useState<Photo | null>(null);
  const { isRtl, t } = useI18n();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p) => {
          const typeLabel = p.type === 'After' ? t('board.workOrder.after') : p.type === 'Before' ? t('board.workOrder.before') : t('board.workOrder.tabs.photos');
          return (
            <div key={p.id} className={cn('group relative overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]', isRtl ? 'text-right' : 'text-left')}>
              <button type="button" aria-label={typeLabel} className="block w-full" onClick={() => setPreview(p)}>
                <img src={p.photoUrl} alt={typeLabel} className="aspect-square w-full object-cover transition group-hover:scale-[1.02]" />
              </button>
              {onDelete && (
                <Button
                  variant="danger"
                  size="icon"
                  aria-label={t('common.actions.delete')}
                  className={cn('absolute top-2 h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100', isRtl ? 'left-2' : 'right-2')}
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-[900px] p-3">
          {preview && (
            <>
              <DialogTitle className="sr-only">{preview.type === 'After' ? t('board.workOrder.after') : preview.type === 'Before' ? t('board.workOrder.before') : t('board.workOrder.tabs.photos')}</DialogTitle>
              <img src={preview.photoUrl} alt="" className="max-h-[80vh] w-full rounded-[var(--radius-md)] object-contain" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
