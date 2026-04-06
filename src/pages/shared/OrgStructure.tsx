import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardBody } from '../../components/ui/Card';
import {
  Building2,
  Users,
  ChevronDown,
  ChevronLeft,
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
  GripHorizontal,
  Search,
  RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface OrgUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  job_title?: string;
  phone?: string;
  status?: string;
}

interface Directorate {
  id: string;
  name: string;
  director_id: string | null;
  director?: OrgUser | null;
}

interface Department {
  id: string;
  name: string;
  manager_id: string | null;
  directorate_id: string | null;
  manager?: OrgUser | null;
}

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title: string;
  phone?: string;
  employee_number: string;
  department_id: string | null;
  manager_id: string | null;
}

interface SupervisorAssignment {
  id: string;
  user_id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  member_count: number;
}

interface SelectedPerson {
  name: string;
  email: string;
  role: string;
  jobTitle?: string;
  phone?: string;
  department?: string;
  directorate?: string;
  reportsTo?: string;
  employeeNumber?: string;
  isSupervisor?: boolean;
  supervisorTitle?: string;
  supervisorMemberCount?: number;
}

// ─── Role Helpers ────────────────────────────────────────────────────

const roleLabel = (role: string) => {
  switch (role) {
    case 'ceo': return 'الإدارة العليا';
    case 'director': return 'مدير إدارة';
    case 'manager': return 'مدير قسم';
    case 'employee': return 'موظف';
    case 'admin': return 'الموارد البشرية';
    default: return role;
  }
};

