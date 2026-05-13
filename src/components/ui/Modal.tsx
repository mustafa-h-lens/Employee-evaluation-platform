import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Cap maxWidth at min(95vw, desktop-target) so modals never overflow
  // a phone viewport. On wide screens this resolves to the original
  // px value (95vw is always larger). On a 360px phone, every size
  // collapses to ~342px wide regardless of the requested desktop size.
  const maxWidth = {
    sm: 'min(95vw, 448px)',
    md: 'min(95vw, 512px)',
    lg: 'min(95vw, 672px)',
    xl: 'min(95vw, 896px)',
    '2xl': 'min(95vw, 1152px)',
  }[size];

  // Portal to body so the modal escapes any parent stacking context
  // (e.g. cards/tabs with their own z-index or transform). Without this,
  // modals rendered inside a Card can appear under the backdrop.
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        background: 'rgba(5,13,30,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div
          className="modal"
          style={{
            maxWidth,
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'right',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-hdr" style={{ flexShrink: 0 }}>
            <div>
              <div className="modal-ttl">{title}</div>
            </div>
            <button
              onClick={onClose}
              className="modal-close"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body becomes the only scrollable area so the header + any
              modal-foot stay visible while long content scrolls. */}
          <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`modal-foot ${className}`}>
      {children}
    </div>
  );
};
