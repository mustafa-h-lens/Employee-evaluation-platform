import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { ClipboardList, MessageSquare, Send, Check, Calendar } from 'lucide-react';

interface EvaluationWithNotes {
  id: string;
  status: string;
  general_rating: string;
  percentage: number;
  manager_note: string | null;
  employee_note: string | null;
  submitted_at: string | null;
  period: {
    year: number;
    month: number;
  };
  manager: {
    full_name: string;
  };
}

const monthLabels: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
};

export const MyNotes: React.FC = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationWithNotes[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchEvaluations();
  }, [user]);

  const fetchEvaluations = async () => {
    if (!user) return;

    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!employee) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('evaluations')
      .select(`
        id, status, general_rating, percentage, manager_note, employee_note, submitted_at,
        period:evaluation_periods(year, month),
        manager:users!evaluations_manager_id_fkey(full_name)
      `)
      .eq('employee_id', employee.id)
      .in('status', ['موافقة', 'تم الإرسال', 'اطلع الموظف', 'مغلق'])
      .order('created_at', { ascending: false });

    setEvaluations((data as EvaluationWithNotes[]) || []);
    setLoading(false);
  };

  const startEditing = (ev: EvaluationWithNotes) => {
    setEditingId(ev.id);
    setNoteText(ev.employee_note || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNoteText('');
  };

  const saveNote = async (evalId: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('evaluations')
      .update({ employee_note: noteText })
      .eq('id', evalId);

    if (!error) {
      setEvaluations(prev =>
        prev.map(ev => ev.id === evalId ? { ...ev, employee_note: noteText } : ev)
      );
      setEditingId(null);
      setNoteText('');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-ds-xl p-8"
        style={{
          background: 'var(--sc-amber-grad)',
          border: '1px solid var(--sc-amber-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: 'var(--sc-amber-val)' }}>ملاحظاتي</h1>
        <p className="mt-2" style={{ color: 'var(--sc-amber-label)' }}>اطلع على ملاحظات المدير وأضف ردك على كل تقييم</p>
      </div>

      {evaluations.length === 0 ? (
        <Card>
          <CardBody className="text-center py-16">
            <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-ds-faint text-lg">لا توجد تقييمات متاحة حاليا</p>
            <p className="text-ds-faint text-sm mt-2">ستظهر ملاحظات المدير هنا بمجرد اعتماد التقييم</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-5">
          {evaluations.map(ev => (
            <Card key={ev.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusBadgeVariant(ev.general_rating)} size="sm">
                      {ev.general_rating}
                    </Badge>
                    <span className="text-sm text-ds-faint">{ev.percentage?.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-ds-muted">
                    <span className="font-semibold">{monthLabels[ev.period?.month || 1]} {ev.period?.year}</span>
                    <Calendar className="h-4 w-4 text-ds-faint" />
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-ds-text">ملاحظات المدير ({ev.manager?.full_name})</h3>
                  </div>
                  {ev.manager_note ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <p className="text-blue-900 leading-relaxed text-sm">{ev.manager_note}</p>
                    </div>
                  ) : (
                    <p className="text-ds-faint text-sm italic">لم يتم إضافة ملاحظات من المدير</p>
                  )}
                </div>

                <div className="border-t border-ds-border-subtle pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      {ev.employee_note && editingId !== ev.id && (
                        <button
                          onClick={() => startEditing(ev)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          تعديل
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-teal-600" />
                      <h3 className="text-sm font-semibold text-ds-text">ردي على التقييم</h3>
                    </div>
                  </div>

                  {editingId === ev.id ? (
                    <div className="space-y-3">
                      <TextArea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={4}
                        placeholder="اكتب ملاحظاتك أو ردك على هذا التقييم..."
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveNote(ev.id)}
                          loading={saving}
                          className="flex items-center gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>حفظ</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                        >
                          إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : ev.employee_note ? (
                    <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                      <p className="text-teal-900 leading-relaxed text-sm">{ev.employee_note}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(ev)}
                      className="w-full border-2 border-dashed border-ds-border rounded-lg p-4 text-center hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
                    >
                      <MessageSquare className="h-5 w-5 text-gray-300 mx-auto mb-1 group-hover:text-blue-400 transition-colors" />
                      <p className="text-sm text-ds-faint group-hover:text-blue-500 transition-colors">
                        اضغط لإضافة ملاحظاتك على هذا التقييم
                      </p>
                    </button>
                  )}
                </div>

                {ev.submitted_at && (
                  <p className="text-xs text-ds-faint text-right pt-1">
                    تاريخ الإرسال: {new Date(ev.submitted_at).toLocaleDateString('ar-SA')}
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
