import React from 'react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';
import { ClipboardEdit, ShieldCheck } from 'lucide-react';

interface StartEvaluationConfirmModalProps {
  isOpen: boolean;
  // Optional name shown in the modal body so the supervisor / director /
  // CEO can verify they're starting the right person's evaluation.
  subjectName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  // Optional override — for "متابعة التقييم" / "إعادة التقييم" cases the
  // wording shifts but the confirmation flow stays the same.
  title?: string;
  confirmLabel?: string;
}

export const StartEvaluationConfirmModal: React.FC<StartEvaluationConfirmModalProps> = ({
  isOpen,
  subjectName,
  onConfirm,
  onCancel,
  title = 'بدء التقييم',
  confirmLabel = 'بدء التقييم',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="px-6 pt-2 pb-2 text-center">
        {/* Hero icon — soft halo, sits at the top of the body as a visual
            anchor. Uses the design-system's blue tile + glow tokens so it
            theme-flips cleanly with the rest of the surface. */}
        <div
          className="mx-auto mb-5 flex items-center justify-center rounded-full"
          style={{
            width: 64,
            height: 64,
            background: 'var(--sc-blue-icon-bg)',
            boxShadow: '0 0 0 10px var(--sc-blue-glow), var(--shadow-sm)',
          }}
        >
          <ClipboardEdit className="h-7 w-7" style={{ color: 'var(--sc-blue-val)' }} />
        </div>

        {/* Lead — short prompt + subject as a bold display name. Keeping it
            on two lines (prompt then name) avoids the awkward inline-name
            wrapping seen in the older layout. */}
        <p className="text-sm text-ds-muted">هل ترغب في بدء التقييم؟</p>
        {subjectName && (
          <p className="mt-1 text-lg font-bold text-ds-text leading-tight">
            {subjectName}
          </p>
        )}

        {/* Helper note — supportive, not warning-level, because nothing
            destructive is happening yet. Starts with a soft check icon to
            reinforce that drafts are safe. */}
        <div className="mt-4 mx-auto max-w-sm flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-ds-overlay border border-ds-border-subtle">
          <ShieldCheck className="h-4 w-4 text-ds-success flex-shrink-0" />
          <span className="text-xs text-ds-muted leading-relaxed">
            يمكنك حفظ التقييم كمسودة في أي وقت قبل الإرسال النهائي
          </span>
        </div>
      </div>

      {/* Footer — buttons centered as a balanced pair. Inline style is
          required because the shared `.modal-foot` class hard-codes
          `justify-content: flex-end` for the rest of the system. */}
      <ModalFooter className="!justify-center">
        <Button onClick={onConfirm} className="flex items-center gap-2 justify-center min-w-[140px]">
          <ClipboardEdit className="h-4 w-4" />
          <span>{confirmLabel}</span>
        </Button>
        <Button variant="secondary" onClick={onCancel} className="min-w-[100px] justify-center">
          إلغاء
        </Button>
      </ModalFooter>
    </Modal>
  );
};
