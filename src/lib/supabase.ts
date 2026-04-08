import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: 'h-lens-auth',
  },
});

export type Database = {
  users: {
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    role: 'admin' | 'employee' | 'ceo' | 'director';
    created_at: string;
    updated_at: string;
  };
  directorates: {
    id: string;
    name: string;
    director_id: string | null;
    created_at: string;
    updated_at: string;
  };
  departments: {
    id: string;
    name: string;
    manager_id: string | null;
    directorate_id: string | null;
    created_at: string;
    updated_at: string;
  };
  employees: {
    id: string;
    user_id: string | null;
    employee_number: string;
    full_name: string;
    email: string;
    phone: string | null;
    job_title: string;
    department_id: string | null;
    directorate_id: string | null;
    manager_id: string | null;
    hire_date: string;
    created_at: string;
    updated_at: string;
  };
  evaluation_periods: {
    id: string;
    year: number;
    month: number;
    start_date: string;
    end_date: string;
    status: 'نشطة' | 'مغلقة' | 'قادمة';
    general_weight: number;
    specific_weight: number;
    created_at: string;
    updated_at: string;
  };
  evaluation_criteria: {
    id: string;
    title: string;
    description: string;
    weight: number;
    order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  evaluations: {
    id: string;
    employee_id: string;
    manager_id: string;
    department_id: string;
    period_id: string;
    status: 'مسودة' | 'بانتظار الموافقة' | 'موافقة' | 'مرفوض' | 'تم الإرسال' | 'اطلع الموظف' | 'مغلق';
    final_score_500: number;
    final_score_5: number;
    percentage: number;
    general_rating: string | null;
    manager_note: string | null;
    employee_note: string | null;
    ceo_comment: string | null;
    ceo_reviewed_at: string | null;
    ceo_reviewer_id: string | null;
    submitted_at: string | null;
    viewed_by_employee_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  evaluation_scores: {
    id: string;
    evaluation_id: string;
    criterion_id: string;
    score_1_to_5: number;
    weighted_result: number;
    created_at: string;
    updated_at: string;
  };
  development_plans: {
    id: string;
    evaluation_id: string;
    item_order: number;
    development_goal: string;
    action_plan: string;
    duration: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
  audit_logs: {
    id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: any;
    created_at: string;
  };
  evaluation_settings: {
    id: string;
    general_weight: number;
    specific_weight: number;
    created_at: string;
    updated_at: string;
  };
  department_criteria: {
    id: string;
    department_id: string;
    title: string;
    description: string;
    weight: number;
    order: number;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  director_evaluations: {
    id: string;
    director_id: string;
    evaluator_id: string;
    period_id: string;
    status: 'مسودة' | 'بانتظار الموافقة' | 'موافقة' | 'مرفوض' | 'تم الإرسال' | 'اطلع المدير' | 'مغلق';
    final_score_500: number;
    final_score_5: number;
    percentage: number;
    general_rating: string | null;
    evaluator_note: string | null;
    director_note: string | null;
    ceo_comment: string | null;
    ceo_reviewed_at: string | null;
    submitted_at: string | null;
    viewed_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  director_evaluation_scores: {
    id: string;
    evaluation_id: string;
    criterion_id: string | null;
    criterion_type: 'general' | 'specific';
    department_criterion_id: string | null;
    score_1_to_5: number;
    weighted_result: number;
    created_at: string;
    updated_at: string;
  };
  supervisor_assignments: {
    id: string;
    user_id: string;
    user_type: 'employee' | 'director';
    title: string | null;
    start_date: string;
    end_date: string;
    status: 'active' | 'inactive' | 'ended';
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };
  supervisor_assignment_members: {
    id: string;
    assignment_id: string;
    employee_id: string;
    created_at: string;
  };
  supervisor_evaluations: {
    id: string;
    assignment_id: string;
    supervisor_id: string;
    employee_id: string;
    period_id: string;
    status: 'مسودة' | 'تم الإرسال' | 'اطلع الموظف' | 'مغلق';
    final_score_500: number;
    final_score_5: number;
    percentage: number;
    general_rating: string | null;
    supervisor_note: string | null;
    employee_note: string | null;
    submitted_at: string | null;
    viewed_by_employee_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
  };
  supervisor_evaluation_scores: {
    id: string;
    evaluation_id: string;
    criterion_id: string | null;
    criterion_type: 'general' | 'specific';
    department_criterion_id: string | null;
    score_1_to_5: number;
    weighted_result: number;
    created_at: string;
    updated_at: string;
  };
};
