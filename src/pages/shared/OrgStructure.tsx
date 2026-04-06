import React, { useEffect, useState, useCallback, useRef } from 'react';
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

const roleColor = (role: string) => {
  switch (role) {
    case 'ceo': return { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', ring: 'ring-amber-200' };
    case 'director': return { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', ring: 'ring-purple-200' };
    case 'manager': return { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', ring: 'ring-blue-200' };
    case 'employee': return { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', ring: 'ring-emerald-200' };
    default: return { bg: 'bg-gray-500', light: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300', ring: 'ring-gray-200' };
  }
};

const RoleIcon: React.FC<{ role: string; className?: string }> = ({ role, className = 'h-4 w-4' }) => {
  switch (role) {
    case 'ceo': return <Crown className={className} />;
    case 'director': return <Landmark className={className} />;
    case 'manager': return <UserCog className={className} />;
    case 'employee': return <User className={className} />;
    default: return <User className={className} />;
  }
};

// ─── Person Node ─────────────────────────────────────────────────────

const PersonNode: React.FC<{
  name: string;
  role: string;
  jobTitle?: string;
  isSupervisor?: boolean;
  onClick: () => void;
}> = ({ name, role, jobTitle, isSupervisor, onClick }) => {
  const colors = roleColor(role);
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 ${colors.border} ${colors.light} hover:shadow-lg hover:scale-[1.02] transition-all duration-200 text-right min-w-[180px]`}
    >
      <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-sm font-bold">{name.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${colors.text} truncate`}>{name}</p>
        <p className="text-xs text-gray-500 truncate">{jobTitle || roleLabel(role)}</p>
      </div>
      {isSupervisor && (
        <div className="absolute -top-2 -left-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
          <Shield className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
};

// ─── Expandable Group ────────────────────────────────────────────────

const ExpandableGroup: React.FC<{
  title: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, count, color, defaultExpanded = false, children }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${color} hover:shadow-md transition-all duration-200`}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs bg-white/80 text-gray-600 px-2 py-0.5 rounded-full font-medium">{count}</span>
        <span className="mr-auto">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronLeft className="h-4 w-4 text-gray-500" />}
        </span>
      </button>
      {expanded && (
        <div className="mt-3 mr-6 pr-4 border-r-2 border-gray-200 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Detail Panel ────────────────────────────────────────────────────

const DetailPanel: React.FC<{
  person: SelectedPerson;
  onClose: () => void;
}> = ({ person, onClose }) => {
  const colors = roleColor(person.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${colors.bg} px-6 py-5`}>
          <button onClick={onClose} className="absolute top-4 left-4 text-white/80 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">{person.name.charAt(0)}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{person.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {roleLabel(person.role)}
                </span>
                {person.isSupervisor && (
                  <span className="text-xs bg-orange-400/80 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    مشرف
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          {person.jobTitle && (
            <DetailRow icon={<Briefcase className="h-4 w-4" />} label="المسمى الوظيفي" value={person.jobTitle} />
          )}
          <DetailRow icon={<Mail className="h-4 w-4" />} label="البريد الإلكتروني" value={person.email} />
          {person.phone && (
            <DetailRow icon={<Phone className="h-4 w-4" />} label="الهاتف" value={person.phone} />
          )}
          {person.employeeNumber && (
            <DetailRow icon={<Hash className="h-4 w-4" />} label="الرقم الوظيفي" value={person.employeeNumber} />
          )}
          {person.directorate && (
            <DetailRow icon={<Landmark className="h-4 w-4" />} label="الإدارة" value={person.directorate} />
          )}
          {person.department && (
            <DetailRow icon={<Building2 className="h-4 w-4" />} label="القسم" value={person.department} />
          )}
          {person.reportsTo && (
            <DetailRow icon={<UserCog className="h-4 w-4" />} label="المسؤول المباشر" value={person.reportsTo} />
          )}
          {person.supervisorTitle && (
            <DetailRow icon={<Shield className="h-4 w-4" />} label="مهمة الإشراف" value={person.supervisorTitle} />
          )}
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 mt-0.5">
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  </div>
);

// ─── Connector Lines ─────────────────────────────────────────────────

const VerticalConnector: React.FC = () => (
  <div className="flex justify-center">
    <div className="w-0.5 h-6 bg-gray-300" />
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────

export const OrgStructure: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ceoUser, setCeoUser] = useState<OrgUser | null>(null);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supervisorMap, setSupervisorMap] = useState<Record<string, SupervisorAssignment[]>>({});
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stats
  const [stats, setStats] = useState({ directors: 0, managers: 0, employees: 0, departments: 0 });

  const fetchData = useCallback(async () => {
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
      const ceo = users.find(u => u.role === 'ceo') || null;
      setCeoUser(ceo);

      // Build directorates with directors
      const dirs = (directoratesData || []).map((d: any) => ({
        ...d,
        director: users.find(u => u.id === d.director_id) || null,
      })) as Directorate[];
      setDirectorates(dirs);

      // Build departments with managers
      const depts = (departmentsData || []).map((d: any) => ({
        ...d,
        manager: users.find(u => u.id === d.manager_id) || null,
      })) as Department[];
      setDepartments(depts);

      setEmployees((employeesData || []) as Employee[]);

      // Build supervisor map
      const sMap: Record<string, SupervisorAssignment[]> = {};
      const today = new Date().toISOString().split('T')[0];
      (supervisorData || []).forEach((s: any) => {
        if (s.start_date <= today && s.end_date >= today) {
          if (!sMap[s.user_id]) sMap[s.user_id] = [];
          sMap[s.user_id].push({ ...s, member_count: 0 });
        }
      });

      // Count members for each supervisor
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

      // Stats
      setStats({
        directors: users.filter(u => u.role === 'director').length,
        managers: users.filter(u => u.role === 'manager').length,
        employees: (employeesData || []).length,
        departments: (departmentsData || []).length,
      });
    } catch (error) {
      console.error('Error fetching org data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isSupervisor = (userId: string) => !!supervisorMap[userId];

  const handlePersonClick = (p: {
    name: string; email: string; role: string; jobTitle?: string; phone?: string;
    department?: string; directorate?: string; reportsTo?: string; employeeNumber?: string;
    userId?: string; supervisorTitle?: string;
  }) => {
    setSelectedPerson({
      ...p,
      isSupervisor: p.userId ? isSupervisor(p.userId) : false,
      supervisorTitle: p.userId && supervisorMap[p.userId]
        ? supervisorMap[p.userId].map(s => s.title || 'مشرف').join('، ')
        : undefined,
    });
  };

  const getDeptsByDirectorate = (directorateId: string) =>
    departments.filter(d => d.directorate_id === directorateId);

  const getUnassignedDepts = () =>
    departments.filter(d => !d.directorate_id);

  const getEmployeesByDept = (deptId: string) =>
    employees.filter(e => e.department_id === deptId);

  const getUnassignedEmployees = () =>
    employees.filter(e => !e.department_id);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 1.5));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  if (loading) {
    return <div className="flex items-center justify-center h-64">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">الهيكل التنظيمي</h1>
        <p className="text-gray-600 mt-2">عرض الهيكل التنظيمي للمنظمة وتوزيع الأدوار والمسؤوليات</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">مديري الإدارات</p>
              <p className="text-xl font-bold text-gray-900">{stats.directors}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">الأقسام</p>
              <p className="text-xl font-bold text-gray-900">{stats.departments}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">مدراء الأقسام</p>
              <p className="text-xl font-bold text-gray-900">{stats.managers}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">الموظفون</p>
              <p className="text-xl font-bold text-gray-900">{stats.employees}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <button onClick={handleZoomIn} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors" title="تكبير">
          <ZoomIn className="h-4 w-4 text-gray-600" />
        </button>
        <button onClick={handleZoomOut} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors" title="تصغير">
          <ZoomOut className="h-4 w-4 text-gray-600" />
        </button>
        <button onClick={handleZoomReset} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors" title="إعادة ضبط">
          <Maximize2 className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-xs text-gray-500 mr-2">{Math.round(zoom * 100)}%</span>
        <div className="mr-auto flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500" /> إدارة عليا</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-500" /> مديري إدارات</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500" /> مدراء أقسام</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500" /> موظفون</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-500" /><Shield className="h-3 w-3 text-orange-500" /> مشرف</span>
        </div>
      </div>

      {/* Tree */}
      <Card>
        <CardBody className="p-0 overflow-auto">
          <div
            ref={containerRef}
            className="p-8 min-w-[600px]"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top right' }}
          >
            {/* CEO */}
            {ceoUser && (
              <div className="flex flex-col items-center">
                <PersonNode
                  name={ceoUser.full_name}
                  role="ceo"
                  jobTitle={ceoUser.job_title}
                  isSupervisor={isSupervisor(ceoUser.id)}
                  onClick={() => handlePersonClick({
                    name: ceoUser.full_name,
                    email: ceoUser.email,
                    role: 'ceo',
                    jobTitle: ceoUser.job_title,
                    phone: ceoUser.phone,
                    userId: ceoUser.id,
                  })}
                />
                {(directorates.length > 0 || getUnassignedDepts().length > 0) && <VerticalConnector />}
              </div>
            )}

            {/* Directorates Level */}
            {directorates.length > 0 && (
              <div className="mt-2 space-y-4">
                {directorates.map((dir) => {
                  const dirDepts = getDeptsByDirectorate(dir.id);
                  return (
                    <div key={dir.id} className="space-y-2">
                      <ExpandableGroup
                        title={dir.name}
                        icon={<Landmark className="h-5 w-5 text-purple-600" />}
                        count={dirDepts.length}
                        color="bg-purple-50 border border-purple-200 text-purple-800"
                        defaultExpanded={true}
                      >
                        {/* Director person */}
                        {dir.director && (
                          <div className="mb-3">
                            <PersonNode
                              name={dir.director.full_name}
                              role="director"
                              jobTitle={dir.director.job_title}
                              isSupervisor={isSupervisor(dir.director.id)}
                              onClick={() => handlePersonClick({
                                name: dir.director!.full_name,
                                email: dir.director!.email,
                                role: 'director',
                                jobTitle: dir.director!.job_title,
                                phone: dir.director!.phone,
                                directorate: dir.name,
                                reportsTo: ceoUser?.full_name,
                                userId: dir.director!.id,
                              })}
                            />
                          </div>
                        )}

                        {/* Departments in this directorate */}
                        {dirDepts.map((dept) => {
                          const deptEmployees = getEmployeesByDept(dept.id);
                          return (
                            <div key={dept.id} className="space-y-2">
                              <ExpandableGroup
                                title={dept.name}
                                icon={<Building2 className="h-4 w-4 text-blue-600" />}
                                count={deptEmployees.length}
                                color="bg-blue-50 border border-blue-200 text-blue-800"
                                defaultExpanded={false}
                              >
                                {/* Department Manager */}
                                {dept.manager && (
                                  <div className="mb-3">
                                    <PersonNode
                                      name={dept.manager.full_name}
                                      role="manager"
                                      jobTitle={dept.manager.job_title}
                                      isSupervisor={isSupervisor(dept.manager.id)}
                                      onClick={() => handlePersonClick({
                                        name: dept.manager!.full_name,
                                        email: dept.manager!.email,
                                        role: 'manager',
                                        jobTitle: dept.manager!.job_title,
                                        phone: dept.manager!.phone,
                                        department: dept.name,
                                        directorate: dir.name,
                                        reportsTo: dir.director?.full_name,
                                        userId: dept.manager!.id,
                                      })}
                                    />
                                  </div>
                                )}

                                {/* Employees */}
                                {deptEmployees.length === 0 ? (
                                  <p className="text-xs text-gray-400 py-2 pr-4">لا يوجد موظفون في هذا القسم</p>
                                ) : (
                                  <div className="space-y-2">
                                    {deptEmployees.map((emp) => (
                                      <PersonNode
                                        key={emp.id}
                                        name={emp.full_name}
                                        role="employee"
                                        jobTitle={emp.job_title}
                                        isSupervisor={emp.user_id ? isSupervisor(emp.user_id) : false}
                                        onClick={() => handlePersonClick({
                                          name: emp.full_name,
                                          email: emp.email,
                                          role: 'employee',
                                          jobTitle: emp.job_title,
                                          phone: emp.phone,
                                          department: dept.name,
                                          directorate: dir.name,
                                          employeeNumber: emp.employee_number,
                                          reportsTo: dept.manager?.full_name,
                                          userId: emp.user_id,
                                        })}
                                      />
                                    ))}
                                  </div>
                                )}
                              </ExpandableGroup>
                            </div>
                          );
                        })}

                        {dirDepts.length === 0 && (
                          <p className="text-xs text-gray-400 py-2 pr-4">لا توجد أقسام مرتبطة بهذه الإدارة</p>
                        )}
                      </ExpandableGroup>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unassigned Departments (not linked to any directorate) */}
            {getUnassignedDepts().length > 0 && (
              <div className="mt-4">
                <ExpandableGroup
                  title="أقسام غير مرتبطة بإدارة"
                  icon={<GripHorizontal className="h-5 w-5 text-gray-500" />}
                  count={getUnassignedDepts().length}
                  color="bg-gray-100 border border-gray-300 text-gray-700"
                  defaultExpanded={true}
                >
                  {getUnassignedDepts().map((dept) => {
                    const deptEmployees = getEmployeesByDept(dept.id);
                    return (
                      <div key={dept.id} className="space-y-2">
                        <ExpandableGroup
                          title={dept.name}
                          icon={<Building2 className="h-4 w-4 text-blue-600" />}
                          count={deptEmployees.length}
                          color="bg-blue-50 border border-blue-200 text-blue-800"
                          defaultExpanded={false}
                        >
                          {dept.manager && (
                            <div className="mb-3">
                              <PersonNode
                                name={dept.manager.full_name}
                                role="manager"
                                jobTitle={dept.manager.job_title}
                                isSupervisor={isSupervisor(dept.manager.id)}
                                onClick={() => handlePersonClick({
                                  name: dept.manager!.full_name,
                                  email: dept.manager!.email,
                                  role: 'manager',
                                  jobTitle: dept.manager!.job_title,
                                  phone: dept.manager!.phone,
                                  department: dept.name,
                                  reportsTo: undefined,
                                  userId: dept.manager!.id,
                                })}
                              />
                            </div>
                          )}
                          {deptEmployees.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2 pr-4">لا يوجد موظفون في هذا القسم</p>
                          ) : (
                            <div className="space-y-2">
                              {deptEmployees.map((emp) => (
                                <PersonNode
                                  key={emp.id}
                                  name={emp.full_name}
                                  role="employee"
                                  jobTitle={emp.job_title}
                                  isSupervisor={emp.user_id ? isSupervisor(emp.user_id) : false}
                                  onClick={() => handlePersonClick({
                                    name: emp.full_name,
                                    email: emp.email,
                                    role: 'employee',
                                    jobTitle: emp.job_title,
                                    phone: emp.phone,
                                    department: dept.name,
                                    employeeNumber: emp.employee_number,
                                    reportsTo: dept.manager?.full_name,
                                    userId: emp.user_id,
                                  })}
                                />
                              ))}
                            </div>
                          )}
                        </ExpandableGroup>
                      </div>
                    );
                  })}
                </ExpandableGroup>
              </div>
            )}

            {/* Unassigned Employees */}
            {getUnassignedEmployees().length > 0 && (
              <div className="mt-4">
                <ExpandableGroup
                  title="موظفون غير معينين لقسم"
                  icon={<Users className="h-5 w-5 text-gray-500" />}
                  count={getUnassignedEmployees().length}
                  color="bg-gray-100 border border-gray-300 text-gray-700"
                  defaultExpanded={false}
                >
                  <div className="space-y-2">
                    {getUnassignedEmployees().map((emp) => (
                      <PersonNode
                        key={emp.id}
                        name={emp.full_name}
                        role="employee"
                        jobTitle={emp.job_title}
                        isSupervisor={emp.user_id ? isSupervisor(emp.user_id) : false}
                        onClick={() => handlePersonClick({
                          name: emp.full_name,
                          email: emp.email,
                          role: 'employee',
                          jobTitle: emp.job_title,
                          phone: emp.phone,
                          employeeNumber: emp.employee_number,
                          userId: emp.user_id,
                        })}
                      />
                    ))}
                  </div>
                </ExpandableGroup>
              </div>
            )}

            {/* Empty state */}
            {!ceoUser && directorates.length === 0 && departments.length === 0 && employees.length === 0 && (
              <div className="text-center py-16">
                <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">لا توجد بيانات للهيكل التنظيمي حاليًا</p>
                <p className="text-gray-400 text-sm mt-2">قم بإضافة الإدارات والأقسام والموظفين لبناء الهيكل التنظيمي</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Detail Panel */}
      {selectedPerson && (
        <DetailPanel person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}
    </div>
  );
};
