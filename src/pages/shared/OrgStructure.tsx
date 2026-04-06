import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  Users,
  ChevronDown,
  X,
  Crown,
  Landmark,
  UserCog,
  User,
  Shield,
  Mail,
  Briefcase,
  Phone,
  Hash,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  RefreshCw,
  Filter,
  Network,
  Minus,
  Plus,
  ChevronUp,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface OrgUser {
  id: string; full_name: string; email: string; role: string;
  job_title?: string; phone?: string; status?: string;
}
interface Directorate {
  id: string; name: string; director_id: string | null; director?: OrgUser | null;
}
interface Department {
  id: string; name: string; manager_id: string | null;
  directorate_id: string | null; manager?: OrgUser | null;
}
interface Employee {
  id: string; user_id: string; full_name: string; email: string;
  job_title: string; phone?: string; employee_number: string;
  department_id: string | null; manager_id: string | null;
}
interface SupervisorAssignment {
  id: string; user_id: string; title: string; status: string;
  start_date: string; end_date: string; member_count: number;
}
interface SelectedPerson {
  name: string; email: string; role: string; jobTitle?: string; phone?: string;
  department?: string; directorate?: string; reportsTo?: string;
  employeeNumber?: string; isSupervisor?: boolean; supervisorTitle?: string;
  supervisorMemberCount?: number; teamSize?: number;
}

/* ═══════════════════════════════════════════════════════════════════════
   Role Config
   ═══════════════════════════════════════════════════════════════════════ */

const roleLabel = (r: string) =>
  ({ ceo: 'الإدارة العليا', director: 'مدير إدارة', manager: 'مدير قسم', employee: 'موظف', admin: 'الموارد البشرية' }[r] || r);

