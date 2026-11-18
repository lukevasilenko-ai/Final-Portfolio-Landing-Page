import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';

/*
 * Admin feedback: a styled confirmation dialog and toast notifications that replace the
 * browser's window.confirm / window.prompt / inline notices. Module-level store, so any
 * admin component can call adminConfirm() / adminToast() without prop drilling.
 */

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** When set, the confirm button stays disabled until this exact text is typed. */
  requireText?: string;
};

export type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };
type DialogState = ConfirmOptions & { resolve: (confirmed: boolean) => void };
type FeedbackState = { dialog: DialogState | null; toasts: Toast[] };

let state: FeedbackState = { dialog: null, toasts: [] };
let toastSeq = 0;
const listeners = new Set<() => void>();

const setState = (next: FeedbackState) => {
  state = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function adminConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    state.dialog?.resolve(false);
    setState({ ...state, dialog: { ...options, resolve } });
  });
}

export function adminToast(message: string, tone: ToastTone = 'success') {
  const id = ++toastSeq;
  setState({ ...state, toasts: [...state.toasts.slice(-3), { id, message, tone }] });
  window.setTimeout(() => dismissToast(id), tone === 'error' ? 8000 : 4500);
}

function dismissToast(id: number) {
  if (!state.toasts.some((toast) => toast.id === id)) return;
  setState({ ...state, toasts: state.toasts.filter((toast) => toast.id !== id) });
}

function closeDialog(confirmed: boolean) {
  const dialog = state.dialog;
  if (!dialog) return;
  setState({ ...state, dialog: null });
  dialog.resolve(confirmed);
}

const TOAST_ICON = { success: CheckCircle2, error: CircleAlert, info: Info } as const;

function ConfirmDialog({ dialog }: { dialog: DialogState }) {
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = Boolean(dialog.requireText) && typed.trim() !== dialog.requireText;
  const danger = dialog.tone === 'danger';

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (dialog.requireText ? inputRef.current : danger ? cancelRef.current : confirmRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [danger, dialog]);

  return (
    <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(false); }}>
      <form
        className={`admin-dialog${danger ? ' is-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={dialog.message ? messageId : undefined}
        onSubmit={(event) => { event.preventDefault(); if (!blocked) closeDialog(true); }}
      >
        <span className="admin-dialog-icon" aria-hidden="true">{danger ? <TriangleAlert /> : <Info />}</span>
        <h2 id={titleId}>{dialog.title}</h2>
        {dialog.message && <div id={messageId} className="admin-dialog-message">{dialog.message}</div>}
        {dialog.requireText && (
          <label className="admin-dialog-confirm-text">
            <span>დასადასტურებლად ჩაწერეთ „{dialog.requireText}“</span>
            <input ref={inputRef} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
        )}
        <div className="admin-dialog-actions">
          <button ref={cancelRef} type="button" className="admin-button admin-button-quiet" onClick={() => closeDialog(false)}>
            {dialog.cancelLabel ?? 'გაუქმება'}
          </button>
          <button ref={confirmRef} type="submit" className={`admin-button ${danger ? 'admin-button-danger' : 'admin-button-primary'}`} disabled={blocked}>
            {dialog.confirmLabel ?? 'დადასტურება'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Renders the active dialog and the toast stack; mount once inside the admin shell. */
export function AdminFeedbackHost() {
  const snapshot = useSyncExternalStore(subscribe, () => state);

  return (
    <>
      {snapshot.dialog && <Fragment key={snapshot.dialog.title}><ConfirmDialog dialog={snapshot.dialog} /></Fragment>}
      <div className="admin-toasts" role="status" aria-live="polite">
        {snapshot.toasts.map((toast) => {
          const Icon = TOAST_ICON[toast.tone];
          return (
            <div key={toast.id} className={`admin-toast is-${toast.tone}`}>
              <Icon aria-hidden="true" />
              <span>{toast.message}</span>
              <button type="button" aria-label="შეტყობინების დახურვა" onClick={() => dismissToast(toast.id)}><X aria-hidden="true" /></button>
            </div>
          );
        })}
      </div>
    </>
  );
}
