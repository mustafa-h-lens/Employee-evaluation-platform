import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  users: {
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    role: 'admin' | 'manager' | 'employee';
    created_at: string;
    updated_at: string;
  };
  departments: {
    id: string;
    name: string;
    manager_id: string | null;
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
    manager_id: string | null;
    hire_date: string;
    created_at: string;
    updated_at: string;
  };
  evaluation_periods: {
    id: string;
    year: number;
    quarter: number;
    start_date: string;
    end_date: string;
    status: 'نشطة' | 'مغلقة' | 'قادمة';
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
    status: 'مسودة' | 'تم الإرسال' | 'اطلع الموظف' | 'مغلق';
    final_score_500: number;
    final_score_5: number;
    percentage: number;
    general_rating: string | null;
    manager_note: string | null;
    employee_note: string | null;
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
};
