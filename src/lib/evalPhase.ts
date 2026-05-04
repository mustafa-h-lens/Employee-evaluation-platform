// Approval-flow phase derived from the row's current status + reply state.
// Centralizing this here keeps PendingApprovals.tsx consistent across its
// three tabs (director→employee, CEO→director, supervisor→employee) and
// the detail modal — and makes the "waiting for the evaluatee's reply"
// gate a single rule everyone reads, instead of three near-duplicates.

export type EvalPhase =
  | 'draft'
  | 'awaiting_reply'
  | 'awaiting_ceo'
  | 'approved'
  | 'rejected';

export interface EvalPhaseInput {
  status: string;
  submittedAt: string | null;
  // The evaluatee's reply field. For director→employee that's
  // `evaluations.employee_note`; for CEO→director, `director_evaluations.director_note`;
  // for supervisor→employee, `supervisor_evaluations.employee_note`.
  reply: string | null;
}

const PENDING_STATUSES = new Set(['تم الإرسال', 'بانتظار الموافقة']);
const APPROVED_STATUSES = new Set(['موافقة', 'اطلع الموظف', 'اطلع المدير', 'مغلق', 'مكتمل']);

export function getEvalPhase({ status, submittedAt, reply }: EvalPhaseInput): EvalPhase {
  if (status === 'مرفوض') return 'rejected';
  if (APPROVED_STATUSES.has(status)) return 'approved';
  if (status === 'مسودة') return 'draft';
  if (PENDING_STATUSES.has(status) && submittedAt) {
    const hasReply = !!(reply && reply.trim().length > 0);
    return hasReply ? 'awaiting_ceo' : 'awaiting_reply';
  }
  return 'draft';
}
