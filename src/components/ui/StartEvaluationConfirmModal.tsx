import React from 'react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';
import { ClipboardEdit, AlertCircle } from 'lucide-react';

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
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ds-info-bg flex items-center justify-center">
            <ClipboardEdit className="h-5 w-5 text-ds-info" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-ds-text leading-relaxed">
              هل أنت متأكد من بدء التقييم
              {subjectName ? <> لـ <span className="font-semibold text-ds-text">{subjectName}</span></> : null}
              ؟
            </p>
            <div className="mt-3 flex items-start gap-2 text-xs text-ds-muted">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>يمكنك حفظ التقييم كمسودة في أي وقت قبل الإرسال النهائي.</span>
            </div>
          </div>
        </div>
      </div>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
        <Button onClick={onConfirm} className="flex items-center gap-2">
          <ClipboardEdit className="h-4 w-4" />
          <span>{confirmLabel}</span>
        </Button>
      </ModalFooter>
    </Modal>
  );
};