const roleColors: Record<string, { bg: string; gradient: string; light: string; text: string; border: string; dot: string; shadow: string }> = {
  ceo:      { bg: 'bg-amber-500',   gradient: 'from-amber-500 to-orange-500',     light: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200', dot: 'bg-amber-500',   shadow: 'shadow-amber-100' },
  director: { bg: 'bg-purple-500',  gradient: 'from-purple-500 to-violet-500',    light: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200', dot: 'bg-purple-500',  shadow: 'shadow-purple-100' },
  manager:  { bg: 'bg-blue-500',    gradient: 'from-blue-500 to-indigo-500',      light: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200', dot: 'bg-blue-500',    shadow: 'shadow-blue-100' },
  employee: { bg: 'bg-emerald-500', gradient: 'from-emerald-500 to-teal-500',     light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', shadow: 'shadow-emerald-100' },
};

const getColors = (role: string) => roleColors[role] || roleColors.employee;

const RoleIcon: React.FC<{ role: string; className?: string }> = ({ role, className = 'h-4 w-4' }) => {
  switch (role) {
    case 'ceo': return <Crown className={className} />;
    case 'director': return <Landmark className={className} />;
    case 'manager': return <UserCog className={className} />;
    default: return <User className={className} />;
  }
};

// ─── Person Card Node ────────────────────────────────────────────────

const PersonNode: React.FC<{
  name: string;
  role: string;
  jobTitle?: string;
  email?: string;
  isSupervisor?: boolean;
  supervisorMemberCount?: number;
  isHead?: boolean;
  onClick: () => void;
}> = ({ name, role, jobTitle, email, isSupervisor, supervisorMemberCount, isHead, onClick }) => {
  const colors = getColors(role);

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl border ${colors.border} bg-white hover:${colors.light} hover:shadow-md transition-all duration-300 ease-out text-right w-full sm:w-auto sm:min-w-[220px] max-w-[320px] ${isHead ? `ring-2 ring-offset-1 ring-${role === 'ceo' ? 'amber' : role === 'director' ? 'purple' : 'blue'}-300` : ''}`}
    >
      {/* Avatar */}
      <div className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <span className="text-white text-sm font-bold">{name.charAt(0)}</span>
        {/* Supervisor badge */}
        {isSupervisor && (
          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white">
            <Shield className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold text-gray-900 truncate group-hover:${colors.text} transition-colors`}>{name}</p>
        <p className="text-xs text-gray-500 truncate">{jobTitle || roleLabel(role)}</p>
        {/* Dual role indicator */}
        {isSupervisor && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
              <Shield className="h-2.5 w-2.5" />
              مشرف{supervisorMemberCount ? ` (${supervisorMemberCount})` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Role indicator dot */}
      <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity`} />

      {/* Hover tooltip */}
      {email && (
        <div className="absolute -bottom-8 right-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-10">
          <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
            {email}
          </div>
        </div>
      )}
    </button>
  );
};

// ─── Tree Branch (Expandable) ────────────────────────────────────────

const TreeBranch: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  borderColor: string;
  defaultExpanded?: boolean;
  depth?: number;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, count, colorClass, borderColor, defaultExpanded = false, depth = 0, children }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`relative ${depth > 0 ? '' : ''}`}>
      {/* Branch header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${colorClass} hover:shadow-md transition-all duration-300 ease-out group`}
      >
        <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">{icon}</span>
        <div className="flex-1 text-right min-w-0">
          <span className="font-semibold text-sm block truncate">{title}</span>
          {subtitle && <span className="text-xs opacity-70 block truncate">{subtitle}</span>}
        </div>
        <span className="text-xs bg-white/80 backdrop-blur-sm text-gray-600 px-2 py-0.5 rounded-full font-medium shadow-sm">{count}</span>
        <span className="mr-1 transition-transform duration-300 ease-out" style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(90deg)' }}>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </span>
      </button>

      {/* Branch content with animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${expanded ? 'max-h-[5000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}
      >
        <div className={`mr-5 pr-5 border-r-2 ${borderColor} space-y-2.5 relative`}>
          {/* Connector dots */}
          <div className={`absolute top-0 right-[-5px] w-2 h-2 rounded-full ${borderColor.replace('border-', 'bg-')}`} />
          {children}
        </div>
      </div>
    </div>
  );
};

// ─── Detail Panel (Modal) ────────────────────────────────────────────

const DetailPanel: React.FC<{
  person: SelectedPerson;
  onClose: () => void;
}> = ({ person, onClose }) => {
  const colors = getColors(person.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className={`bg-gradient-to-br ${colors.gradient} px-6 py-6 relative overflow-hidden`}>
          {/* Decorative circles */}
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10" />

          <button onClick={onClose} className="absolute top-4 left-4 text-white/70 hover:text-white transition-colors bg-white/10 rounded-lg p-1.5 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">{person.name.charAt(0)}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{person.name}</h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs bg-white/20 backdrop-blur-sm text-white px-2.5 py-1 rounded-full flex items-center gap-1">
                  <RoleIcon role={person.role} className="h-3 w-3" />
                  {roleLabel(person.role)}
                </span>
                {person.isSupervisor && (
                  <span className="text-xs bg-orange-400/90 text-white px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    مشرف
                    {person.supervisorMemberCount ? ` — ${person.supervisorMemberCount} عضو` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="p-6 space-y-3">
          {person.jobTitle && (
            <DetailRow icon={<Briefcase />} label="المسمى الوظيفي" value={person.jobTitle} />
          )}
          <DetailRow icon={<Mail />} label="البريد الإلكتروني" value={person.email} />
          {person.phone && (
            <DetailRow icon={<Phone />} label="الهاتف" value={person.phone} />
          )}
          {person.employeeNumber && (
            <DetailRow icon={<Hash />} label="الرقم الوظيفي" value={person.employeeNumber} />
          )}
          {person.directorate && (
            <DetailRow icon={<Landmark />} label="الإدارة" value={person.directorate} />
          )}
          {person.department && (
            <DetailRow icon={<Building2 />} label="القسم" value={person.department} />
          )}
          {person.reportsTo && (
            <DetailRow icon={<UserCog />} label="المسؤول المباشر" value={person.reportsTo} />
          )}
          {person.supervisorTitle && (
            <DetailRow icon={<Shield />} label="مهمة الإشراف" value={person.supervisorTitle} color="orange" />
          )}
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: string }> = ({ icon, label, value, color }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl ${color === 'orange' ? 'bg-orange-50' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}>
    <div className={`w-9 h-9 rounded-lg ${color === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-500'} flex items-center justify-center flex-shrink-0 shadow-sm`}>
      {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4' })}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────

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
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [stats, setStats] = useState({ directors: 0, managers: 0, employees: 0, departments: 0, supervisors: 0 });

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
        ...d,
        director: users.find(u => u.id === d.director_id) || null,
      })) as Directorate[];
      setDirectorates(dirs);

      const depts = (departmentsData || []).map((d: any) => ({
        ...d,
        manager: users.find(u => u.id === d.manager_id) || null,
      })) as Department[];
      setDepartments(depts);

      setEmployees((employeesData || []) as Employee[]);

      // Build supervisor map with member counts
      const sMap: Record<string, SupervisorAssignment[]> = {};
      const today = new Date().toISOString().split('T')[0];
      (supervisorData || []).forEach((s: any) => {
        if (s.start_date <= today && s.end_date >= today) {
          if (!sMap[s.user_id]) sMap[s.user_id] = [];
          sMap[s.user_id].push({ ...s, member_count: 0 });
        }
      });

      if (Object.keys(sMap).length > 0) {
        const assignmentIds = Object.values(sMap).flat().map(s => s.id);
        const { data: memberData } = await supabase
          .from('supervisor_assignment_members')
          .select('assignment_id')
          .in('assignment_id', assignmentIds);

        if (memberData) {
          const countMap: Record<string, number> = {};
          memberData.forEach((m: any) => {
            countMap[m.assignment_id] = (countMap[m.assignment_id] || 0) + 1;
          });
          Object.values(sMap).forEach(assignments => {
            assignments.forEach(a => { a.member_count = countMap[a.id] || 0; });
          });
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
    } catch (error) {
      console.error('Error fetching org data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isSupervisor = (userId: string) => !!supervisorMap[userId];
  const getSupervisorInfo = (userId: string) => supervisorMap[userId] || [];

  const handlePersonClick = (p: {
    name: string; email: string; role: string; jobTitle?: string; phone?: string;
    department?: string; directorate?: string; reportsTo?: string; employeeNumber?: string;
    userId?: string;
  }) => {
    const assignments = p.userId ? getSupervisorInfo(p.userId) : [];
    const totalMembers = assignments.reduce((sum, a) => sum + a.member_count, 0);
    setSelectedPerson({
      ...p,
      isSupervisor: assignments.length > 0,
      supervisorTitle: assignments.length > 0 ? assignments.map(s => s.title || 'مشرف').join('، ') : undefined,
      supervisorMemberCount: totalMembers || undefined,
    });
  };

  const getDeptsByDirectorate = (directorateId: string) =>
    departments.filter(d => d.directorate_id === directorateId);

  const getUnassignedDepts = () =>
    departments.filter(d => !d.directorate_id);

  const getEmployeesByDept = (deptId: string) => {
    let emps = employees.filter(e => e.department_id === deptId);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      emps = emps.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employee_number.toLowerCase().includes(q)
      );
    }
    return emps;
  };

  const getUnassignedEmployees = () => {
    let emps = employees.filter(e => !e.department_id);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      emps = emps.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employee_number.toLowerCase().includes(q)
      );
    }
    return emps;
  };

  // Search match: does any employee/manager/director match?
  const matchesSearch = (name: string, email?: string) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return name.toLowerCase().includes(q) || (email?.toLowerCase().includes(q) ?? false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 1.5));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">جاري تحميل الهيكل التنظيمي...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الهيكل التنظيمي</h1>
          <p className="text-gray-600 mt-1">عرض التسلسل الهرمي للمنظمة وتوزيع الأدوار والمسؤوليات</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'مديري الإدارات', value: stats.directors, icon: <Landmark className="h-5 w-5" />, color: 'purple' },
          { label: 'الأقسام', value: stats.departments, icon: <Building2 className="h-5 w-5" />, color: 'blue' },
          { label: 'مدراء الأقسام', value: stats.managers, icon: <UserCog className="h-5 w-5" />, color: 'sky' },
          { label: 'الموظفون', value: stats.employees, icon: <Users className="h-5 w-5" />, color: 'emerald' },
          { label: 'المشرفون', value: stats.supervisors, icon: <Shield className="h-5 w-5" />, color: 'orange' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label}>
            <CardBody className="flex items-center gap-3 py-3 px-4">
              <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center text-${color}-600`}>
                {icon}
              </div>
              <div>
                <p className="text-[11px] text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد أو الرقم الوظيفي..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
          />
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          <button onClick={handleZoomOut} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="تصغير">
            <ZoomOut className="h-4 w-4 text-gray-600" />
          </button>
          <span className="text-xs text-gray-500 w-10 text-center font-medium">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="تكبير">
            <ZoomIn className="h-4 w-4 text-gray-600" />
          </button>
          <button onClick={handleZoomReset} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="إعادة ضبط">
            <Maximize2 className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mr-auto flex-wrap">
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> إدارة عليا</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-500" /> مديري إدارات</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> مدراء أقسام</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> موظفون</span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <Shield className="h-2.5 w-2.5 text-white" />
            </div>
            مشرف
          </span>
        </div>
      </div>

      {/* Tree */}
      <Card>
        <CardBody className="p-0 overflow-auto">
          <div
            className="p-6 sm:p-8 min-w-[400px]"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top right', transition: 'transform 0.2s ease-out' }}
          >
            {/* ═══ CEO Level ═══ */}
            {ceoUser && matchesSearch(ceoUser.full_name, ceoUser.email) && (
              <div className="flex flex-col items-center mb-6">
                <PersonNode
                  name={ceoUser.full_name}
                  role="ceo"
                  jobTitle={ceoUser.job_title}
                  email={ceoUser.email}
                  isSupervisor={isSupervisor(ceoUser.id)}
                  supervisorMemberCount={getSupervisorInfo(ceoUser.id).reduce((s, a) => s + a.member_count, 0) || undefined}
                  isHead={true}
                  onClick={() => handlePersonClick({
                    name: ceoUser.full_name, email: ceoUser.email, role: 'ceo',
                    jobTitle: ceoUser.job_title, phone: ceoUser.phone, userId: ceoUser.id,
                  })}
                />
                {(directorates.length > 0 || getUnassignedDepts().length > 0) && (
                  <div className="w-0.5 h-8 bg-gradient-to-b from-amber-300 to-purple-300 mt-1" />
                )}
              </div>
            )}

            {/* ═══ Directorates Level ═══ */}
            {directorates.length > 0 && (
              <div className="space-y-4">
                {directorates.map((dir) => {
                  const dirDepts = getDeptsByDirectorate(dir.id);
                  const totalEmpsInDir = dirDepts.reduce((sum, d) => sum + getEmployeesByDept(d.id).length, 0);

                  return (
                    <TreeBranch
                      key={dir.id}
                      title={dir.name}
                      subtitle={dir.director ? `مدير الإدارة: ${dir.director.full_name}` : undefined}
                      icon={<Landmark className="h-5 w-5 text-purple-600" />}
                      count={dirDepts.length}
                      colorClass="bg-gradient-to-l from-purple-50 to-purple-100/50 border border-purple-200 text-purple-800"
                      borderColor="border-purple-200"
                      defaultExpanded={true}
                    >
                      {/* Director card */}
                      {dir.director && matchesSearch(dir.director.full_name, dir.director.email) && (
                        <div className="mb-4">
                          <PersonNode
                            name={dir.director.full_name}
                            role="director"
                            jobTitle={dir.director.job_title}
                            email={dir.director.email}
                            isSupervisor={isSupervisor(dir.director.id)}
                            supervisorMemberCount={getSupervisorInfo(dir.director.id).reduce((s, a) => s + a.member_count, 0) || undefined}
                            isHead={true}
                            onClick={() => handlePersonClick({
                              name: dir.director!.full_name, email: dir.director!.email, role: 'director',
                              jobTitle: dir.director!.job_title, phone: dir.director!.phone,
                              directorate: dir.name, reportsTo: ceoUser?.full_name, userId: dir.director!.id,
                            })}
                          />
                        </div>
                      )}

                      {/* Departments in this directorate */}
                      {dirDepts.map((dept) => {
                        const deptEmployees = getEmployeesByDept(dept.id);
                        return (
                          <TreeBranch
                            key={dept.id}
                            title={dept.name}
                            subtitle={dept.manager ? `مدير القسم: ${dept.manager.full_name}` : undefined}
                            icon={<Building2 className="h-4 w-4 text-blue-600" />}
                            count={deptEmployees.length}
                            colorClass="bg-gradient-to-l from-blue-50 to-blue-100/50 border border-blue-200 text-blue-800"
                            borderColor="border-blue-200"
                            defaultExpanded={false}
                            depth={1}
                          >
                            {/* Manager */}
                            {dept.manager && matchesSearch(dept.manager.full_name, dept.manager.email) && (
                              <div className="mb-3">
                                <PersonNode
                                  name={dept.manager.full_name}
                                  role="manager"
                                  jobTitle={dept.manager.job_title}
                                  email={dept.manager.email}
                                  isSupervisor={isSupervisor(dept.manager.id)}
                                  supervisorMemberCount={getSupervisorInfo(dept.manager.id).reduce((s, a) => s + a.member_count, 0) || undefined}
                                  isHead={true}
                                  onClick={() => handlePersonClick({
                                    name: dept.manager!.full_name, email: dept.manager!.email, role: 'manager',
                                    jobTitle: dept.manager!.job_title, phone: dept.manager!.phone,
                                    department: dept.name, directorate: dir.name,
                                    reportsTo: dir.director?.full_name, userId: dept.manager!.id,
                                  })}
                                />
                              </div>
                            )}

                            {/* Employees */}
                            {deptEmployees.length === 0 ? (
                              <p className="text-xs text-gray-400 py-3 pr-4 italic">لا يوجد موظفون في هذا القسم</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {deptEmployees.map((emp) => (
                                  <PersonNode
                                    key={emp.id}
                                    name={emp.full_name}
                                    role="employee"
                                    jobTitle={emp.job_title}
                                    email={emp.email}
                                    isSupervisor={emp.user_id ? isSupervisor(emp.user_id) : false}
                                    supervisorMemberCount={emp.user_id ? getSupervisorInfo(emp.user_id).reduce((s, a) => s + a.member_count, 0) || undefined : undefined}
                                    onClick={() => handlePersonClick({
                                      name: emp.full_name, email: emp.email, role: 'employee',
                                      jobTitle: emp.job_title, phone: emp.phone,
                                      department: dept.name, directorate: dir.name,
                                      employeeNumber: emp.employee_number,
                                      reportsTo: dept.manager?.full_name, userId: emp.user_id,
                                    })}
                                  />
                                ))}
                              </div>
                            )}
                          </TreeBranch>
                        );
                      })}

                      {dirDepts.length === 0 && (
                        <p className="text-xs text-gray-400 py-3 pr-4 italic">لا توجد أقسام مرتبطة بهذه الإدارة</p>
                      )}
                    </TreeBranch>
                  );
                })}
              </div>
            )}

            {/* ═══ Unassigned Departments ═══ */}
            {getUnassignedDepts().length > 0 && (
              <div className="mt-6">
                <TreeBranch
                  title="أقسام غير مرتبطة بإدارة"
                  icon={<GripHorizontal className="h-5 w-5 text-gray-500" />}
                  count={getUnassignedDepts().length}
                  colorClass="bg-gradient-to-l from-gray-100 to-gray-50 border border-gray-300 text-gray-700"
                  borderColor="border-gray-300"
                  defaultExpanded={true}
                >
                  {getUnassignedDepts().map((dept) => {
                    const deptEmployees = getEmployeesByDept(dept.id);
                    return (
                      <TreeBranch
                        key={dept.id}
                        title={dept.name}
                        subtitle={dept.manager ? `مدير القسم: ${dept.manager.full_name}` : undefined}
                        icon={<Building2 className="h-4 w-4 text-blue-600" />}
                        count={deptEmployees.length}
                        colorClass="bg-gradient-to-l from-blue-50 to-blue-100/50 border border-blue-200 text-blue-800"
                        borderColor="border-blue-200"
                        defaultExpanded={false}
                        depth={1}
                      >
                        {dept.manager && matchesSearch(dept.manager.full_name, dept.manager.email) && (
                          <div className="mb-3">
                            <PersonNode
                              name={dept.manager.full_name}
                              role="manager"
                              jobTitle={dept.manager.job_title}
                              email={dept.manager.email}
                              isSupervisor={isSupervisor(dept.manager.id)}
                              supervisorMemberCount={getSupervisorInfo(dept.manager.id).reduce((s, a) => s + a.member_count, 0) || undefined}
                              isHead={true}
                              onClick={() => handlePersonClick({
                                name: dept.manager!.full_name, email: dept.manager!.email, role: 'manager',
                                jobTitle: dept.manager!.job_title, phone: dept.manager!.phone,
                                department: dept.name, userId: dept.manager!.id,
                              })}
                            />
                          </div>
                        )}
                        {deptEmployees.length === 0 ? (
                          <p className="text-xs text-gray-400 py-3 pr-4 italic">لا يوجد موظفون</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {deptEmployees.map((emp) => (
                              <PersonNode
                                key={emp.id}
                                name={emp.full_name}
                                role="employee"
                                jobTitle={emp.job_title}
                                email={emp.email}
                                isSupervisor={emp.user_id ? isSupervisor(emp.user_id) : false}
                                supervisorMemberCount={emp.user_id ? getSupervisorInfo(emp.user_id).reduce((s, a) => s + a.member_count, 0) || undefined : undefined}
                                onClick={() => handlePersonClick({
                                  name: emp.full_name, email: emp.email, role: 'employee',
                                  jobTitle: emp.job_title, phone: emp.phone,
                                  department: dept.name, employeeNumber: emp.employee_number,
                                  reportsTo: dept.manager?.full_name, userId: emp.user_id,
                                })}
                              />
                            ))}
                          </div>
                        )}
                      </TreeBranch>
                    );
                  })}
                </TreeBranch>
              </div>
            )}

            {/* ═══ Unassigned Employees ═══ */}
            {getUnassignedEmployees().length > 0 && (
              <div className="mt-6">
                <TreeBranch
                  title="موظفون غير معينين لقسم"
                  icon={<Users className="h-5 w-5 text-gray-500" />}
                  count={getUnassignedEmployees().length}
                  colorClass="bg-gradient-to-l from-gray-100 to-gray-50 border border-gray-300 text-gray-700"
                  borderColor="border-gray-300"
                  defaultExpanded={false}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getUnassignedEmployees().map((emp) => (
                      <PersonNode
                        key={emp.id}
                        name={emp.full_name}
                        role="employee"
                        jobTitle={emp.job_title}
                        email={emp.email}
                        isSupervisor={emp.user_id ? isSupervisor(emp.user_id) : false}
                        supervisorMemberCount={emp.user_id ? getSupervisorInfo(emp.user_id).reduce((s, a) => s + a.member_count, 0) || undefined : undefined}
                        onClick={() => handlePersonClick({
                          name: emp.full_name, email: emp.email, role: 'employee',
                          jobTitle: emp.job_title, phone: emp.phone,
                          employeeNumber: emp.employee_number, userId: emp.user_id,
                        })}
                      />
                    ))}
                  </div>
                </TreeBranch>
              </div>
            )}

            {/* ═══ Empty State ═══ */}
            {!ceoUser && directorates.length === 0 && departments.length === 0 && employees.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
                  <Building2 className="h-10 w-10 text-gray-300" />
                </div>
                <p className="text-gray-500 text-lg font-medium">لا توجد بيانات للهيكل التنظيمي</p>
                <p className="text-gray-400 text-sm mt-2">قم بإضافة الإدارات والأقسام والموظفين لبناء الهيكل التنظيمي</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Detail Modal */}
      {selectedPerson && (
        <DetailPanel person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}
    </div>
  );
};
