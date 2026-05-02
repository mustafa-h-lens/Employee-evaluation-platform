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

  const maxWidth = {
    sm: '448px',
    md: '512px',
    lg: '672px',
    xl: '896px',
    '2xl': '1152px',
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
          style={{ maxWidth, width: '100%', textAlign: 'right' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-hdr">
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

          <div>
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
