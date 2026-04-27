import React, { useRef, useState } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from './Button';
import { Modal } from './Modal';
import { UserAvatar } from './UserAvatar';
import { Camera, Trash2, Upload } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const OUTPUT_SIZE = 256;

const centeredAspectCrop = (mediaWidth: number, mediaHeight: number, aspect: number): Crop =>
  centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );

const cropToBlob = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))),
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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImgSrc(reader.result?.toString() || '');
      setPickerOpen(true);
    });
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centeredAspectCrop(width, height, 1));
  };

  const handleSave = async () => {
    if (!user || !imgRef.current || !completedCrop) return;
    setSaving(true);
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop);

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
      setPickerOpen(false);
      setImgSrc('');
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

      // Best-effort: try to clean storage too
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
      } catch {
        /* swallow — DB column is the source of truth */
      }

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
        onClose={() => {
          if (!saving) {
            setPickerOpen(false);
            setImgSrc('');
          }
        }}
        title="قص الصورة"
        size="lg"
      >
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            اسحب لاختيار الجزء الذي تريد إظهاره. الصورة ستُحفظ كمربع.
          </p>
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_, percent) => setCrop(percent)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
              minWidth={64}
              keepSelection
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt=""
                onLoad={onImageLoad}
                style={{ maxHeight: '60vh', maxWidth: '100%' }}
              />
            </ReactCrop>
          )}
          <div className="flex items-center justify-end gap-2 w-full pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <Button
              variant="secondary"
              onClick={() => { setPickerOpen(false); setImgSrc(''); }}
              disabled={saving}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!completedCrop}
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
