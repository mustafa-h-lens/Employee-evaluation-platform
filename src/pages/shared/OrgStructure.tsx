import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
// ReactFlow and dagre removed — replaced with pure HTML/CSS org tree

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import {
  Users,
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
  Search,
  RefreshCw,
  Network,
  Building2,
  ChevronDown,
  Maximize2,
  Minimize2,
  Target,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Pencil,
  Plus,
  Trash2,
  ChevronUp,
  Check,
  Copy,
  Palette,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════ */

interface OrgUser {
  id: string; full_name: string; email: string; role: string;
  job_title?: string; phone?: string; status?: string;
}
interface Directorate {
  id: string; name: string; director_id: string | null; director?: OrgUser | null;
  secondary_director_id?: string | null; secondary_director?: OrgUser | null;
}
interface Employee {
  id: string; user_id: string; full_name: string; email: string;
  job_title: string; phone?: string; employee_number: string;
  department_id: string | null; directorate_id: string | null; manager_id: string | null;
}
interface Department {
  id: string; name: string; directorate_id: string; manager_id: string | null;
}
interface SupervisorAssignment {
  id: string; user_id: string; title: string; status: string;
  start_date: string; end_date: string; member_count: number;
}
interface SupervisedEmployee {
  employee_id: string; full_name: string; email: string;
  job_title: string; phone?: string; employee_number: string;
  department_id: string | null; user_id: string;
}
interface DirAssignmentInfo {
  directorate: string;
  jobTitle?: string;
}

interface SelectedPerson {
  name: string; email: string; role: string; jobTitle?: string; phone?: string;
  department?: string; directorate?: string; reportsTo?: string;
  employeeNumber?: string; isSupervisor?: boolean; supervisorTitle?: string;
  supervisorMemberCount?: number; teamSize?: number;
  dirAssignments?: DirAssignmentInfo[];
  avatarUrl?: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Role Config
   ═══════════════════════════════════════════════════════════════════════ */

const roleLabel = (r: string) =>
  ({ ceo: 'الإدارة العليا', director: 'مدير إدارة', employee: 'موظف', admin: 'الموارد البشرية' }[r] || r);

// Per-role palette for the profile modal. Values reference DS
// stat-card tokens so the header reads as a sophisticated dark gradient
// in dark mode and a soft pastel card in light mode. Employee + dept
// moved off emerald onto the calmer blue tone, since the bright green
// was clashing with the surrounding UI.
interface RoleColor {
  gradient: string;        // header background (CSS gradient via DS var)
  glow: string;            // halo color for the floating avatar shadow
  titleColor: string;      // person name color on the header
  subtitleColor: string;   // job-title color on the header
  closeBtnBg: string;      // close-button background fill
  closeBtnIcon: string;    // close-button icon color
}
const ROLE_COLORS: Record<string, RoleColor> = {
  ceo:        { gradient: 'var(--sc-amber-grad)',  glow: 'var(--sc-amber-glow)',  titleColor: 'var(--sc-amber-val)',  subtitleColor: 'var(--sc-amber-label)',  closeBtnBg: 'var(--sc-amber-icon-bg)',  closeBtnIcon: 'var(--sc-amber-icon-c)' },
  director:   { gradient: 'var(--sc-purple-grad)', glow: 'var(--sc-purple-glow)', titleColor: 'var(--sc-purple-val)', subtitleColor: 'var(--sc-purple-label)', closeBtnBg: 'var(--sc-purple-icon-bg)', closeBtnIcon: 'var(--sc-purple-icon-c)' },
  directorate:{ gradient: 'var(--sc-purple-grad)', glow: 'var(--sc-purple-glow)', titleColor: 'var(--sc-purple-val)', subtitleColor: 'var(--sc-purple-label)', closeBtnBg: 'var(--sc-purple-icon-bg)', closeBtnIcon: 'var(--sc-purple-icon-c)' },
  employee:   { gradient: 'var(--sc-blue-grad)',   glow: 'var(--sc-blue-glow)',   titleColor: 'var(--sc-blue-val)',   subtitleColor: 'var(--sc-blue-label)',   closeBtnBg: 'var(--sc-blue-icon-bg)',   closeBtnIcon: 'var(--sc-blue-icon-c)' },
  department: { gradient: 'var(--sc-blue-grad)',   glow: 'var(--sc-blue-glow)',   titleColor: 'var(--sc-blue-val)',   subtitleColor: 'var(--sc-blue-label)',   closeBtnBg: 'var(--sc-blue-icon-bg)',   closeBtnIcon: 'var(--sc-blue-icon-c)' },
  unassigned: { gradient: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-overlay))', glow: 'rgba(0,0,0,0.4)', titleColor: 'var(--text-primary)', subtitleColor: 'var(--text-secondary)', closeBtnBg: 'rgba(255,255,255,0.08)', closeBtnIcon: 'var(--text-secondary)' },
};
const getColor = (role: string) => ROLE_COLORS[role] || ROLE_COLORS.employee;

const RoleIcon: React.FC<{ role: string; className?: string }> = ({ role, className = 'h-4 w-4' }) => {
  switch (role) {
    case 'ceo': return <Crown className={className} />;
    case 'director': case 'directorate': return <Landmark className={className} />;
    default: return <User className={className} />;
  }
};

const initials = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? p[0][0] + p[p.length - 1][0] : p[0][0];
};

/* ═══════════════════════════════════════════════════════════════════════
   Detail Modal
   ═══════════════════════════════════════════════════════════════════════ */

