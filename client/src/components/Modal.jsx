import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Responsive dialog.
 * - Phones: `lg`/`xl` dialogs go full-screen; `sm`/`md` slide up as a bottom sheet.
 * - Tablet and up: centred card.
 */
export default function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const big = size === 'lg' || size === 'xl';
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' }[size];
  const mobile = big
    ? 'min-h-dvh rounded-none border-0'
    : 'mt-auto max-h-[92dvh] overflow-y-auto rounded-b-none rounded-t-2xl border-x-0 border-b-0';

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-zinc-950/50 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-center sm:p-6">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`card relative w-full shrink-0 shadow-xl ${mobile} sm:my-auto sm:min-h-0 sm:max-h-none sm:overflow-visible sm:rounded-xl sm:border ${width}`}
      >
        {title !== undefined && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-2xl border-b border-zinc-200 bg-white px-4 py-3.5 sm:static sm:rounded-t-xl sm:px-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="btn btn-ghost -mr-2 p-1.5" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3.5 sm:px-5 dark:border-zinc-800">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
