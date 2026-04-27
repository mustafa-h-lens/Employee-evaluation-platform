import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from './Button';
import { Modal } from './Modal';
import { UserAvatar } from './UserAvatar';
import { Camera, Trash2, Upload } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const PREVIEW_MAX = 480;

interface CropBox {
  // All in displayed-image pixel coordinates.
  x: number;
  y: number;
  size: number;
}

interface DisplayedImage {
  url: string;
  natW: number;
  natH: number;
  dispW: number;
  dispH: number;
}

const cropImageToBlob = (img: HTMLImageElement, box: CropBox, dispW: number, dispH: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas unsupported'));
      return;
    }
    const scaleX = img.naturalWidth / dispW;
    const scaleY = img.naturalHeight / dispH;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      box.x * scaleX,
      box.y * scaleY,
      box.size * scaleX,
      box.size * scaleY,
      0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
    );
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Encode failed')),
      'image/jpeg',
      0.9,
    );
  });
};

export const AvatarUploader: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [displayed, setDisplayed] = useState<DisplayedImage | null>(null);
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Drag state
  const dragRef = useRef<{
    type: 'move' | 'resize-br' | null;
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result?.toString() || '';
      const probe = new Image();
      probe.onload = () => {
        // Fit into PREVIEW_MAX while preserving aspect.
        const ratio = Math.min(PREVIEW_MAX / probe.width, PREVIEW_MAX / probe.height, 1);
        const dispW = Math.round(probe.width * ratio);
        const dispH = Math.round(probe.height * ratio);
        const initial = Math.min(dispW, dispH);
        const initialSize = Math.round(initial * 0.9);
        const initialBox: CropBox = {
          x: Math.round((dispW - initialSize) / 2),
          y: Math.round((dispH - initialSize) / 2),
          size: initialSize,
        };
        setDisplayed({ url, natW: probe.width, natH: probe.height, dispW, dispH });
        setCrop(initialBox);
        setPickerOpen(true);
      };
      probe.onerror = () => toast.error('تعذر قراءة الصورة');
      probe.src = url;
    };
    reader.onerror = () => toast.error('فشل قراءة الملف');
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  // Mouse drag handlers — attach at window level when dragging so cursor leaving the box keeps tracking.
  useEffect(() => {
    if (!pickerOpen || !displayed || !crop) return;

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || !displayed) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const start = dragRef.current.startBox;

      if (dragRef.current.type === 'move') {
        let nx = start.x + dx;
        let ny = start.y + dy;
        nx = Math.max(0, Math.min(displayed.dispW - start.size, nx));
        ny = Math.max(0, Math.min(displayed.dispH - start.size, ny));
        setCrop({ x: nx, y: ny, size: start.size });
      } else if (dragRef.current.type === 'resize-br') {
        // Use larger of dx/dy so it stays square — clamp to image bounds.
        const delta = Math.max(dx, dy);
        let ns = start.size + delta;
        const maxFromX = displayed.dispW - start.x;
        const maxFromY = displayed.dispH - start.y;
        ns = Math.max(48, Math.min(maxFromX, maxFromY, ns));
        setCrop({ x: start.x, y: start.y, size: Math.round(ns) });
      }
    };

    const onUp = () => { dragRef.current = null; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pickerOpen, displayed, crop]);

  const startDrag = (type: 'move' | 'resize-br') => (e: React.MouseEvent) => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...crop },
    };
  };

  const closeCropper = () => {
    if (saving) return;
    setPickerOpen(false);
    setDisplayed(null);
    setCrop(null);
  };

  const handleSave = async () => {
    if (!user || !imgRef.current || !crop || !displayed) return;
    setSaving(true);
    try {
      const blob = await cropImageToBlob(imgRef.current, crop, displayed.dispW, displayed.dispH);

      const { data: { session } } = await supabase.auth.getSession();
      const authUid = session?.user?.id;
      if (!authUid) throw new Error('غير مسجل الدخول');

      const path = `${authUid}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: updErr } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (updErr) throw updErr;

      await refreshUser();
      toast.success('تم تحديث الصورة بنجاح');
      closeCropper();
    } catch (err: any) {
      toast.error(err?.message || 'فشل تحميل الصورة');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', user.id);
      if (error) throw error;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authUid = session?.user?.id;
        if (authUid) {
          const { data: list } = await supabase.storage.from('avatars').list(authUid);
          if (list && list.length > 0) {
            await supabase.storage
              .from('avatars')
              .remove(list.map((f) => `${authUid}/${f.name}`));
          }
        }
      } catch { /* swallow */ }

      await refreshUser();
      toast.success('تم إزالة الصورة');
    } catch (err: any) {
      toast.error(err?.message || 'فشل إزالة الصورة');
    } finally {
      setRemoving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-5">
      <UserAvatar
        name={user.full_name}
        avatarUrl={user.avatar_url}
        size="2xl"
        initialsLength={2}
      />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          صورة الملف الشخصي
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          PNG أو JPG، أقل من 5 ميجابايت
        </p>
        <div className="flex items-center gap-2 mt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePick}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            <span>{user.avatar_url ? 'تغيير الصورة' : 'تحميل صورة'}</span>
          </Button>
          {user.avatar_url && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleRemove}
              loading={removing}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>إزالة</span>
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={pickerOpen}
        onClose={closeCropper}
        title="قص الصورة"
        size="lg"
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            اسحب المربع لتحريكه. اسحب الزاوية لتغيير الحجم. الناتج النهائي مربع.
          </p>

          {displayed && crop && (
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                width: displayed.dispW,
                height: displayed.dispH,
                userSelect: 'none',
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              <img
                ref={imgRef}
                src={displayed.url}
                alt=""
                draggable={false}
                style={{
                  width: displayed.dispW,
                  height: displayed.dispH,
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
              {/* Dim overlay outside the crop region (4 boxes) */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: crop.y, background: 'rgba(5,13,30,0.55)' }} />
                <div style={{ position: 'absolute', left: 0, top: crop.y + crop.size, width: '100%', bottom: 0, background: 'rgba(5,13,30,0.55)' }} />
                <div style={{ position: 'absolute', left: 0, top: crop.y, width: crop.x, height: crop.size, background: 'rgba(5,13,30,0.55)' }} />
                <div style={{ position: 'absolute', left: crop.x + crop.size, top: crop.y, right: 0, height: crop.size, background: 'rgba(5,13,30,0.55)' }} />
              </div>
              {/* Crop box */}
              <div
                onMouseDown={startDrag('move')}
                style={{
                  position: 'absolute',
                  left: crop.x,
                  top: crop.y,
                  width: crop.size,
                  height: crop.size,
                  border: '2px solid var(--accent)',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
                  cursor: 'move',
                  background: 'transparent',
                  borderRadius: '50%',
                }}
              >
                {/* Corner resize handle (bottom-right relative to displayed image) */}
                <div
                  onMouseDown={startDrag('resize-br')}
                  style={{
                    position: 'absolute',
                    width: 16,
                    height: 16,
                    right: -8,
                    bottom: -8,
                    background: 'var(--accent)',
                    border: '2px solid #ffffff',
                    borderRadius: '50%',
                    cursor: 'nwse-resize',
                  }}
                />
              </div>
            </div>
          )}

          <div
            className="flex items-center justify-end gap-2 w-full pt-3"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <Button variant="secondary" onClick={closeCropper} disabled={saving}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!crop}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              <span>حفظ الصورة</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