const DetailModal: React.FC<{ person: SelectedPerson; onClose: () => void }> = ({ person, onClose }) => {
  const c = getColor(person.role);
  const isMultiDir = !!person.dirAssignments && person.dirAssignments.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/55 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease-out' }} />
      <div
        className="relative bg-ds-surface rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-ds-border-subtle"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'modalSlide 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* Header band — role-toned gradient via DS stat-card tokens
            (themes in light + dark, no harsh fixed colors). The avatar
            overlaps from below for a modern profile-card feel. */}
        <div
          className="relative px-6 pt-7 pb-20 overflow-hidden"
          style={{ background: c.gradient }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 55%)' }}
          />
          <button
            onClick={onClose}
            className="absolute top-4 left-4 rounded-xl p-2 backdrop-blur-sm transition-opacity hover:opacity-80 z-10"
            style={{ background: c.closeBtnBg, color: c.closeBtnIcon }}
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative text-center">
            <h3 className="text-2xl font-bold tracking-tight" style={{ color: c.titleColor }}>
              {person.name}
            </h3>
            <p className="text-sm mt-1.5 font-medium" style={{ color: c.subtitleColor }}>
              {person.jobTitle || roleLabel(person.role)}
            </p>
          </div>
        </div>

        {/* Floating avatar — overlaps the header band. The ring is a
            pure box-shadow outset (4px of `--bg-surface`) so the photo
            fills edge-to-edge with one clean rim of body color and a
            tinted halo from the role glow. */}
        <div className="relative -mt-14 flex justify-center px-6">
          <div
            className="rounded-full inline-block"
            style={{
              animation: 'avatarPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
              boxShadow: `0 0 0 4px var(--bg-surface), 0 14px 32px ${c.glow}`,
            }}
          >
            {/* !border-0 strips the UserAvatar's own 1px inline border so
                the photo fills edge-to-edge inside the shadow ring. */}
            <UserAvatar
              name={person.name}
              avatarUrl={person.avatarUrl}
              size="2xl"
              initialsLength={2}
              className="!border-0"
            />
          </div>
        </div>

        {/* Role / supervisor / team pills — DS-tokened so they theme */}
        <div className="flex items-center gap-2 mt-5 mb-6 flex-wrap justify-center px-6">
          <span className="text-xs font-semibold bg-ds-overlay text-ds-text px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-ds-border-subtle">
            <RoleIcon role={person.role} className="h-3.5 w-3.5" />
            {roleLabel(person.role)}
          </span>
          {person.isSupervisor && (
            <span className="text-xs font-semibold bg-ds-warning-bg text-ds-warning-text px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-ds-warning-border">
              <Shield className="h-3.5 w-3.5" />
              مشرف{person.supervisorMemberCount ? ` — ${person.supervisorMemberCount} عضو` : ''}
            </span>
          )}
          {person.teamSize !== undefined && person.teamSize > 0 && (
            <span className="text-xs font-semibold bg-ds-info-bg text-ds-info-text px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-ds-info-border">
              <Users className="h-3.5 w-3.5" />{person.teamSize} موظف
            </span>
          )}
        </div>

        {/* Info grid — lighter rows (no per-cell border), more vertical
            gap, smaller icon tiles. Email + phone now get a copy button
            (always visible, becomes prominent on hover). Long-value
            fields span both columns; the rest pair compactly. */}
        <div className="px-5 pb-6">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            <InfoCell icon={<Mail />} label="البريد الإلكتروني" value={person.email} fullWidth copyable />
            {person.phone && <InfoCell icon={<Phone />} label="الهاتف" value={person.phone} fullWidth copyable />}
            {person.employeeNumber && <InfoCell icon={<Hash />} label="الرقم الوظيفي" value={person.employeeNumber} />}
            {!isMultiDir && person.jobTitle && (
              <InfoCell icon={<Briefcase />} label="المسمى الوظيفي" value={person.jobTitle} />
            )}
            {isMultiDir ? (
              <div className="col-span-2 mt-1">
                <div className="flex items-center gap-2 px-3 mb-1.5">
                  <div className="h-px flex-1 bg-ds-border-subtle" />
                  <p className="text-[11px] text-ds-faint font-semibold">الإدارات والمسميات</p>
                  <div className="h-px flex-1 bg-ds-border-subtle" />
                </div>
                <div className="space-y-1.5">
                  {person.dirAssignments!.map((a, i) => (
                    <div key={i} className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                      <InfoCell icon={<Landmark />} label="الإدارة" value={a.directorate} />
                      {a.jobTitle ? (
                        <InfoCell icon={<Briefcase />} label="المسمى الوظيفي" value={a.jobTitle} />
                      ) : <div />}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              person.directorate && <InfoCell icon={<Landmark />} label="الإدارة" value={person.directorate} />
            )}
            {person.department && <InfoCell icon={<Building2 />} label="الوحدة" value={person.department} />}
            {person.reportsTo && <InfoCell icon={<UserCog />} label="المدير المباشر" value={person.reportsTo} fullWidth />}
            {person.supervisorTitle && <InfoCell icon={<Shield />} label="مهمة الإشراف" value={person.supervisorTitle} accent fullWidth />}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  fullWidth?: boolean;
  copyable?: boolean;
}> = ({ icon, label, value, accent, fullWidth, copyable }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => { /* ignore */ });
  };
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <div
        className={[
          'group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors',
          accent
            ? 'bg-ds-warning-bg'
            : 'hover:bg-ds-overlay/60',
        ].join(' ')}
      >
        <div
          className={[
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
            accent
              ? 'bg-ds-warning-bg text-ds-warning-text'
              : 'bg-ds-overlay text-ds-accent',
          ].join(' ')}
        >
          {React.cloneElement(icon as React.ReactElement, { className: 'h-4 w-4' })}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className={`text-[11px] font-medium ${accent ? 'text-ds-warning-text' : 'text-ds-faint'}`}>
            {label}
          </p>
          {/* No `dir="auto"` — keeping the paragraph in the parent's RTL
              direction makes the value right-aligned next to its label,
              even when the content is Latin/digits (still rendered LTR
              internally by Unicode bidi, but positioned at the start). */}
          <p
            className={`text-sm font-semibold leading-snug break-words ${accent ? 'text-ds-warning-text' : 'text-ds-text'}`}
          >
            {value}
          </p>
        </div>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className={[
              'flex-shrink-0 mt-1 p-1.5 rounded-lg transition-all',
              copied
                ? 'bg-ds-success-bg text-ds-success-text'
                : 'text-ds-faint hover:text-ds-text hover:bg-ds-overlay',
            ].join(' ')}
            aria-label={copied ? 'تم النسخ' : 'نسخ'}
            title={copied ? 'تم النسخ' : 'نسخ'}
          >
            {copied
              ? <Check className="h-3.5 w-3.5" />
              : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   OrgTree — Pure HTML/CSS Dark-Themed Org Chart
   ═══════════════════════════════════════════════════════════════════════ */

interface EmpDirAssignment {
  employee_id: string;
  directorate_id: string;
  department_id: string | null;
  job_title: string | null;
}

interface OrgTreeProps {
  ceoUsers: OrgUser[];
  directorates: Directorate[];
  departments: Department[];
  employees: Employee[];
  empDirAssignments: EmpDirAssignment[];
  supervisorMap: Record<string, SupervisorAssignment[]>;
  supervisedEmpsMap: Record<string, SupervisedEmployee[]>;
  expandedDirs: Set<string>;
  expandedDepts: Set<string>;
  expandedSupervisors: Set<string>;
  searchQuery: string;
  onClickPerson: (p: any) => void;
  onToggleDir: (id: string) => void;
  onToggleDept: (id: string) => void;
  onToggleSupervisor: (uid: string) => void;
  stats: { directors: number; employees: number; supervisors: number };
  zoom: number;
}

const OrgTree: React.FC<OrgTreeProps> = ({
  ceoUsers, directorates, departments, employees, empDirAssignments, supervisorMap, supervisedEmpsMap,
  expandedDirs, expandedDepts, expandedSupervisors, searchQuery,
  onClickPerson, onToggleDir, onToggleDept, onToggleSupervisor, stats, zoom,
}) => {
  const isSup = (uid: string) => !!supervisorMap[uid];

  // Build lookup maps from junction table
  const empIdsByDir = useMemo(() => {
    const map = new Map<string, Set<string>>();
    empDirAssignments.forEach(a => {
      if (!map.has(a.directorate_id)) map.set(a.directorate_id, new Set());
      map.get(a.directorate_id)!.add(a.employee_id);
    });
    employees.forEach(e => {
      if (e.directorate_id) {
        if (!map.has(e.directorate_id)) map.set(e.directorate_id, new Set());
        map.get(e.directorate_id)!.add(e.id);
      }
    });
    return map;
  }, [empDirAssignments, employees]);

  const empIdsByDept = useMemo(() => {
    const map = new Map<string, Set<string>>();
    empDirAssignments.forEach(a => {
      if (a.department_id) {
        if (!map.has(a.department_id)) map.set(a.department_id, new Set());
        map.get(a.department_id)!.add(a.employee_id);
      }
    });
    employees.forEach(e => {
      if (e.department_id) {
        if (!map.has(e.department_id)) map.set(e.department_id, new Set());
        map.get(e.department_id)!.add(e.id);
      }
    });
    return map;
  }, [empDirAssignments, employees]);

  const empLookup = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  // Per-directorate job title lookup: "empId:dirId" → job_title
  const empDirJobTitle = useMemo(() => {
    const map = new Map<string, string>();
    empDirAssignments.forEach(a => {
      if (a.job_title) map.set(`${a.employee_id}:${a.directorate_id}`, a.job_title);
    });
    return map;
  }, [empDirAssignments]);

  const empsByDir = (dId: string) => {
    const ids = empIdsByDir.get(dId);
    if (!ids) return [];
    return [...ids].map(id => empLookup.get(id)).filter(Boolean) as Employee[];
  };
  const deptsByDir = (dId: string) => departments.filter(d => d.directorate_id === dId);
  const empsByDept = (deptId: string) => {
    const ids = empIdsByDept.get(deptId);
    if (!ids) return [];
    return [...ids].map(id => empLookup.get(id)).filter(Boolean) as Employee[];
  };
  const empsNoDept = (dId: string) => {
    const dirEmps = empsByDir(dId);
    const dirDepts = deptsByDir(dId);
    const deptEmpIds = new Set<string>();
    const dirDeptIds = new Set(dirDepts.map(d => d.id));
    dirDepts.forEach(dept => {
      const ids = empIdsByDept.get(dept.id);
      if (ids) ids.forEach(id => deptEmpIds.add(id));
    });
    // Only exclude by legacy department_id if that department belongs to THIS directorate
    dirEmps.forEach(e => { if (e.department_id && dirDeptIds.has(e.department_id)) deptEmpIds.add(e.id); });
    empDirAssignments.forEach(a => {
      if (a.directorate_id === dId && a.department_id) deptEmpIds.add(a.employee_id);
    });
    return dirEmps.filter(e => !deptEmpIds.has(e.id));
  };
  const allAssignedIds = useMemo(() => {
    const set = new Set<string>();
    empDirAssignments.forEach(a => set.add(a.employee_id));
    employees.forEach(e => { if (e.directorate_id) set.add(e.id); });
    return set;
  }, [empDirAssignments, employees]);
  const unassignedEmps = employees.filter(e => !allAssignedIds.has(e.id));

  // Search filter
  const matchesSearch = (name: string, email?: string) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || (email && email.toLowerCase().includes(q));
  };

  // Reverse lookup: employee_id → supervisor's full_name
  const empSupervisorName = useMemo(() => {
    const map = new Map<string, string>();
    // supervisedEmpsMap: supervisorUserId → SupervisedEmployee[]
    // We need to find the supervisor's name from the employees list
    Object.entries(supervisedEmpsMap).forEach(([supervisorUserId, members]) => {
      const supervisorEmp = employees.find(e => e.user_id === supervisorUserId);
      if (supervisorEmp) {
        members.forEach(m => {
          map.set(m.employee_id, supervisorEmp.full_name);
        });
      }
    });
    return map;
  }, [supervisedEmpsMap, employees]);

  // Employee click handler
  const handleEmpClick = (emp: Employee, dirName?: string, deptName?: string) => {
    // Gather all directorate assignments for this employee
    const allAssignments: DirAssignmentInfo[] = [];
    empDirAssignments.forEach(a => {
      if (a.employee_id === emp.id) {
        const d = directorates.find(dir => dir.id === a.directorate_id);
        if (d) allAssignments.push({ directorate: d.name, jobTitle: a.job_title || undefined });
      }
    });
    // Fallback: if no assignments found, use the employee's direct directorate
    if (allAssignments.length === 0) {
      const dir = directorates.find(d => {
        const dirEmpIds = empIdsByDir.get(d.id);
        return dirEmpIds?.has(emp.id);
      });
      if (dir) allAssignments.push({ directorate: dir.name, jobTitle: emp.job_title || undefined });
    }

    const firstDir = directorates.find(d => {
      const dirEmpIds = empIdsByDir.get(d.id);
      return dirEmpIds?.has(emp.id);
    });
    // If employee has a supervisor, show supervisor as المدير المباشر; otherwise show directorate director(s)
    const supervisorName = empSupervisorName.get(emp.id);
    const reportsTo = supervisorName
      || (firstDir ? [firstDir.director?.full_name, firstDir.secondary_director?.full_name].filter(Boolean).join(' و ') : undefined);
    onClickPerson({
      name: emp.full_name, email: emp.email, role: 'employee',
      jobTitle: allAssignments.length === 1 ? (allAssignments[0].jobTitle || emp.job_title) : emp.job_title,
      phone: emp.phone,
      directorate: allAssignments.length === 1 ? allAssignments[0].directorate : undefined,
      department: deptName,
      employeeNumber: emp.employee_number,
      reportsTo,
      userId: emp.user_id,
      dirAssignments: allAssignments.length > 1 ? allAssignments : undefined,
    });
  };

  // Director click handler
  const handleDirClick = (dir: Directorate) => {
    const directors = [dir.director, dir.secondary_director].filter(Boolean) as OrgUser[];
    if (directors.length === 0) return;
    const dirEmps = empsByDir(dir.id);
    if (directors.length === 1) {
      const d = directors[0];
      onClickPerson({
        name: d.full_name, email: d.email, role: d.role || 'director',
        jobTitle: d.job_title, phone: d.phone,
        directorate: dir.name, reportsTo: ceoUsers.map(c => c.full_name).join(' و '),
        userId: d.id, teamSize: dirEmps.length,
      });
    } else {
      onClickPerson({
        name: directors.map(d => d.full_name).join(' و '),
        email: directors.map(d => d.email).filter(Boolean).join(' | '),
        role: directors.some(d => d.role === 'ceo') ? 'ceo' : 'director',
        jobTitle: directors.map(d => d.job_title).filter(Boolean).join(' | ') || undefined,
        phone: directors.map(d => d.phone).filter(Boolean).join(' | ') || undefined,
        directorate: dir.name, reportsTo: ceoUsers.map(c => c.full_name).join(' و '),
        userId: directors[0].id, teamSize: dirEmps.length,
      });
    }
  };

  // Get supervised employees for a user
  const supervisedEmps = (uid: string): SupervisedEmployee[] => supervisedEmpsMap[uid] || [];

  // Render an employee item (with supervisor expand support)
  const renderEmp = (emp: Employee, dirId?: string, dirName?: string, deptName?: string) => {
    if (!matchesSearch(emp.full_name, emp.email)) return null;
    const isSuper = emp.user_id ? isSup(emp.user_id) : false;
    const supExpanded = emp.user_id ? expandedSupervisors.has(emp.user_id) : false;
    const teamMembers = emp.user_id ? supervisedEmps(emp.user_id) : [];
    const hasTeam = isSuper && teamMembers.length > 0;
    // Use per-directorate job title if available, otherwise fall back to global
    const displayJobTitle = (dirId && empDirJobTitle.get(`${emp.id}:${dirId}`)) || emp.job_title;

    return (
      <div key={emp.id}>
        <div
          className="flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all hover:bg-ds-surface/5"
          onClick={() => handleEmpClick(emp, dirName, deptName)}
        >
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#2dd4bf' }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium text-sm truncate">{emp.full_name}</p>
              {isSuper && (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  <Shield className="h-2 w-2" />{teamMembers.length} مشرف
                </span>
              )}
            </div>
            <p className="text-xs truncate" style={{ color: '#64748b' }}>{displayJobTitle}</p>
          </div>
          {/* Expand/collapse arrow for supervisors */}
          {hasTeam && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSupervisor(emp.user_id); }}
              className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-ds-surface/10"
            >
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform"
                style={{ color: '#f97316', transform: supExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
            </button>
          )}
        </div>

        {/* Supervised team members */}
        {hasTeam && supExpanded && (
          <div className="mr-5 pr-3 mt-1 mb-2" style={{ borderRight: '2px solid rgba(249,115,22,0.3)' }}>
            {teamMembers.map(se => (
              <div
                key={se.employee_id}
                className="flex items-center gap-3 py-1.5 px-3 rounded-lg cursor-pointer transition-all hover:bg-ds-surface/5"
                onClick={() => onClickPerson({
                  name: se.full_name, email: se.email, role: 'employee',
                  jobTitle: se.job_title, phone: se.phone,
                  directorate: dirName, department: deptName,
                  employeeNumber: se.employee_number, userId: se.user_id,
                  reportsTo: emp.full_name,
                })}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#f97316' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium text-xs truncate">{se.full_name}</p>
                  <p className="text-[10px] truncate" style={{ color: '#64748b' }}>{se.job_title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Check if the tree has any data
  if (ceoUsers.length === 0 && directorates.length === 0 && employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}>
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: '#1e293b' }}>
          <Network className="h-12 w-12" style={{ color: '#334155' }} />
        </div>
        <p className="text-lg font-bold" style={{ color: '#94a3b8' }}>لا توجد بيانات للهيكل التنظيمي</p>
        <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>قم بإضافة الإدارات والموظفين</p>
      </div>
    );
  }

  return (
    <div
      className="org-tree-dark rounded-2xl overflow-x-auto overflow-y-auto p-8"
      style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)', minHeight: 450 }}
    >
      <div style={{ minWidth: 'fit-content', transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}>
      {/* Single unified column so CEO + directorates share the same center */}
      <div className="flex flex-col items-center">
      {/* CEO Section — الإدارة العليا box then individual CEO boxes below */}
      {ceoUsers.length > 0 && (
        <>
          {/* الإدارة العليا label box */}
          <div
            className="rounded-full px-10 py-3 text-center"
            style={{ background: 'rgba(45,212,191,0.08)', border: '1.5px solid #2dd4bf' }}
          >
            <p className="text-white font-bold text-lg">الإدارة العُليا</p>
          </div>

          {/* Vertical line down from label */}
          <div className="w-0.5 h-6" style={{ background: '#2dd4bf' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#2dd4bf' }} />

          {/* CEO person boxes with integrated horizontal bar */}
          <div className="relative flex items-start justify-center" style={{ gap: 48 }}>
            {/* Horizontal bar — spans from center of first CEO to center of last CEO */}
            {ceoUsers.length > 1 && (
              <div className="absolute h-0.5" style={{
                background: '#2dd4bf',
                top: 0,
                left: '50%',
                right: '50%',
                /* will be overridden by first/last child positions — use a simpler approach */
              }} />
            )}
            {ceoUsers.map((ceo, idx) => (
              <div key={ceo.id} className="flex flex-col items-center" style={{ minWidth: 180 }}>
                {/* Horizontal line segment above this CEO box */}
                {ceoUsers.length > 1 && (
                  <div className="flex h-0.5 self-stretch" style={{ marginLeft: -24, marginRight: -24 }}>
                    <div className="flex-1" style={{ background: idx === 0 ? 'transparent' : '#2dd4bf' }} />
                    <div className="flex-1" style={{ background: idx === ceoUsers.length - 1 ? 'transparent' : '#2dd4bf' }} />
                  </div>
                )}
                {/* Vertical line from horizontal bar */}
                {ceoUsers.length > 1 && <div className="w-0.5 h-5" style={{ background: '#2dd4bf' }} />}
                <div
                  className="rounded-full px-8 py-3 text-center cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-500/10"
                  style={{ background: 'rgba(45,212,191,0.08)', border: '1.5px solid #2dd4bf', minWidth: 180 }}
                  onClick={() => onClickPerson({
                    name: ceo.full_name, email: ceo.email, role: 'ceo',
                    jobTitle: ceo.job_title, phone: ceo.phone, userId: ceo.id,
                    teamSize: stats.directors + stats.employees,
                  })}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Crown className="h-4 w-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
                    <p className="text-white font-bold text-base">{ceo.full_name}</p>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{ceo.job_title || 'الإدارة العليا'}</p>
                </div>
                {/* Vertical line down from each CEO box */}
                {ceoUsers.length > 1 && <div className="w-0.5 h-5" style={{ background: '#2dd4bf' }} />}
                {/* Bottom horizontal segment merging into center */}
                {ceoUsers.length > 1 && (
                  <div className="flex h-0.5 self-stretch" style={{ marginLeft: -24, marginRight: -24 }}>
                    <div className="flex-1" style={{ background: idx === 0 ? 'transparent' : '#2dd4bf' }} />
                    <div className="flex-1" style={{ background: idx === ceoUsers.length - 1 ? 'transparent' : '#2dd4bf' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Vertical line down to directorates — no gap */}
          <div className="w-0.5 h-8" style={{ background: '#2dd4bf' }} />
        </>
      )}

      {/* Directorates */}
      {directorates.length > 0 && (
        <>
          {/* Directorates row — each column has a horizontal line segment + vertical drop */}
          <div className="flex items-start flex-nowrap" style={{ gap: 48, marginTop: -1 }}>
            {directorates.map((dir, idx) => {
              const dirEmps = empsByDir(dir.id);
              const dirDepts = deptsByDir(dir.id);
              const dirEmpsNoDept = empsNoDept(dir.id).sort((a, b) => {
                const aS = a.user_id ? (supervisorMap[a.user_id] ? 1 : 0) : 0;
                const bS = b.user_id ? (supervisorMap[b.user_id] ? 1 : 0) : 0;
                return bS - aS;
              });
              const expanded = expandedDirs.has(dir.id);
              const directorName = [dir.director?.full_name, dir.secondary_director?.full_name].filter(Boolean).join(' و ');
              const isFirst = idx === 0;
              const isLast = idx === directorates.length - 1;
              const multiDirs = directorates.length > 1;
              // Calculate min-width: if expanded and has departments, account for them
              const visibleDeptCount = expanded ? dirDepts.length + (dirEmpsNoDept.length > 0 && dirDepts.length > 0 ? 1 : 0) : 0;
              const colMinWidth = expanded && visibleDeptCount > 1 ? visibleDeptCount * 190 : 220;

              // If searching, check if any employee under this directorate matches
              const hasMatchingContent = !searchQuery || directorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dir.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                dirEmps.some(e => matchesSearch(e.full_name, e.email));

              if (searchQuery && !hasMatchingContent) return null;

              return (
                <div key={dir.id} className="flex flex-col items-center flex-shrink-0" style={{ minWidth: colMinWidth }}>
                  {/* Horizontal line segment for this column — extends into the 48px gap */}
                  {multiDirs && (
                    <div className="flex h-0.5" style={{ width: 'calc(100% + 48px)', marginLeft: -24, marginRight: -24 }}>
                      <div className="flex-1" style={{ background: isFirst ? 'transparent' : '#2dd4bf' }} />
                      <div className="flex-1" style={{ background: isLast ? 'transparent' : '#2dd4bf' }} />
                    </div>
                  )}
                  {/* Vertical line from horizontal bar */}
                  <div className="w-0.5 h-6" style={{ background: '#2dd4bf' }} />

                  {/* Directorate box — click box for details, click chevron to expand */}
                  <div
                    className="rounded-xl px-5 py-3 cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-500/10"
                    style={{ border: '1.5px solid #2dd4bf', background: 'rgba(45,212,191,0.05)', minWidth: 200 }}
                    onClick={() => handleDirClick(dir)}
                  >
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 flex-shrink-0" style={{ color: '#2dd4bf' }} />
                      <p className="text-white font-bold text-sm">{dir.name}</p>
                      <div className="flex-1" />
                      <button
                        className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-lg transition-colors hover:bg-ds-surface/10"
                        onClick={(e) => { e.stopPropagation(); onToggleDir(dir.id); }}
                      >
                        <span className="text-[10px] text-white font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center" style={{ background: '#2dd4bf' }}>
                          {dirEmps.length}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ color: '#2dd4bf', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                      </button>
                    </div>
                    {/* Director name inside the box */}
                    <div className="mt-1.5 text-center">
                      <p className="text-[10px]" style={{ color: '#94a3b8' }}>مدير الإدارة</p>
                      {directorName ? (
                        <p className="text-white font-semibold text-xs">{directorName}</p>
                      ) : (
                        <p className="text-xs italic" style={{ color: '#ef4444' }}>لا يوجد مدير</p>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expanded && (
                    <>
                      {/* Vertical line to content */}
                      <div className="w-0.5 h-4 mt-2" style={{ background: '#2dd4bf' }} />

                      {/* Departments side by side + employees without dept */}
                      {(dirDepts.length > 0 || dirEmpsNoDept.length > 0) && (
                        <div className="flex gap-4 items-start justify-center mt-1">
                          {/* Department columns */}
                          {dirDepts.map(dept => {
                            const deptEmps = empsByDept(dept.id).sort((a, b) => {
                              const aS = a.user_id ? (supervisorMap[a.user_id] ? 1 : 0) : 0;
                              const bS = b.user_id ? (supervisorMap[b.user_id] ? 1 : 0) : 0;
                              return bS - aS; // supervisors first
                            });

                            // Search filter for department
                            const deptHasMatch = !searchQuery ||
                              dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              deptEmps.some(e => matchesSearch(e.full_name, e.email));
                            if (searchQuery && !deptHasMatch) return null;

                            return (
                              <div key={dept.id} className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 170 }}>
                                {/* Department box */}
                                <div
                                  className="rounded-lg px-4 py-2 text-center w-full"
                                  style={{ border: '1px solid rgba(45,212,191,0.4)', background: 'rgba(45,212,191,0.05)' }}
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#5eead4' }} />
                                    <p className="font-medium text-xs" style={{ color: '#5eead4' }}>{dept.name}</p>
                                  </div>
                                </div>
                                {/* Employees listed vertically under this department */}
                                {deptEmps.length > 0 && (
                                  <div className="mt-2 w-full">
                                    {deptEmps.map(emp => renderEmp(emp, dir.id, dir.name, dept.name))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Employees without department as a column */}
                          {dirEmpsNoDept.length > 0 && (
                            <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: 170 }}>
                              {dirDepts.length > 0 && (
                                <div
                                  className="rounded-lg px-4 py-2 text-center w-full"
                                  style={{ border: '1px dashed rgba(100,116,139,0.4)' }}
                                >
                                  <p className="font-medium text-xs" style={{ color: '#94a3b8' }}>بدون قسم</p>
                                </div>
                              )}
                              <div className={`${dirDepts.length > 0 ? 'mt-2' : ''} w-full`}>
                                {dirEmpsNoDept.map(emp => renderEmp(emp, dir.id, dir.name))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Unassigned employees */}
          {unassignedEmps.length > 0 && (
            <div className="flex flex-col items-center mt-8">
              <div className="w-0.5 h-6" style={{ background: '#64748b' }} />
              <div
                className="rounded-xl px-6 py-3 text-center"
                style={{ border: '1.5px solid #64748b', background: 'rgba(100,116,139,0.05)', minWidth: 200 }}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" style={{ color: '#94a3b8' }} />
                  <p className="font-bold text-sm" style={{ color: '#94a3b8' }}>موظفون بدون إدارة ({unassignedEmps.length})</p>
                </div>
              </div>
              <div className="mt-2 w-full max-w-xs">
                {unassignedEmps.map(emp => {
                  if (!matchesSearch(emp.full_name, emp.email)) return null;
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all hover:bg-ds-surface/5"
                      onClick={() => onClickPerson({
                        name: emp.full_name, email: emp.email, role: 'employee',
                        jobTitle: emp.job_title, phone: emp.phone,
                        employeeNumber: emp.employee_number, userId: emp.user_id,
                      })}
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#94a3b8' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-sm truncate">{emp.full_name}</p>
                        <p className="text-xs truncate" style={{ color: '#64748b' }}>{emp.job_title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      </div>{/* close unified flex-col items-center */}
      </div>{/* close min-width fit-content wrapper */}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   Job Titles Tab Component
   ═══════════════════════════════════════════════════════════════════════ */

interface JobLadderPalette {
  dot: string; line: string; badgeBg: string; badgeText: string;
  hoverBg: string; gradFrom: string; gradTo: string; label: string;
}
const JOB_LADDER_PALETTES: Record<string, JobLadderPalette> = {
  teal:   { dot: '#2dd4bf', line: '#99f6e4', badgeBg: '#f0fdfa', badgeText: '#0f766e', hoverBg: 'rgba(20,184,166,0.06)', gradFrom: '#14b8a6', gradTo: '#0891b2', label: 'تركوازي' },
  purple: { dot: '#a78bfa', line: '#c4b5fd', badgeBg: '#f5f3ff', badgeText: '#6d28d9', hoverBg: 'rgba(139,92,246,0.06)', gradFrom: '#8b5cf6', gradTo: '#7c3aed', label: 'بنفسجي' },
  blue:   { dot: '#60a5fa', line: '#93c5fd', badgeBg: '#eff6ff', badgeText: '#1d4ed8', hoverBg: 'rgba(59,130,246,0.06)', gradFrom: '#3b82f6', gradTo: '#4f46e5', label: 'أزرق' },
  green:  { dot: '#34d399', line: '#6ee7b7', badgeBg: '#ecfdf5', badgeText: '#047857', hoverBg: 'rgba(16,185,129,0.06)', gradFrom: '#10b981', gradTo: '#059669', label: 'أخضر' },
  amber:  { dot: '#fbbf24', line: '#fcd34d', badgeBg: '#fffbeb', badgeText: '#b45309', hoverBg: 'rgba(245,158,11,0.06)', gradFrom: '#f59e0b', gradTo: '#ea580c', label: 'برتقالي' },
  rose:   { dot: '#fb7185', line: '#fda4af', badgeBg: '#fff1f2', badgeText: '#be123c', hoverBg: 'rgba(244,63,94,0.06)', gradFrom: '#f43f5e', gradTo: '#e11d48', label: 'وردي' },
  cyan:   { dot: '#22d3ee', line: '#67e8f9', badgeBg: '#ecfeff', badgeText: '#0e7490', hoverBg: 'rgba(6,182,212,0.06)', gradFrom: '#06b6d4', gradTo: '#0891b2', label: 'سماوي' },
  indigo: { dot: '#818cf8', line: '#a5b4fc', badgeBg: '#eef2ff', badgeText: '#4338ca', hoverBg: 'rgba(99,102,241,0.06)', gradFrom: '#6366f1', gradTo: '#4f46e5', label: 'نيلي' },
};
const getLadderPalette = (key: string): JobLadderPalette =>
  JOB_LADDER_PALETTES[key] || JOB_LADDER_PALETTES.teal;

interface LadderDept { id: string; name: string; palette: string; order: number; }
interface LadderTitle { id: string; department_id: string; title: string; order: number; }

const JobTitlesTab: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [depts, setDepts] = useState<LadderDept[]>([]);
  const [titles, setTitles] = useState<LadderTitle[]>([]);
  const [palettePickerFor, setPalettePickerFor] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: dd }, { data: tt }] = await Promise.all([
      supabase.from('job_ladder_departments').select('id, name, palette, order').order('order', { ascending: true }),
      supabase.from('job_ladder_titles').select('id, department_id, title, order').order('order', { ascending: true }),
    ]);
    setDepts((dd as LadderDept[] | null) || []);
    setTitles((tt as LadderTitle[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const titlesByDept = useMemo(() => {
    const map: Record<string, LadderTitle[]> = {};
    titles.forEach(t => { (map[t.department_id] ||= []).push(t); });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.order - b.order));
    return map;
  }, [titles]);

  const handleAddDept = async () => {
    const maxOrder = depts.length ? Math.max(...depts.map(d => d.order)) : 0;
    const { data, error } = await supabase
      .from('job_ladder_departments')
      .insert({ name: 'إدارة جديدة', palette: 'teal', order: maxOrder + 1 })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setDepts(prev => [...prev, data as LadderDept]);
    toast.success('تمت إضافة الإدارة');
  };

  const handleUpdateDept = async (id: string, patch: Partial<LadderDept>) => {
    setDepts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    const { error } = await supabase.from('job_ladder_departments').update(patch).eq('id', id);
    if (error) { toast.error(error.message); fetchAll(); }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm('سيتم حذف الإدارة وجميع مسمياتها. هل أنت متأكد؟')) return;
    const { error } = await supabase.from('job_ladder_departments').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setDepts(prev => prev.filter(d => d.id !== id));
    setTitles(prev => prev.filter(t => t.department_id !== id));
    toast.success('تم حذف الإدارة');
  };

  const handleMoveDept = async (id: string, dir: -1 | 1) => {
    const idx = depts.findIndex(d => d.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= depts.length) return;
    const a = depts[idx], b = depts[swapIdx];
    const newDepts = [...depts];
    newDepts[idx] = { ...a, order: b.order };
    newDepts[swapIdx] = { ...b, order: a.order };
    newDepts.sort((x, y) => x.order - y.order);
    setDepts(newDepts);
    await Promise.all([
      supabase.from('job_ladder_departments').update({ order: b.order }).eq('id', a.id),
      supabase.from('job_ladder_departments').update({ order: a.order }).eq('id', b.id),
    ]);
  };

  const handleAddTitle = async (deptId: string) => {
    const list = titlesByDept[deptId] || [];
    const maxOrder = list.length ? Math.max(...list.map(t => t.order)) : 0;
    const { data, error } = await supabase
      .from('job_ladder_titles')
      .insert({ department_id: deptId, title: 'مسمى جديد', order: maxOrder + 1 })
      .select().single();
    if (error) { toast.error(error.message); return; }
    setTitles(prev => [...prev, data as LadderTitle]);
  };

  const handleUpdateTitle = async (id: string, title: string) => {
    setTitles(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    const { error } = await supabase.from('job_ladder_titles').update({ title }).eq('id', id);
    if (error) { toast.error(error.message); fetchAll(); }
  };

  const handleDeleteTitle = async (id: string) => {
    const { error } = await supabase.from('job_ladder_titles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setTitles(prev => prev.filter(t => t.id !== id));
  };

  const handleMoveTitle = async (deptId: string, id: string, dir: -1 | 1) => {
    const list = (titlesByDept[deptId] || []).slice();
    const idx = list.findIndex(t => t.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx], b = list[swapIdx];
    setTitles(prev => prev.map(t =>
      t.id === a.id ? { ...t, order: b.order } :
      t.id === b.id ? { ...t, order: a.order } : t
    ));
    await Promise.all([
      supabase.from('job_ladder_titles').update({ order: b.order }).eq('id', a.id),
      supabase.from('job_ladder_titles').update({ order: a.order }).eq('id', b.id),
    ]);
  };

  if (loading) {
    return <div className="page-loading-placeholder" aria-hidden="true" />;
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl p-8 md:p-10" style={{ background: 'linear-gradient(to bottom left, #0f172a, #1e293b, #0f172a)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(20,184,166,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(56,189,248,0.3) 0%, transparent 50%)' }} />
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full blur-3xl" style={{ background: 'rgba(20,184,166,0.1)' }} />
        <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full blur-3xl" style={{ background: 'rgba(6,182,212,0.1)' }} />
        <div className="relative text-right">
          <p className="text-sm font-medium mb-2 tracking-wide" style={{ color: '#2dd4bf' }}>السلّم الوظيفي</p>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">المسميات الوظيفية</h2>
          <h3 className="text-2xl md:text-3xl font-bold" style={{ background: 'linear-gradient(to left, #5eead4, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>في الإدارات</h3>
          <p className="text-sm mt-4 max-w-md mr-0 ml-auto leading-relaxed" style={{ color: '#94a3b8' }}>
            اكتشف مسارك المهني وتعرّف على الفرص المتاحة في كل إدارة. كل خطوة تقرّبك من تحقيق طموحاتك.
          </p>
        </div>
        <div className="absolute left-8 top-1/2 -translate-y-1/2" style={{ opacity: 0.07 }}>
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#5eead4" strokeWidth="0.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        {isAdmin && (
          <div className="absolute top-4 left-4 flex gap-2">
            <button
              onClick={() => setEditMode(m => !m)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm ${
                editMode ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-ds-surface/10 text-white hover:bg-ds-surface/20 border border-white/20'
              }`}
            >
              {editMode ? <><Check className="h-4 w-4" />تم</> : <><Pencil className="h-4 w-4" />تعديل</>}
            </button>
          </div>
        )}
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {depts.map((dept, deptIdx) => {
          const c = getLadderPalette(dept.palette);
          const list = titlesByDept[dept.id] || [];
          return (
            <div
              key={dept.id}
              className="ladder-card group bg-ds-surface rounded-2xl border border-ds-border-subtle shadow-sm overflow-hidden flex flex-col"
              style={{
                animation: `cardFadeIn 0.5s ease-out ${deptIdx * 0.07}s both`,
              }}
            >
              <div className="p-4 relative overflow-hidden" style={{ background: `linear-gradient(to left, ${c.gradFrom}, ${c.gradTo})` }}>
                {editMode && (
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10">
                    <button
                      onClick={() => handleDeleteDept(dept.id)}
                      title="حذف الإدارة"
                      className="bg-ds-surface/20 hover:bg-red-500/80 text-white p-1.5 rounded-lg transition-colors backdrop-blur-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPalettePickerFor(palettePickerFor === dept.id ? null : dept.id)}
                        title="تغيير اللون"
                        className="bg-ds-surface/20 hover:bg-ds-surface/40 text-white p-1.5 rounded-lg transition-colors backdrop-blur-sm"
                      >
                        <Palette className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveDept(dept.id, -1)}
                        disabled={deptIdx === 0}
                        title="نقل لليمين"
                        className="bg-ds-surface/20 hover:bg-ds-surface/40 text-white p-1.5 rounded-lg transition-colors backdrop-blur-sm disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                      <button
                        onClick={() => handleMoveDept(dept.id, 1)}
                        disabled={deptIdx === depts.length - 1}
                        title="نقل لليسار"
                        className="bg-ds-surface/20 hover:bg-ds-surface/40 text-white p-1.5 rounded-lg transition-colors backdrop-blur-sm disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Landmark className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.8)' }} />
                  </div>
                  {editMode ? (
                    <input
                      type="text"
                      defaultValue={dept.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== dept.name) handleUpdateDept(dept.id, { name: v });
                      }}
                      className="w-full bg-ds-surface/10 border border-white/30 text-white font-bold text-sm text-center leading-relaxed rounded-lg px-2 py-1 backdrop-blur-sm placeholder-white/60 focus:bg-ds-surface/20 focus:border-white/60 focus:outline-none"
                    />
                  ) : (
                    <h3 className="text-white font-bold text-sm text-center leading-relaxed">{dept.name}</h3>
                  )}
                  <div className="flex justify-center mt-2">
                    <span className="backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      {list.length} مسمى وظيفي
                    </span>
                  </div>
                  {editMode && palettePickerFor === dept.id && (
                    <div className="mt-3 grid grid-cols-4 gap-1.5 p-2 bg-ds-surface/10 rounded-lg backdrop-blur-sm border border-white/20">
                      {Object.entries(JOB_LADDER_PALETTES).map(([key, p]) => (
                        <button
                          key={key}
                          onClick={() => { handleUpdateDept(dept.id, { palette: key }); setPalettePickerFor(null); }}
                          title={p.label}
                          className={`h-7 rounded-md ring-1 ring-white/40 hover:ring-white transition-all ${dept.palette === key ? 'ring-2 ring-white scale-105' : ''}`}
                          style={{ background: `linear-gradient(135deg, ${p.gradFrom}, ${p.gradTo})` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 flex-1">
                <div className="relative">
                  {list.map((titleRow, idx) => {
                    const isDir = idx === 0;
                    const isSup = titleRow.title === 'مشرف قسم';
                    const isLast = idx === list.length - 1;
                    return (
                      <div
                        key={titleRow.id}
                        className="relative flex items-start gap-3"
                        style={{
                          animation: `titleSlide 0.4s ease-out ${0.1 + idx * 0.04}s both`,
                        }}
                      >
                        {!isLast && (
                          // Gradient connector — dept color at the dot, fading
                          // toward subtle as it travels down to the next item.
                          // More visually interesting than a flat hex line.
                          <div
                            className="absolute right-[9px] top-5 bottom-0 w-[2px]"
                            style={{
                              background: `linear-gradient(to bottom, ${c.gradFrom}, ${c.line} 60%, transparent)`,
                              borderRadius: '1px',
                            }}
                          />
                        )}
                        <div className="relative z-10 flex-shrink-0 mt-1.5">
                          {isDir ? (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white" style={{ background: `linear-gradient(135deg, ${c.gradFrom}, ${c.gradTo})` }}>
                              <Crown className="h-2.5 w-2.5 text-white" />
                            </div>
                          ) : isSup ? (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white" style={{ background: `linear-gradient(135deg, ${c.gradFrom}, ${c.gradTo})`, opacity: 0.85 }}>
                              <Shield className="h-2.5 w-2.5 text-white" />
                            </div>
                          ) : (
                            // Regular titles — a soft gradient circle with a
                            // ring of body color and a tiny inner dot. More
                            // polished than the previous flat colored dot.
                            <div
                              className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, ${c.gradFrom}88, ${c.gradTo}55)`,
                              }}
                            >
                              <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: c.dot }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 pb-3 rounded-lg px-2 py-1.5 -my-0.5 transition-colors title-row" style={{ '--hover-bg': c.hoverBg } as React.CSSProperties}>
                          {editMode ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                defaultValue={titleRow.title}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== titleRow.title) handleUpdateTitle(titleRow.id, v);
                                }}
                                className={`flex-1 bg-ds-bg border border-ds-border rounded-md px-2 py-1 text-sm text-right ${isDir ? 'font-bold' : isSup ? 'font-semibold' : ''} focus:bg-ds-surface focus:border-blue-400 focus:outline-none`}
                              />
                              <button
                                onClick={() => handleMoveTitle(dept.id, titleRow.id, -1)}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 text-ds-faint"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleMoveTitle(dept.id, titleRow.id, 1)}
                                disabled={idx === list.length - 1}
                                className="p-1 rounded hover:bg-ds-overlay disabled:opacity-30 text-ds-faint"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTitle(titleRow.id)}
                                className="p-1 rounded hover:bg-ds-danger-bg text-ds-danger"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className={`text-sm text-right leading-relaxed ${isDir ? 'text-ds-text font-bold' : isSup ? 'text-ds-text font-semibold' : 'text-ds-text font-medium'}`}>
                                {titleRow.title}
                              </p>
                              {isDir && (
                                // Use the dept's dot color at low alpha
                                // for the bg + full alpha for text instead
                                // of the prior hardcoded pastel hex pair.
                                // That pair was tuned for light mode only
                                // and looked washed out against dark.
                                <span
                                  className="inline-block text-[9px] font-bold mt-0.5 px-2 py-0.5 rounded-full"
                                  style={{
                                    background: `${c.dot}22`,
                                    color: c.dot,
                                    boxShadow: `0 0 0 1px ${c.dot}55`,
                                  }}
                                >
                                  قائد الإدارة
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {editMode && (
                    <button
                      onClick={() => handleAddTitle(dept.id)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 border-2 border-dashed border-ds-border rounded-lg text-xs text-ds-faint hover:border-ds-info-border hover:text-blue-600 hover:bg-ds-info-bg transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة مسمى
                    </button>
                  )}
                </div>
              </div>

              {/* Dept-tinted footer strip — replaces the repetitive
                  "ارتقِ بمسيرتك المهنية" line with a meaningful chip that
                  shows how many growth levels exist in this department. */}
              <div
                className="px-4 py-2.5 border-t flex items-center justify-center gap-1.5 text-[10px] font-semibold"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: `linear-gradient(to left, ${c.gradFrom}10, ${c.gradTo}10)`,
                  color: c.dot,
                }}
              >
                <Target className="h-3 w-3" />
                <span>{list.length} {list.length === 1 ? 'مستوى' : 'مستويات'} للنمو</span>
              </div>
            </div>
          );
        })}

        {editMode && (
          <button
            onClick={handleAddDept}
            className="bg-ds-surface rounded-2xl border-2 border-dashed border-ds-border hover:border-blue-400 hover:bg-ds-info-bg transition-colors flex flex-col items-center justify-center min-h-[300px] gap-3 text-ds-faint hover:text-blue-600"
          >
            <div className="w-12 h-12 rounded-2xl bg-ds-overlay flex items-center justify-center">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium">إضافة إدارة جديدة</span>
          </button>
        )}
      </div>

      {/* Motivational Footer — uses the DS stat-card-green palette so it
          reads as a deep emerald card in dark mode and a soft mint card
          in light mode. Previously it was hardcoded teal hex codes that
          looked washed-out against the dark surface. */}
      <div
        className="relative overflow-hidden rounded-2xl border p-6"
        style={{ background: 'var(--sc-green-grad)', borderColor: 'var(--sc-green-border)' }}
      >
        <div
          className="absolute left-0 top-0 w-32 h-32 rounded-full blur-2xl pointer-events-none"
          style={{ background: 'var(--sc-green-glow)', opacity: 0.18 }}
        />
        <div className="relative flex items-center gap-4 justify-center flex-wrap">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, var(--sc-green-glow), var(--info))',
              boxShadow: '0 10px 15px -3px var(--sc-green-border)',
            }}
          >
            <Target className="h-5 w-5 text-white" />
          </div>
          <div className="text-right">
            <p className="text-sm font-bold" style={{ color: 'var(--sc-green-val)' }}>
              طموحك هو بداية رحلتك
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sc-green-label)' }}>
              كل مسمى وظيفي هو فرصة جديدة للنمو والتطور — ابدأ اليوم واصنع مستقبلك.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OrgStructure: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ceoUsers, setCeoUsers] = useState<OrgUser[]>([]);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empDirAssignments, setEmpDirAssignments] = useState<EmpDirAssignment[]>([]);
  const [supervisorMap, setSupervisorMap] = useState<Record<string, SupervisorAssignment[]>>({});
  const [supervisedEmpsMap, setSupervisedEmpsMap] = useState<Record<string, SupervisedEmployee[]>>({});
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'org' | 'titles'>('org');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ directors: 0, employees: 0, supervisors: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      chartContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // Use exact same FK join pattern as admin/Directorates.tsx (only full_name — proven to work)
      const [directoratesRes, departmentsRes, employeesRes, supervisorRes, empDirRes] = await Promise.all([
        supabase.from('directorates').select('id, name, director_id, secondary_director_id, director:users!directorates_director_id_fkey(full_name, email, job_title, role), secondary_director:users!directorates_secondary_director_id_fkey(full_name, email, job_title, role)'),
        supabase.from('departments').select('id, name, manager_id, directorate_id').eq('status', 'active'),
        supabase.from('employees').select('id, user_id, full_name, email, job_title, phone, employee_number, department_id, directorate_id, manager_id').eq('status', 'active'),
        supabase.from('supervisor_assignments').select('id, user_id, title, status, start_date, end_date').eq('status', 'active'),
        supabase.from('employee_directorates').select('employee_id, directorate_id, department_id, job_title'),
      ]);

      const depts = (departmentsRes.data || []) as Department[];
      setDepartments(depts);

      const dirData = (directoratesRes.data || []) as any[];
      const emps = (employeesRes.data || []) as Employee[];

      // Fetch CEO users first so we can tag directors who are CEOs
      const { data: ceoData } = await supabase
        .from('users')
        .select('id, full_name, email, role, job_title, avatar_url')
        .eq('role', 'ceo');
      const ceoUsers_ = (ceoData || []) as OrgUser[];
      const ceoIdSet = new Set(ceoUsers_.map(c => c.id));
      setCeoUsers(ceoUsers_);

      // Pull avatar URLs for every user once so the detail modal and any
      // future avatar usage in the tree can resolve by user_id without an
      // extra round-trip per click.
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, avatar_url');
      const avMap: Record<string, string | null> = {};
      (allUsers || []).forEach((u: any) => { avMap[u.id] = u.avatar_url || null; });
      setAvatarMap(avMap);

      // Build director OrgUser from FK join + director_id
      // Note: phone is NOT on the users table — it comes from employees enrichment below
      const buildDirectorUser = (id: string | null, joinData: any): OrgUser | null => {
        if (!id || !joinData?.full_name) return null;
        return {
          id,
          full_name: joinData.full_name,
          email: joinData.email || '',
          role: ceoIdSet.has(id) ? 'ceo' : (joinData.role || 'director'),
          job_title: joinData.job_title || undefined,
          phone: undefined,
        };
      };

      const dirs = dirData.map((d: any) => ({
        id: d.id,
        name: d.name,
        director_id: d.director_id,
        director: buildDirectorUser(d.director_id, d.director),
        secondary_director_id: d.secondary_director_id || null,
        secondary_director: buildDirectorUser(d.secondary_director_id, d.secondary_director),
      })) as Directorate[];

      // Enrich director data from employee records
      dirs.forEach(d => {
        [d.director, d.secondary_director].forEach((dir, i) => {
          if (dir) {
            const dirId = i === 0 ? d.director_id : d.secondary_director_id;
            const empRecord = emps.find(e => e.user_id === dirId);
            if (empRecord) {
              dir.email = empRecord.email;
              dir.job_title = empRecord.job_title;
              dir.phone = empRecord.phone;
            }
            // Also enrich from CEO user data
            const ceoRecord = ceoUsers_.find(c => c.id === dirId);
            if (ceoRecord && !dir.email) {
              dir.email = ceoRecord.email;
            }
          }
        });
      });

      setDirectorates(dirs);
      setEmployees(emps);
      setEmpDirAssignments((empDirRes.data || []) as EmpDirAssignment[]);
      setExpandedDirs(new Set(dirs.map(d => d.id)));
      setExpandedDepts(new Set(depts.map(d => d.id)));

      const sMap: Record<string, SupervisorAssignment[]> = {};
      const today = new Date().toISOString().split('T')[0];
      (supervisorRes.data || []).forEach((s: any) => {
        const startOk = !s.start_date || s.start_date <= today;
        const endOk = !s.end_date || s.end_date >= today;
        if (startOk && endOk) {
          if (!sMap[s.user_id]) sMap[s.user_id] = [];
          sMap[s.user_id].push({ ...s, member_count: 0 });
        }
      });

      if (Object.keys(sMap).length > 0) {
        const aIds = Object.values(sMap).flat().map(s => s.id);
        const { data: mData } = await supabase
          .from('supervisor_assignment_members')
          .select('assignment_id, employee_id')
          .in('assignment_id', aIds);
        if (mData) {
          const cnt: Record<string, number> = {};
          mData.forEach((m: any) => { cnt[m.assignment_id] = (cnt[m.assignment_id] || 0) + 1; });
          Object.values(sMap).forEach(arr => arr.forEach(a => { a.member_count = cnt[a.id] || 0; }));

          const assignToUser: Record<string, string> = {};
          Object.entries(sMap).forEach(([userId, assignments]) => {
            assignments.forEach(a => { assignToUser[a.id] = userId; });
          });
          const supEmpIds = [...new Set(mData.map((m: any) => m.employee_id))];
          const supEmpsMap: Record<string, SupervisedEmployee[]> = {};
          if (supEmpIds.length > 0) {
            const { data: supEmpData } = await supabase
              .from('employees')
              .select('id, user_id, full_name, email, job_title, phone, employee_number, department_id')
              .in('id', supEmpIds);
            const empLookup = new Map((supEmpData || []).map((e: any) => [e.id, e]));
            mData.forEach((m: any) => {
              const supervisorUserId = assignToUser[m.assignment_id];
              if (!supervisorUserId) return;
              const emp = empLookup.get(m.employee_id);
              if (!emp) return;
              if (!supEmpsMap[supervisorUserId]) supEmpsMap[supervisorUserId] = [];
              if (!supEmpsMap[supervisorUserId].find((e: SupervisedEmployee) => e.employee_id === emp.id)) {
                supEmpsMap[supervisorUserId].push({
                  employee_id: emp.id, full_name: emp.full_name, email: emp.email,
                  job_title: emp.job_title, phone: emp.phone, employee_number: emp.employee_number,
                  department_id: emp.department_id, user_id: emp.user_id,
                });
              }
            });
          }
          setSupervisedEmpsMap(supEmpsMap);
        }
      }
      setSupervisorMap(sMap);
      // Supervisors collapsed by default — user clicks the chevron to expand.
      setExpandedSupervisors(new Set());

      setStats({
        directors: dirs.filter(d => d.director).length,
        employees: (employeesRes.data || []).length,
        supervisors: Object.keys(sMap).length,
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClick = (p: any) => {
    const assignments = p.userId ? (supervisorMap[p.userId] || []) : [];
    const total = assignments.reduce((s: number, a: SupervisorAssignment) => s + a.member_count, 0);
    setSelectedPerson({
      ...p,
      isSupervisor: assignments.length > 0,
      supervisorTitle: assignments.length > 0 ? assignments.map((s: SupervisorAssignment) => s.title || 'مشرف').join('، ') : undefined,
      supervisorMemberCount: total || undefined,
      avatarUrl: p.userId ? (avatarMap[p.userId] || null) : null,
    });
  };

  const toggleDir = (id: string) => setExpandedDirs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDept = (id: string) => setExpandedDepts(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSupervisor = (uid: string) => setExpandedSupervisors(p => { const n = new Set(p); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });

  const expandAll = () => { setExpandedDirs(new Set(directorates.map(d => d.id))); setExpandedDepts(new Set(departments.map(d => d.id))); setExpandedSupervisors(new Set(Object.keys(supervisedEmpsMap))); };
  const collapseAll = () => { setExpandedDirs(new Set()); setExpandedDepts(new Set()); setExpandedSupervisors(new Set()); };

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes modalSlide {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes avatarPop {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cardFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes titleSlide {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .title-row:hover {
          background: var(--hover-bg);
        }
        .ladder-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -12px var(--shadow-glow, rgba(0,0,0,0.3));
        }
        .ladder-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
      `}</style>

      {/* Header */}
      <div
        className="rounded-ds-xl p-6 flex items-center justify-between flex-wrap gap-4"
        style={{
          background: 'var(--sc-blue-grad)',
          border: '1px solid var(--sc-blue-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: 'var(--sc-blue-icon-bg)',
              border: '1px solid var(--sc-blue-icon-b)',
              color: 'var(--sc-blue-icon-c)',
            }}
          >
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--sc-blue-val)' }}>الهيكل التنظيمي</h1>
            <p className="text-sm" style={{ color: 'var(--sc-blue-label)' }}>التسلسل الهرمي للمنظمة — اضغط على أي عنصر لعرض التفاصيل</p>
          </div>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-ds-surface border border-ds-border rounded-xl text-sm text-ds-muted hover:bg-ds-bg transition-all disabled:opacity-50 shadow-sm">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-ds-overlay p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('org')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'org'
              ? 'bg-ds-surface text-blue-600 shadow-sm'
              : 'text-ds-faint hover:text-ds-muted hover:bg-ds-bg'
          }`}
        >
          <span className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            الهيكل التنظيمي
          </span>
        </button>
        <button
          onClick={() => setActiveTab('titles')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'titles'
              ? 'bg-ds-surface text-blue-600 shadow-sm'
              : 'text-ds-faint hover:text-ds-muted hover:bg-ds-bg'
          }`}
        >
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            المسميات الوظيفية
          </span>
        </button>
      </div>

      {activeTab === 'org' && (<>
      {loading ? (
        <div className="page-loading-placeholder" aria-hidden="true" />
      ) : (<>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'مديري إدارات', v: stats.directors, icon: <Landmark className="h-5 w-5" />, bg: 'bg-ds-purple-bg text-ds-purple' },
          { l: 'موظفون', v: stats.employees, icon: <Users className="h-5 w-5" />, bg: 'bg-ds-success-bg text-ds-success' },
          { l: 'مشرفون', v: stats.supervisors, icon: <Shield className="h-5 w-5" />, bg: 'bg-ds-warning-bg text-ds-warning' },
        ].map(s => (
          <div key={s.l} className="bg-ds-surface rounded-xl border border-ds-border-subtle shadow-sm p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>{s.icon}</div>
            <div>
              <p className="text-[10px] text-ds-faint font-medium">{s.l}</p>
              <p className="text-xl font-bold text-ds-text">{s.v}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar — search hugs the RTL start (right), action group is
          pushed to the END (left) via justify-between. Falls back to a
          natural stack on narrow screens thanks to flex-wrap. Dividers
          themed with `bg-ds-border-subtle` so they don't disappear in
          dark mode (previously hardcoded `bg-gray-200`). */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-ds-surface rounded-xl border border-ds-border-subtle shadow-sm p-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ds-faint" />
          <input type="text" placeholder="بحث بالاسم أو البريد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-ds-border rounded-lg text-sm bg-ds-bg focus:bg-ds-surface focus:ring-2 focus:ring-ds-accent focus:border-ds-accent transition-all" />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={expandAll} className="text-xs text-blue-600 hover:text-ds-info-text font-medium px-2 py-1.5 hover:bg-ds-info-bg rounded-lg transition-colors">توسيع الكل</button>
          <button onClick={collapseAll} className="text-xs text-ds-faint hover:text-ds-muted font-medium px-2 py-1.5 hover:bg-ds-bg rounded-lg transition-colors">طي الكل</button>
          <div className="h-7 w-px bg-ds-border-subtle" />
          <button onClick={toggleFullscreen}
            className="text-xs text-ds-faint hover:text-ds-muted font-medium px-2 py-1.5 hover:bg-ds-bg rounded-lg transition-colors flex items-center gap-1.5"
            title={isFullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}>
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {isFullscreen ? 'تصغير' : 'ملء الشاشة'}
          </button>
          <div className="h-7 w-px bg-ds-border-subtle" />
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
              className="p-1.5 rounded-lg text-ds-faint hover:text-ds-muted hover:bg-ds-bg transition-colors" title="تصغير">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button onClick={() => setZoom(1)}
              className="text-xs text-ds-faint hover:text-ds-muted font-medium px-2 py-1 hover:bg-ds-bg rounded-lg transition-colors min-w-[3rem] text-center" title="إعادة تعيين">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="p-1.5 rounded-lg text-ds-faint hover:text-ds-muted hover:bg-ds-bg transition-colors" title="تكبير">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dark-themed Org Tree */}
      <div
        ref={chartContainerRef}
        className="rounded-2xl shadow-sm overflow-auto"
        style={{ minHeight: 450, height: isFullscreen ? '100vh' : 'auto' }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(z => Math.min(2, Math.max(0.3, z + (e.deltaY > 0 ? -0.05 : 0.05))));
          }
        }}
      >
        <OrgTree
          ceoUsers={ceoUsers}
          directorates={directorates}
          departments={departments}
          employees={employees}
          empDirAssignments={empDirAssignments}
          supervisorMap={supervisorMap}
          supervisedEmpsMap={supervisedEmpsMap}
          expandedDirs={expandedDirs}
          expandedDepts={expandedDepts}
          expandedSupervisors={expandedSupervisors}
          searchQuery={searchQuery}
          onClickPerson={handleClick}
          onToggleDir={toggleDir}
          onToggleDept={toggleDept}
          onToggleSupervisor={toggleSupervisor}
          stats={stats}
          zoom={zoom}
        />
      </div>

      {/* Modal */}
      {selectedPerson && <DetailModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
      </>)}
      </>)}

      {activeTab === 'titles' && <JobTitlesTab />}
    </div>
  );
};
