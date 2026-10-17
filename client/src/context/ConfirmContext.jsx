import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LogOut, Trash2, UserMinus } from 'lucide-react';

/**
 * App-styled replacement for window.confirm().
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: 'Delete task?', message: '…', confirmText: 'Delete' });
 *   if (!ok) return;
 */
const ConfirmContext = createContext(null);

const ICONS = { delete: Trash2, remove: UserMinus, leave: LogOut, warning: AlertTriangle };

function ConfirmDialog({ options, onClose }) {
  const {
    title = 'Are you sure?',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    tone = 'danger',
    icon = 'warning',
  } = options;
  const Icon = ICONS[icon] ?? AlertTriangle;
  const cancelRef = useRef(null);

  useEffect(() => {
    // Focus Cancel by default so Enter doesn't delete something by accident.
    cancelRef.current?.focus();
    // Capture on window so Escape closes only this dialog, not the modal behind it.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const danger = tone === 'danger';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="animate-[fadeIn_120ms_ease-out] absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
        onClick={() => onClose(false)}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        className="animate-[popIn_160ms_ease-out] relative w-full rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              danger
                ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400'
            }`}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-title" className="text-base font-semibold">
              {title}
            </h2>
            {message && (
              <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed break-words text-zinc-500 dark:text-zinc-400">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} onClick={() => onClose(false)} className="btn btn-secondary w-full sm:w-auto">
            {cancelText}
          </button>
          <button
            onClick={() => onClose(true)}
            className={`btn w-full sm:w-auto ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { options, resolve }

  const confirm = useCallback(
    (options = {}) => new Promise((resolve) => setState({ options, resolve })),
    []
  );

  const close = useCallback(
    (result) => {
      setState((s) => {
        s?.resolve(result);
        return null;
      });
    },
    []
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && <ConfirmDialog options={state.options} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => useContext(ConfirmContext);