const roleCfg: Record<string, {
  gradient: string; light: string; text: string; border: string; line: string; badge: string;
}> = {
  ceo:      { gradient: 'from-amber-500 to-orange-600',   light: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300', line: '#f59e0b', badge: 'bg-amber-500' },
  director: { gradient: 'from-purple-500 to-violet-600',  light: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-300', line: '#8b5cf6', badge: 'bg-purple-500' },
  manager:  { gradient: 'from-blue-500 to-indigo-600',    light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300', line: '#3b82f6', badge: 'bg-blue-500' },
  employee: { gradient: 'from-emerald-500 to-teal-600',   light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', line: '#10b981', badge: 'bg-emerald-500' },
};
const rc = (r: string) => roleCfg[r] || roleCfg.employee;

const RoleIcon: React.FC<{ role: string; className?: string }> = ({ role, className = 'h-4 w-4' }) => {
  switch (role) {
    case 'ceo': return <Crown className={className} />;
    case 'director': return <Landmark className={className} />;
    case 'manager': return <UserCog className={className} />;
    default: return <User className={className} />;
  }
};

const initials = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0][0];
};

/* ═══════════════════════════════════════════════════════════════════════
   CSS  (embedded for self-contained component)
   ═══════════════════════════════════════════════════════════════════════ */

const treeCSS = `
/* ── vertical connector from parent to horizontal bar ── */
.org-tree ul { position: relative; padding-top: 28px; display: flex; justify-content: center; gap: 0; }
.org-tree ul::before {
  content: ''; position: absolute; top: 0; left: 50%; width: 2px; height: 28px;
  background: var(--line-color, #d1d5db);
}

/* ── horizontal bar across siblings ── */
.org-tree ul::after {
  content: ''; position: absolute; top: 28px; height: 2px;
  background: var(--line-color, #d1d5db);
  left: var(--bar-left, 50%); right: var(--bar-right, 50%);
}

/* ── each child item ── */
.org-tree li {
  position: relative; display: flex; flex-direction: column; align-items: center;
  padding: 0 12px; flex-shrink: 0;
}
/* vertical drop from horizontal bar to child node */
.org-tree li::before {
  content: ''; position: absolute; top: 0; left: 50%;
  width: 2px; height: 20px; background: var(--line-color, #d1d5db);
}
/* first & last child: clip horizontal bar */
.org-tree li:first-child::after,
.org-tree li:last-child::after { display: none; }

/* ── hide connector for single-child ── */
.org-tree ul.single-child::after { display: none; }
.org-tree ul.single-child > li::before { height: 0; }
.org-tree ul.single-child { padding-top: 0; }
.org-tree ul.single-child::before { height: 0; }

/* ── Node card animations ── */
.org-node { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.org-node:hover { transform: translateY(-3px); }

/* ── Expand animation ── */
.org-expand-enter { animation: orgExpand 0.35s ease-out forwards; }
@keyframes orgExpand {
  from { opacity: 0; transform: translateY(-12px) scaleY(0.95); }
  to { opacity: 1; transform: translateY(0) scaleY(1); }
}

/* ── Modal ── */
@keyframes modalSlide {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
`;

/* ═══════════════════════════════════════════════════════════════════════
   Tree Node Card
   ═══════════════════════════════════════════════════════════════════════ */

const TreeNodeCard: React.FC<{
  name: string; role: string; jobTitle?: string; email?: string;
  subtitle?: string; teamSize?: number;
  isSupervisor?: boolean; supCount?: number;
  isHighlight?: boolean;
  hasChildren?: boolean; expanded?: boolean; onToggle?: () => void;
  onClick: () => void;
}> = ({ name, role, jobTitle, email, subtitle, teamSize, isSupervisor, supCount, isHighlight, hasChildren, expanded, onToggle, onClick }) => {
  const c = rc(role);
  return (
    <div className="flex flex-col items-center" style={{ paddingTop: 20 }}>
      <div
        className={`org-node relative bg-white rounded-2xl border-2 ${isHighlight ? 'border-yellow-400 ring-2 ring-yellow-200' : c.border} shadow-sm hover:shadow-xl cursor-pointer w-[200px] overflow-hidden`}
        onClick={onClick}
      >
        {/* Top accent */}
        <div className={`h-1.5 bg-gradient-to-l ${c.gradient}`} />

        <div className="px-4 pt-3.5 pb-3 flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="relative mb-2">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg ring-3 ring-white`}>
              <span className="text-white font-bold text-base">{initials(name)}</span>
            </div>
            {isSupervisor && (
              <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center ring-2 ring-white shadow">
                <Shield className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

          {/* Name & title */}
          <p className="text-[13px] font-bold text-gray-900 leading-tight truncate w-full">{name}</p>
          <p className="text-[11px] text-gray-500 truncate w-full mt-0.5">{jobTitle || roleLabel(role)}</p>
          {subtitle && <p className="text-[10px] text-gray-400 truncate w-full">{subtitle}</p>}

          {/* Badges row */}
          <div className="flex items-center gap-1 mt-2 flex-wrap justify-center">
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold text-white ${c.badge} px-2 py-0.5 rounded-full`}>
              <RoleIcon role={role} className="h-2.5 w-2.5" />
              {roleLabel(role)}
            </span>
            {isSupervisor && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full">
                <Shield className="h-2.5 w-2.5" />
                مشرف{supCount ? ` ${supCount}` : ''}
              </span>
            )}
          </div>

          {/* Team size */}
          {teamSize !== undefined && teamSize > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
              <Users className="h-3 w-3" />
              <span>{teamSize} موظف</span>
            </div>
          )}
        </div>

        {/* Hover email */}
        {email && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 whitespace-nowrap">
            <div className="bg-gray-900 text-white text-[9px] px-2 py-1 rounded-md shadow-lg">{email}</div>
          </div>
        )}
      </div>

      {/* Expand/collapse toggle */}
      {hasChildren && onToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`mt-1.5 w-6 h-6 rounded-full border-2 ${c.border} bg-white flex items-center justify-center hover:shadow-md transition-all z-10 hover:scale-110`}
          style={{ marginBottom: -10 }}
        >
          {expanded
            ? <Minus className={`h-3 w-3 ${c.text}`} />
            : <Plus className={`h-3 w-3 ${c.text}`} />
          }
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   Group Header (for department sections inside tree)
   ═══════════════════════════════════════════════════════════════════════ */

const GroupNode: React.FC<{
  title: string; count: number; icon: React.ReactNode;
  color: 'purple' | 'blue' | 'gray';
  expanded: boolean; onToggle: () => void;
}> = ({ title, count, icon, color, expanded, onToggle }) => {
  const schemes = {
    purple: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', badge: 'bg-purple-500' },
    blue:   { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500' },
    gray:   { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', badge: 'bg-gray-500' },
  };
  const s = schemes[color];
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${s.bg} ${s.text} hover:shadow-md transition-all text-right min-w-[180px]`}
    >
      {icon}
      <span className="font-bold text-xs truncate flex-1">{title}</span>
      <span className={`text-[9px] text-white ${s.badge} w-5 h-5 rounded-full flex items-center justify-center font-bold`}>{count}</span>
      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? '' : '-rotate-90'}`} />
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   Detail Modal
   ═══════════════════════════════════════════════════════════════════════ */

const DetailModal: React.FC<{ person: SelectedPerson; onClose: () => void }> = ({ person, onClose }) => {
  const c = rc(person.role);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'modalSlide 0.3s ease-out' }}
      >
        {/* Header */}
        <div className={`relative bg-gradient-to-br ${c.gradient} px-6 pt-8 pb-12 overflow-hidden`}>
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
          <button onClick={onClose} className="absolute top-4 left-4 text-white/80 hover:text-white bg-white/20 rounded-xl p-2 hover:bg-white/30 backdrop-blur-sm transition-colors">
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg mb-3">
              <span className="text-white text-3xl font-bold">{initials(person.name)}</span>
            </div>
            <h3 className="text-xl font-bold text-white">{person.name}</h3>
            <p className="text-white/80 text-sm mt-1">{person.jobTitle || roleLabel(person.role)}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
              <span className="text-xs bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
                <RoleIcon role={person.role} className="h-3.5 w-3.5" />
                {roleLabel(person.role)}
              </span>
              {person.isSupervisor && (
                <span className="text-xs bg-orange-500/80 text-white px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
                  <Shield className="h-3.5 w-3.5" />
                  مشرف{person.supervisorMemberCount ? ` — ${person.supervisorMemberCount} عضو` : ''}
                </span>
              )}
              {person.teamSize !== undefined && person.teamSize > 0 && (
                <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full flex items-center gap-1.5 font-medium">
                  <Users className="h-3.5 w-3.5" />
                  {person.teamSize} موظف
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-2.5 -mt-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2.5">
            <DetailRow icon={<Mail />} label="البريد الإلكتروني" value={person.email} />
            {person.phone && <DetailRow icon={<Phone />} label="الهاتف" value={person.phone} />}
            {person.employeeNumber && <DetailRow icon={<Hash />} label="الرقم الوظيفي" value={person.employeeNumber} />}
            {person.jobTitle && <DetailRow icon={<Briefcase />} label="المسمى الوظيفي" value={person.jobTitle} />}
            {person.directorate && <DetailRow icon={<Landmark />} label="الإدارة" value={person.directorate} />}
            {person.department && <DetailRow icon={<Building2 />} label="القسم" value={person.department} />}
            {person.reportsTo && <DetailRow icon={<UserCog />} label="المسؤول المباشر" value={person.reportsTo} />}
            {person.supervisorTitle && <DetailRow icon={<Shield />} label="مهمة الإشراف" value={person.supervisorTitle} accent />}
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: boolean }> = ({ icon, label, value, accent }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl ${accent ? 'bg-orange-50' : 'bg-gray-50/80'} hover:bg-gray-100 transition-colors`}>
    <div className={`w-9 h-9 rounded-xl ${accent ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-500 shadow-sm'} flex items-center justify-center flex-shrink-0`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4' })}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════ */

export const OrgStructure: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ceoUser, setCeoUser] = useState<OrgUser | null>(null);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supervisorMap, setSupervisorMap] = useState<Record<string, SupervisorAssignment[]>>({});
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ directors: 0, managers: 0, employees: 0, departments: 0, supervisors: 0 });

  // ── Data fetching ──────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [
        { data: usersData },
        { data: directoratesData },
        { data: departmentsData },
        { data: employeesData },
        { data: supervisorData },
      ] = await Promise.all([
        supabase.from('users').select('id, full_name, email, role, job_title, phone, status').in('role', ['ceo', 'director', 'manager', 'employee']).eq('status', 'active'),
        supabase.from('directorates').select('id, name, director_id'),
        supabase.from('departments').select('id, name, manager_id, directorate_id').eq('status', 'active'),
        supabase.from('employees').select('id, user_id, full_name, email, job_title, phone, employee_number, department_id, manager_id').eq('status', 'active'),
        supabase.from('supervisor_assignments').select('id, user_id, title, status, start_date, end_date').eq('status', 'active'),
      ]);

      const users = (usersData || []) as OrgUser[];
      setCeoUser(users.find(u => u.role === 'ceo') || null);

      const dirs = (directoratesData || []).map((d: any) => ({
        ...d, director: users.find(u => u.id === d.director_id) || null,
      })) as Directorate[];
      setDirectorates(dirs);

      const depts = (departmentsData || []).map((d: any) => ({
        ...d, manager: users.find(u => u.id === d.manager_id) || null,
      })) as Department[];
      setDepartments(depts);
      setEmployees((employeesData || []) as Employee[]);

      // Default: expand all directorates
      setExpandedDirs(new Set(dirs.map(d => d.id)));

      // Supervisor map
      const sMap: Record<string, SupervisorAssignment[]> = {};
      const today = new Date().toISOString().split('T')[0];
      (supervisorData || []).forEach((s: any) => {
        if (s.start_date <= today && s.end_date >= today) {
          if (!sMap[s.user_id]) sMap[s.user_id] = [];
          sMap[s.user_id].push({ ...s, member_count: 0 });
        }
      });
      if (Object.keys(sMap).length > 0) {
        const aIds = Object.values(sMap).flat().map(s => s.id);
        const { data: mData } = await supabase.from('supervisor_assignment_members').select('assignment_id').in('assignment_id', aIds);
        if (mData) {
          const cnt: Record<string, number> = {};
          mData.forEach((m: any) => { cnt[m.assignment_id] = (cnt[m.assignment_id] || 0) + 1; });
          Object.values(sMap).forEach(arr => arr.forEach(a => { a.member_count = cnt[a.id] || 0; }));
        }
      }
      setSupervisorMap(sMap);

      setStats({
        directors: users.filter(u => u.role === 'director').length,
        managers: users.filter(u => u.role === 'manager').length,
        employees: (employeesData || []).length,
        departments: (departmentsData || []).length,
        supervisors: Object.keys(sMap).length,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Helpers ────────────────────────────────────────────────────────
  const isSup = (uid: string) => !!supervisorMap[uid];
  const supInfo = (uid: string) => supervisorMap[uid] || [];
  const supMembers = (uid: string) => supInfo(uid).reduce((s, a) => s + a.member_count, 0) || undefined;

  const handleClick = (p: any) => {
    const assignments = p.userId ? supInfo(p.userId) : [];
    const total = assignments.reduce((s: number, a: SupervisorAssignment) => s + a.member_count, 0);
    setSelectedPerson({
      ...p,
      isSupervisor: assignments.length > 0,
      supervisorTitle: assignments.length > 0 ? assignments.map(s => s.title || 'مشرف').join('، ') : undefined,
      supervisorMemberCount: total || undefined,
    });
  };

  const toggleDir = (id: string) => setExpandedDirs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDept = (id: string) => setExpandedDepts(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const expandAll = () => { setExpandedDirs(new Set(directorates.map(d => d.id))); setExpandedDepts(new Set(departments.map(d => d.id))); };
  const collapseAll = () => { setExpandedDirs(new Set()); setExpandedDepts(new Set()); };

  const deptsByDir = (dId: string) => departments.filter(d => d.directorate_id === dId);
  const empsByDept = (dId: string) => employees.filter(e => e.department_id === dId);
  const unassignedDepts = departments.filter(d => !d.directorate_id);
  const unassignedEmps = employees.filter(e => !e.department_id);

  const matchSearch = (name: string, email?: string) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || (email?.toLowerCase().includes(q) ?? false);
  };

  const filterEmps = (emps: Employee[]) => {
    if (!searchQuery.trim()) return emps;
    const q = searchQuery.toLowerCase();
    return emps.filter(e => e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.employee_number.toLowerCase().includes(q));
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(1.5, z - e.deltaY * 0.001))); }
  }, []);

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-100 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-gray-600 font-medium">جاري تحميل الهيكل التنظيمي...</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <style>{treeCSS}</style>

      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <Network className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الهيكل التنظيمي</h1>
            <p className="text-gray-500 text-sm">التسلسل الهرمي للمنظمة</p>
          </div>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* ═══ Stats ═══ */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { l: 'مديري إدارات', v: stats.directors, icon: <Landmark className="h-5 w-5" />, bg: 'bg-purple-50 text-purple-600' },
          { l: 'أقسام', v: stats.departments, icon: <Building2 className="h-5 w-5" />, bg: 'bg-blue-50 text-blue-600' },
          { l: 'مدراء أقسام', v: stats.managers, icon: <UserCog className="h-5 w-5" />, bg: 'bg-sky-50 text-sky-600' },
          { l: 'موظفون', v: stats.employees, icon: <Users className="h-5 w-5" />, bg: 'bg-emerald-50 text-emerald-600' },
          { l: 'مشرفون', v: stats.supervisors, icon: <Shield className="h-5 w-5" />, bg: 'bg-orange-50 text-orange-600' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>{s.icon}</div>
            <div>
              <p className="text-[10px] text-gray-400 font-medium">{s.l}</p>
              <p className="text-xl font-bold text-gray-900">{s.v}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="بحث بالاسم أو البريد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
        </div>

        <div className="h-7 w-px bg-gray-200" />

        <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1.5 hover:bg-blue-50 rounded-lg transition-colors">توسيع الكل</button>
        <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors">طي الكل</button>

        <div className="h-7 w-px bg-gray-200" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"><ZoomOut className="h-3.5 w-3.5 text-gray-600" /></button>
          <span className="text-[10px] text-gray-500 w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"><ZoomIn className="h-3.5 w-3.5 text-gray-600" /></button>
          <button onClick={() => setZoom(0.85)} className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"><Maximize2 className="h-3 w-3 text-gray-600" /></button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-gray-500 mr-auto flex-wrap">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />إدارة عليا</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" />مديري إدارات</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />مدراء أقسام</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />موظفون</span>
          <span className="flex items-center gap-1">
            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <Shield className="h-2 w-2 text-white" />
            </div>مشرف
          </span>
        </div>
      </div>

      {/* ═══ Tree Chart ═══ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-auto" onWheel={handleWheel} style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <div className="org-tree p-10 min-w-[800px]" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.25s ease' }}>

            {/* ═══ CEO ═══ */}
            {ceoUser && (
              <div className="flex flex-col items-center">
                <TreeNodeCard
                  name={ceoUser.full_name} role="ceo" jobTitle={ceoUser.job_title} email={ceoUser.email}
                  isSupervisor={isSup(ceoUser.id)} supCount={supMembers(ceoUser.id)}
                  isHighlight={!!searchQuery && matchSearch(ceoUser.full_name, ceoUser.email)}
                  teamSize={stats.directors + stats.managers + stats.employees}
                  hasChildren={directorates.length > 0}
                  expanded={expandedDirs.size > 0}
                  onToggle={() => expandedDirs.size > 0 ? collapseAll() : expandAll()}
                  onClick={() => handleClick({ name: ceoUser.full_name, email: ceoUser.email, role: 'ceo', jobTitle: ceoUser.job_title, phone: ceoUser.phone, userId: ceoUser.id, teamSize: stats.directors + stats.managers + stats.employees })}
                />

                {/* ── Directorates tree ── */}
                {directorates.length > 0 && expandedDirs.size > 0 && (
                  <ul className="org-expand-enter" style={{
                    '--line-color': '#f59e0b',
                    '--bar-left': directorates.length > 1 ? `${50 / directorates.length}%` : '50%',
                    '--bar-right': directorates.length > 1 ? `${50 / directorates.length}%` : '50%',
                  } as React.CSSProperties}>
                    {directorates.map(dir => {
                      const dirDepts = deptsByDir(dir.id);
                      const dirExpanded = expandedDirs.has(dir.id);
                      const totalEmpCount = dirDepts.reduce((sum, d) => sum + empsByDept(d.id).length, 0);

                      return (
                        <li key={dir.id} style={{ '--line-color': '#8b5cf6' } as React.CSSProperties}>
                          {/* Director node */}
                          {dir.director ? (
                            <TreeNodeCard
                              name={dir.director.full_name} role="director" subtitle={dir.name}
                              jobTitle={dir.director.job_title} email={dir.director.email}
                              isSupervisor={isSup(dir.director.id)} supCount={supMembers(dir.director.id)}
                              isHighlight={!!searchQuery && matchSearch(dir.director.full_name, dir.director.email)}
                              teamSize={totalEmpCount}
                              hasChildren={dirDepts.length > 0} expanded={dirExpanded}
                              onToggle={() => toggleDir(dir.id)}
                              onClick={() => handleClick({
                                name: dir.director!.full_name, email: dir.director!.email, role: 'director',
                                jobTitle: dir.director!.job_title, phone: dir.director!.phone,
                                directorate: dir.name, reportsTo: ceoUser?.full_name, userId: dir.director!.id,
                                teamSize: totalEmpCount,
                              })}
                            />
                          ) : (
                            <div style={{ paddingTop: 20 }}>
                              <GroupNode title={dir.name} count={dirDepts.length}
                                icon={<Landmark className="h-4 w-4 text-purple-600" />}
                                color="purple" expanded={dirExpanded} onToggle={() => toggleDir(dir.id)} />
                            </div>
                          )}

                          {/* ── Departments ── */}
                          {dirExpanded && dirDepts.length > 0 && (
                            <ul className="org-expand-enter" style={{
                              '--line-color': '#8b5cf6',
                              '--bar-left': dirDepts.length > 1 ? `${50 / dirDepts.length}%` : '50%',
                              '--bar-right': dirDepts.length > 1 ? `${50 / dirDepts.length}%` : '50%',
                            } as React.CSSProperties}>
                              {dirDepts.map(dept => {
                                const deptEmps = filterEmps(empsByDept(dept.id));
                                const deptExpanded = expandedDepts.has(dept.id);

                                return (
                                  <li key={dept.id} style={{ '--line-color': '#3b82f6' } as React.CSSProperties}>
                                    {/* Manager node */}
                                    {dept.manager ? (
                                      <TreeNodeCard
                                        name={dept.manager.full_name} role="manager" subtitle={dept.name}
                                        jobTitle={dept.manager.job_title} email={dept.manager.email}
                                        isSupervisor={isSup(dept.manager.id)} supCount={supMembers(dept.manager.id)}
                                        isHighlight={!!searchQuery && matchSearch(dept.manager.full_name, dept.manager.email)}
                                        teamSize={empsByDept(dept.id).length}
                                        hasChildren={empsByDept(dept.id).length > 0} expanded={deptExpanded}
                                        onToggle={() => toggleDept(dept.id)}
                                        onClick={() => handleClick({
                                          name: dept.manager!.full_name, email: dept.manager!.email, role: 'manager',
                                          jobTitle: dept.manager!.job_title, phone: dept.manager!.phone,
                                          department: dept.name, directorate: dir.name,
                                          reportsTo: dir.director?.full_name, userId: dept.manager!.id,
                                          teamSize: empsByDept(dept.id).length,
                                        })}
                                      />
                                    ) : (
                                      <div style={{ paddingTop: 20 }}>
                                        <GroupNode title={dept.name} count={empsByDept(dept.id).length}
                                          icon={<Building2 className="h-4 w-4 text-blue-600" />}
                                          color="blue" expanded={deptExpanded} onToggle={() => toggleDept(dept.id)} />
                                      </div>
                                    )}

                                    {/* ── Employees ── */}
                                    {deptExpanded && deptEmps.length > 0 && (
                                      <ul className={`org-expand-enter ${deptEmps.length === 1 ? 'single-child' : ''}`} style={{
                                        '--line-color': '#3b82f6',
                                        '--bar-left': deptEmps.length > 1 ? `${50 / deptEmps.length}%` : '50%',
                                        '--bar-right': deptEmps.length > 1 ? `${50 / deptEmps.length}%` : '50%',
                                      } as React.CSSProperties}>
                                        {deptEmps.map(emp => (
                                          <li key={emp.id} style={{ '--line-color': '#10b981' } as React.CSSProperties}>
                                            <TreeNodeCard
                                              name={emp.full_name} role="employee" jobTitle={emp.job_title} email={emp.email}
                                              isSupervisor={emp.user_id ? isSup(emp.user_id) : false}
                                              supCount={emp.user_id ? supMembers(emp.user_id) : undefined}
                                              isHighlight={!!searchQuery && matchSearch(emp.full_name, emp.email)}
                                              onClick={() => handleClick({
                                                name: emp.full_name, email: emp.email, role: 'employee',
                                                jobTitle: emp.job_title, phone: emp.phone,
                                                department: dept.name, directorate: dir.name,
                                                employeeNumber: emp.employee_number,
                                                reportsTo: dept.manager?.full_name, userId: emp.user_id,
                                              })}
                                            />
                                          </li>
                                        ))}
                                      </ul>
                                    )}

                                    {deptExpanded && deptEmps.length === 0 && (
                                      <div className="pt-4 pb-2 text-center">
                                        <p className="text-[11px] text-gray-400">
                                          {searchQuery ? 'لا توجد نتائج' : 'لا يوجد موظفون'}
                                        </p>
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}

                          {dirExpanded && dirDepts.length === 0 && (
                            <div className="pt-4 text-center">
                              <p className="text-[11px] text-gray-400">لا توجد أقسام</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* ═══ Unassigned Departments ═══ */}
            {unassignedDepts.length > 0 && (
              <div className="mt-10 flex flex-col items-center">
                <div className="mb-4 px-4 py-2 bg-gray-100 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  أقسام غير مرتبطة بإدارة ({unassignedDepts.length})
                </div>
                <div className="flex flex-wrap justify-center gap-6">
                  {unassignedDepts.map(dept => {
                    const deptEmps = filterEmps(empsByDept(dept.id));
                    const deptExpanded = expandedDepts.has(dept.id);
                    return (
                      <div key={dept.id} className="flex flex-col items-center">
                        {dept.manager ? (
                          <TreeNodeCard
                            name={dept.manager.full_name} role="manager" subtitle={dept.name}
                            jobTitle={dept.manager.job_title} email={dept.manager.email}
                            isSupervisor={isSup(dept.manager.id)} supCount={supMembers(dept.manager.id)}
                            teamSize={empsByDept(dept.id).length}
                            hasChildren={empsByDept(dept.id).length > 0} expanded={deptExpanded}
                            onToggle={() => toggleDept(dept.id)}
                            onClick={() => handleClick({
                              name: dept.manager!.full_name, email: dept.manager!.email, role: 'manager',
                              jobTitle: dept.manager!.job_title, phone: dept.manager!.phone,
                              department: dept.name, userId: dept.manager!.id, teamSize: empsByDept(dept.id).length,
                            })}
                          />
                        ) : (
                          <div style={{ paddingTop: 20 }}>
                            <GroupNode title={dept.name} count={empsByDept(dept.id).length}
                              icon={<Building2 className="h-4 w-4 text-blue-600" />}
                              color="blue" expanded={deptExpanded} onToggle={() => toggleDept(dept.id)} />
                          </div>
                        )}
                        {deptExpanded && deptEmps.length > 0 && (
                          <ul className={`org-expand-enter ${deptEmps.length === 1 ? 'single-child' : ''}`} style={{
                            '--line-color': '#3b82f6',
                            '--bar-left': deptEmps.length > 1 ? `${50 / deptEmps.length}%` : '50%',
                            '--bar-right': deptEmps.length > 1 ? `${50 / deptEmps.length}%` : '50%',
                          } as React.CSSProperties}>
                            {deptEmps.map(emp => (
                              <li key={emp.id} style={{ '--line-color': '#10b981' } as React.CSSProperties}>
                                <TreeNodeCard
                                  name={emp.full_name} role="employee" jobTitle={emp.job_title} email={emp.email}
                                  isSupervisor={emp.user_id ? isSup(emp.user_id) : false}
                                  supCount={emp.user_id ? supMembers(emp.user_id) : undefined}
                                  onClick={() => handleClick({
                                    name: emp.full_name, email: emp.email, role: 'employee',
                                    jobTitle: emp.job_title, phone: emp.phone,
                                    department: dept.name, employeeNumber: emp.employee_number,
                                    reportsTo: dept.manager?.full_name, userId: emp.user_id,
                                  })}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ Unassigned Employees ═══ */}
            {unassignedEmps.length > 0 && (
              <div className="mt-10 flex flex-col items-center">
                <div className="mb-4 px-4 py-2 bg-gray-100 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  موظفون بدون قسم ({unassignedEmps.length})
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  {filterEmps(unassignedEmps).map(emp => (
                    <TreeNodeCard
                      key={emp.id}
                      name={emp.full_name} role="employee" jobTitle={emp.job_title} email={emp.email}
                      isSupervisor={emp.user_id ? isSup(emp.user_id) : false}
                      supCount={emp.user_id ? supMembers(emp.user_id) : undefined}
                      onClick={() => handleClick({
                        name: emp.full_name, email: emp.email, role: 'employee',
                        jobTitle: emp.job_title, phone: emp.phone,
                        employeeNumber: emp.employee_number, userId: emp.user_id,
                      })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Empty ═══ */}
            {!ceoUser && directorates.length === 0 && departments.length === 0 && employees.length === 0 && (
              <div className="text-center py-24">
                <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  <Network className="h-12 w-12 text-gray-300" />
                </div>
                <p className="text-gray-600 text-lg font-bold">لا توجد بيانات للهيكل التنظيمي</p>
                <p className="text-gray-400 text-sm mt-2">قم بإضافة الإدارات والأقسام والموظفين</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Modal ═══ */}
      {selectedPerson && <DetailModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </div>
  );
};
