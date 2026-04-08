import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Position,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  Handle,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Target,
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
  secondary_director_id?: string | null; secondary_director?: OrgUser | null;
}
interface Employee {
  id: string; user_id: string; full_name: string; email: string;
  job_title: string; phone?: string; employee_number: string;
  department_id: string | null; directorate_id: string | null; manager_id: string | null;
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
  ({ ceo: 'الإدارة العليا', director: 'مدير إدارة', employee: 'موظف', admin: 'الموارد البشرية' }[r] || r);

const ROLE_COLORS: Record<string, { bg: string; border: string; gradient: string; text: string; badge: string; edge: string; glow: string; minimap: string }> = {
  ceo:        { bg: '#fffbeb', border: '#fbbf24', gradient: 'from-amber-500 to-orange-600', text: '#92400e', badge: 'bg-amber-500', edge: '#f59e0b', glow: 'rgba(245,158,11,0.4)', minimap: '#f59e0b' },
  director:   { bg: '#faf5ff', border: '#a78bfa', gradient: 'from-purple-500 to-violet-600', text: '#5b21b6', badge: 'bg-purple-500', edge: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', minimap: '#8b5cf6' },
  employee:   { bg: '#ecfdf5', border: '#34d399', gradient: 'from-emerald-500 to-teal-600', text: '#065f46', badge: 'bg-emerald-500', edge: '#10b981', glow: 'rgba(16,185,129,0.4)', minimap: '#10b981' },
  directorate:{ bg: '#faf5ff', border: '#a78bfa', gradient: 'from-purple-500 to-violet-600', text: '#5b21b6', badge: 'bg-purple-500', edge: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', minimap: '#8b5cf6' },
  unassigned: { bg: '#f9fafb', border: '#d1d5db', gradient: 'from-gray-400 to-gray-500', text: '#374151', badge: 'bg-gray-500', edge: '#9ca3af', glow: 'rgba(156,163,175,0.3)', minimap: '#9ca3af' },
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
   Layout Constants (declared early so node components can reference them)
   ═══════════════════════════════════════════════════════════════════════ */

const NODE_WIDTH_CEO = 200;
const NODE_HEIGHT_CEO = 180;
const NODE_WIDTH_DIR = 260;
const NODE_HEIGHT_DIR = 90;
const NODE_WIDTH_EMP = 180;
const NODE_HEIGHT_EMP = 160;
const NODE_WIDTH_GROUP = 220;
const NODE_HEIGHT_GROUP = 50;

/* ═══════════════════════════════════════════════════════════════════════
   Custom React Flow Node Components
   ═══════════════════════════════════════════════════════════════════════ */

const PersonNode = ({ data, id }: { data: any; id: string }) => {
  const c = getColor(data.role);
  const isHovered = data._hoveredNodeId === id;
  const isConnected = data._connectedNodeIds?.has(id);
  const isDimmed = data._hoveredNodeId && data._hoveredNodeId !== id && !isConnected;
  const w = data.role === 'ceo' ? NODE_WIDTH_CEO : NODE_WIDTH_EMP;

  return (
    <div style={{ width: w, position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ left: '50%', background: 'transparent', border: 'none', width: 0, height: 0 }} />
      <div
        onClick={data.onClick}
        onMouseEnter={() => data._onNodeHover?.(id)}
        onMouseLeave={() => data._onNodeHover?.(null)}
        className="cursor-pointer"
        style={{
          width: '100%',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHovered ? 'translateY(-4px) scale(1.03)' : 'translateY(0) scale(1)',
          opacity: isDimmed ? 0.35 : 1,
          filter: isHovered ? `drop-shadow(0 8px 24px ${c.glow})` : 'none',
        }}
      >
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{
            border: `2px solid ${isHovered ? c.edge : c.border}`,
            boxShadow: isHovered
              ? `0 12px 32px -4px ${c.glow}, 0 4px 12px -2px rgba(0,0,0,0.08)`
              : '0 2px 8px -1px rgba(0,0,0,0.08), 0 1px 3px -1px rgba(0,0,0,0.06)',
          }}
        >
          <div className={`h-1.5 bg-gradient-to-l ${c.gradient}`} style={{ transition: 'height 0.2s', height: isHovered ? 3 : 6 }} />
          <div className="px-3 pt-3 pb-2.5 flex flex-col items-center text-center">
            <div className="relative mb-2">
              <div
                className={`rounded-full bg-gradient-to-br ${c.gradient} flex items-center justify-center ring-2 ring-white`}
                style={{
                  width: data.role === 'ceo' ? 48 : 40,
                  height: data.role === 'ceo' ? 48 : 40,
                  boxShadow: isHovered ? `0 0 20px ${c.glow}` : '0 4px 12px rgba(0,0,0,0.15)',
                  transition: 'box-shadow 0.3s',
                }}
              >
                <span className="text-white font-bold" style={{ fontSize: data.role === 'ceo' ? 16 : 13 }}>{initials(data.name)}</span>
              </div>
              {data.isSupervisor && (
                <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center ring-2 ring-white shadow">
                  <Shield className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>
            <p className="text-[12px] font-bold text-gray-900 leading-tight truncate w-full">{data.name}</p>
            <p className="text-[10px] text-gray-500 truncate w-full mt-0.5">{data.jobTitle || roleLabel(data.role)}</p>
            <div className="flex items-center gap-1 mt-1.5 flex-wrap justify-center">
              <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold text-white ${c.badge} px-1.5 py-0.5 rounded-full`}>
                <RoleIcon role={data.role} className="h-2.5 w-2.5" />
                {roleLabel(data.role)}
              </span>
              {data.isSupervisor && (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded-full">
                  <Shield className="h-2.5 w-2.5" />مشرف
                </span>
              )}
            </div>
            {data.teamSize > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[9px] text-gray-400">
                <Users className="h-3 w-3" /><span>{data.teamSize} موظف</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ left: '50%', background: 'transparent', border: 'none', width: 0, height: 0 }} />
    </div>
  );
};

const DirectorateNodeComponent = ({ data, id }: { data: any; id: string }) => {
  const isHovered = data._hoveredNodeId === id;
  const isConnected = data._connectedNodeIds?.has(id);
  const isDimmed = data._hoveredNodeId && data._hoveredNodeId !== id && !isConnected;

  return (
    <div style={{ width: NODE_WIDTH_DIR, position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ left: '50%', background: 'transparent', border: 'none', width: 0, height: 0 }} />
      <div
        onClick={data.onShowDetails}
        onMouseEnter={() => data._onNodeHover?.(id)}
        onMouseLeave={() => data._onNodeHover?.(null)}
        className="cursor-pointer"
        style={{
          width: '100%',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHovered ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
          opacity: isDimmed ? 0.35 : 1,
          filter: isHovered ? 'drop-shadow(0 8px 20px rgba(139,92,246,0.3))' : 'none',
        }}
      >
        <div
          className="flex flex-col px-4 py-3 rounded-xl bg-purple-50 text-right"
          style={{
            border: `2px solid ${isHovered ? '#8b5cf6' : '#a78bfa'}`,
            boxShadow: isHovered
              ? '0 10px 28px -4px rgba(139,92,246,0.35), 0 4px 12px -2px rgba(0,0,0,0.06)'
              : '0 2px 8px -1px rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center justify-between w-full gap-1">
            <span
              onClick={(e) => { e.stopPropagation(); data.onToggle?.(); }}
              className="cursor-pointer hover:bg-purple-200 rounded-md p-0.5 transition-colors flex-shrink-0"
              style={{ transition: 'transform 0.2s', transform: data.expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            >
              <ChevronDown className="h-4 w-4 text-purple-400" />
            </span>
            <span className="text-[10px] text-white bg-purple-500 min-w-[22px] h-[22px] rounded-full flex items-center justify-center font-bold flex-shrink-0">{data.empCount}</span>
            <span className="font-bold text-sm text-purple-800 flex-1 text-center" style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{data.name}</span>
            <Landmark className="h-5 w-5 text-purple-600 flex-shrink-0" />
          </div>
          <div className="w-full border-t border-purple-200 my-1.5" />
          <div className="flex flex-col items-center w-full">
            {data.directorName ? (
              <>
                <span className="text-[11px] text-purple-600 font-semibold">{data.directorName}</span>
                {data.directorIsCeo && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full mt-1">
                    <Crown className="h-2.5 w-2.5" />
                    الإدارة العليا
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-red-400 italic">لا يوجد مدير</span>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ left: '50%', background: 'transparent', border: 'none', width: 0, height: 0 }} />
    </div>
  );
};

const GroupNodeComponent = ({ data, id }: { data: any; id: string }) => {
  const isHovered = data._hoveredNodeId === id;
  const isConnected = data._connectedNodeIds?.has(id);
  const isDimmed = data._hoveredNodeId && data._hoveredNodeId !== id && !isConnected;
  const isTopLabel = data.isTopLabel;

  return (
    <div style={{ width: NODE_WIDTH_GROUP, position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ left: '50%', background: 'transparent', border: 'none', width: 0, height: 0 }} />
      <div
        onMouseEnter={() => data._onNodeHover?.(id)}
        onMouseLeave={() => data._onNodeHover?.(null)}
        className="flex items-center justify-center gap-2.5"
        style={{
          width: '100%',
          padding: isTopLabel ? '12px 20px' : '10px 16px',
          borderRadius: isTopLabel ? 16 : 12,
          background: isTopLabel ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : '#f3f4f6',
          border: isTopLabel ? 'none' : '2px solid #d1d5db',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isDimmed ? 0.35 : 1,
          boxShadow: isTopLabel
            ? '0 8px 24px -4px rgba(245,158,11,0.4), 0 2px 8px -2px rgba(0,0,0,0.1)'
            : isHovered ? '0 8px 20px -4px rgba(0,0,0,0.12)' : '0 2px 8px -1px rgba(0,0,0,0.06)',
        }}
      >
        {isTopLabel ? <Crown className="h-5 w-5 text-white" /> : <Users className="h-4 w-4 text-gray-500" />}
        <span style={{
          fontSize: isTopLabel ? 14 : 12,
          fontWeight: 700,
          color: isTopLabel ? '#fff' : '#4b5563',
        }}>
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ left: '50%', background: 'transparent', border: 'none', width: 0, height: 0 }} />
    </div>
  );
};

const nodeTypes = {
  person: PersonNode,
  directorate: DirectorateNodeComponent,
  group: GroupNodeComponent,
};

/* ═══════════════════════════════════════════════════════════════════════
   Dagre Layout Engine
   ═══════════════════════════════════════════════════════════════════════ */

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 50, edgesep: 25, marginx: 50, marginy: 50 });

  nodes.forEach((node) => {
    let w = NODE_WIDTH_EMP;
    let h = NODE_HEIGHT_EMP;
    if (node.type === 'person' && node.data?.role === 'ceo') { w = NODE_WIDTH_CEO; h = NODE_HEIGHT_CEO; }
    else if (node.type === 'directorate') { w = NODE_WIDTH_DIR; h = NODE_HEIGHT_DIR; }
    else if (node.type === 'group') { w = NODE_WIDTH_GROUP; h = NODE_HEIGHT_GROUP; }
    g.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    let w = NODE_WIDTH_EMP;
    if (node.type === 'person' && node.data?.role === 'ceo') w = NODE_WIDTH_CEO;
    else if (node.type === 'directorate') w = NODE_WIDTH_DIR;
    else if (node.type === 'group') w = NODE_WIDTH_GROUP;

    let h = NODE_HEIGHT_EMP;
    if (node.type === 'person' && node.data?.role === 'ceo') h = NODE_HEIGHT_CEO;
    else if (node.type === 'directorate') h = NODE_HEIGHT_DIR;
    else if (node.type === 'group') h = NODE_HEIGHT_GROUP;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ═══════════════════════════════════════════════════════════════════════
   Connectivity helpers
   ═══════════════════════════════════════════════════════════════════════ */

function getConnectedNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const connected = new Set<string>();
  connected.add(nodeId);
  // Walk up and down the tree
  const queue = [nodeId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    connected.add(current);
    edges.forEach(e => {
      if (e.source === current && !visited.has(e.target)) { queue.push(e.target); }
      if (e.target === current && !visited.has(e.source)) { queue.push(e.source); }
    });
  }
  return connected;
}

function getDirectConnectedNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const connected = new Set<string>();
  connected.add(nodeId);
  edges.forEach(e => {
    if (e.source === nodeId) connected.add(e.target);
    if (e.target === nodeId) connected.add(e.source);
  });
  return connected;
}

/* ═══════════════════════════════════════════════════════════════════════
   Detail Modal
   ═══════════════════════════════════════════════════════════════════════ */

const DetailModal: React.FC<{ person: SelectedPerson; onClose: () => void }> = ({ person, onClose }) => {
  const c = getColor(person.role);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'modalSlide 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <div className={`relative bg-gradient-to-br ${c.gradient} px-6 pt-8 pb-12 overflow-hidden`}>
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white/10" />
          <button onClick={onClose} className="absolute top-4 left-4 text-white/80 hover:text-white bg-white/20 rounded-xl p-2 hover:bg-white/30 backdrop-blur-sm transition-colors">
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg mb-3"
              style={{ animation: 'avatarPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both' }}>
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
                  <Users className="h-3.5 w-3.5" />{person.teamSize} موظف
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-2.5 -mt-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2.5">
            <DetailRow icon={<Mail />} label="البريد الإلكتروني" value={person.email} />
            {person.phone && <DetailRow icon={<Phone />} label="الهاتف" value={person.phone} />}
            {person.employeeNumber && <DetailRow icon={<Hash />} label="الرقم الوظيفي" value={person.employeeNumber} />}
            {person.jobTitle && <DetailRow icon={<Briefcase />} label="المسمى الوظيفي" value={person.jobTitle} />}
            {person.directorate && <DetailRow icon={<Landmark />} label="الإدارة" value={person.directorate} />}
            {person.department && <DetailRow icon={<Building2 />} label="الوحدة" value={person.department} />}
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
   Flow Chart Inner Component (needs ReactFlowProvider parent)
   ═══════════════════════════════════════════════════════════════════════ */

interface FlowChartProps {
  ceoUsers: OrgUser[];
  directorates: Directorate[];
  employees: Employee[];
  supervisorMap: Record<string, SupervisorAssignment[]>;
  supervisedEmpsMap: Record<string, SupervisedEmployee[]>;
  expandedDirs: Set<string>;
  expandedSupervisors: Set<string>;
  searchQuery: string;
  onClickPerson: (p: any) => void;
  onToggleDir: (id: string) => void;
  onToggleSupervisor: (uid: string) => void;
  stats: { directors: number; employees: number; supervisors: number };
}

const FlowChart: React.FC<FlowChartProps> = ({
  ceoUsers, directorates, employees, supervisorMap, supervisedEmpsMap,
  expandedDirs, expandedSupervisors, searchQuery,
  onClickPerson, onToggleDir, onToggleSupervisor, stats,
}) => {
  const { fitView } = useReactFlow();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    hoveredRef.current = nodeId;
    setHoveredNodeId(nodeId);
  }, []);

  const isSup = (uid: string) => !!supervisorMap[uid];
  const supInfo = (uid: string) => supervisorMap[uid] || [];
  const supMembers = (uid: string) => supInfo(uid).reduce((s, a) => s + a.member_count, 0) || undefined;
  const empsByDir = (dId: string) => employees.filter(e => e.directorate_id === dId);
  const unassignedEmps = employees.filter(e => !e.directorate_id);
  const supervisedEmps = (uid: string) => supervisedEmpsMap[uid] || [];

  // Build nodes and edges from data
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const makeEdge = (source: string, target: string, color: string): Edge => ({
      id: `e-${source}-${target}`,
      source,
      target,
      type: 'smoothstep',
      style: { stroke: color, strokeWidth: 2 },
      animated: false,
    });

    // ── Level 1: CEO nodes at the top ──
    // Create all CEO person nodes
    ceoUsers.forEach(ceo => {
      nodes.push({
        id: `ceo-${ceo.id}`,
        type: 'person',
        position: { x: 0, y: 0 },
        data: {
          name: ceo.full_name, role: 'ceo', jobTitle: ceo.job_title,
          isSupervisor: isSup(ceo.id), teamSize: stats.directors + stats.employees,
          onClick: () => onClickPerson({
            name: ceo.full_name, email: ceo.email, role: 'ceo',
            jobTitle: ceo.job_title, phone: ceo.phone, userId: ceo.id,
            teamSize: stats.directors + stats.employees,
          }),
        },
      });
    });

    // If multiple CEOs, add a label node ABOVE them
    let lastCeoNodeId: string | null = null;
    if (ceoUsers.length > 1) {
      const topId = 'ceo-top';
      nodes.push({
        id: topId,
        type: 'group',
        position: { x: 0, y: 0 },
        data: { label: 'الإدارة العليا', isTopLabel: true },
      });
      // Top label → each CEO
      ceoUsers.forEach(ceo => {
        edges.push(makeEdge(topId, `ceo-${ceo.id}`, '#f59e0b'));
      });
      // Use first CEO as parent for directorates (dagre will keep them below CEO rank)
      lastCeoNodeId = `ceo-${ceoUsers[0].id}`;
    }

    // The node that connects down to directorates — use first CEO (all CEOs are same rank)
    const parentForDirs = ceoUsers.length === 1 ? `ceo-${ceoUsers[0].id}` : lastCeoNodeId;

    // Connect ALL CEOs to ALL directorates so dagre keeps directorates one rank below
    const ceoNodeIds = ceoUsers.map(c => `ceo-${c.id}`);

    // ── Level 2: Directorate nodes ──
    directorates.forEach(dir => {
      const nodeId = `dir-${dir.id}`;
      const dirEmps = empsByDir(dir.id);
      const expanded = expandedDirs.has(dir.id);

      nodes.push({
        id: nodeId,
        type: 'directorate',
        position: { x: 0, y: 0 },
        data: {
          name: dir.name,
          directorName: [dir.director?.full_name, dir.secondary_director?.full_name].filter(Boolean).join(' و ') || null,
          directorIsCeo: dir.director?.role === 'ceo' || dir.secondary_director?.role === 'ceo',
          empCount: dirEmps.length,
          expanded,
          onToggle: () => onToggleDir(dir.id),
          onShowDetails: (dir.director || dir.secondary_director) ? () => {
            const directors = [dir.director, dir.secondary_director].filter(Boolean) as OrgUser[];
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
          } : undefined,
        },
      });

      // Connect ALL CEOs to each directorate
      if (ceoNodeIds.length > 0) {
        ceoNodeIds.forEach(ceoNid => {
          edges.push(makeEdge(ceoNid, nodeId, '#8b5cf6'));
        });
      }

      // Employees under directorate
      if (expanded) {
        dirEmps.forEach(emp => {
          const empNodeId = `emp-${emp.id}`;
          nodes.push({
            id: empNodeId,
            type: 'person',
            position: { x: 0, y: 0 },
            data: {
              name: emp.full_name, role: 'employee', jobTitle: emp.job_title,
              isSupervisor: emp.user_id ? isSup(emp.user_id) : false,
              supCount: emp.user_id ? supMembers(emp.user_id) : undefined,
              onClick: () => onClickPerson({
                name: emp.full_name, email: emp.email, role: 'employee',
                jobTitle: emp.job_title, phone: emp.phone,
                directorate: dir.name, employeeNumber: emp.employee_number,
                reportsTo: [dir.director?.full_name, dir.secondary_director?.full_name].filter(Boolean).join(' و ') || undefined, userId: emp.user_id,
              }),
            },
          });
          edges.push(makeEdge(nodeId, empNodeId, '#10b981'));

          // Supervised employees
          if (emp.user_id && isSup(emp.user_id) && expandedSupervisors.has(emp.user_id)) {
            const supEmps = supervisedEmps(emp.user_id);
            supEmps.forEach(se => {
              const seNodeId = `sup-${se.employee_id}`;
              if (!nodes.find(n => n.id === seNodeId)) {
                nodes.push({
                  id: seNodeId,
                  type: 'person',
                  position: { x: 0, y: 0 },
                  data: {
                    name: se.full_name, role: 'employee', jobTitle: se.job_title,
                    isSupervisor: se.user_id ? isSup(se.user_id) : false,
                    onClick: () => onClickPerson({
                      name: se.full_name, email: se.email, role: 'employee',
                      jobTitle: se.job_title, phone: se.phone,
                      directorate: dir.name, employeeNumber: se.employee_number,
                      userId: se.user_id,
                    }),
                  },
                });
              }
              edges.push(makeEdge(empNodeId, seNodeId, '#f97316'));
            });
          }
        });

        // Director's supervised employees
        if (dir.director && isSup(dir.director.id) && expandedSupervisors.has(dir.director.id)) {
          const supEmps = supervisedEmps(dir.director.id);
          supEmps.forEach(se => {
            const seNodeId = `sup-dir-${se.employee_id}`;
            if (!nodes.find(n => n.id === seNodeId)) {
              nodes.push({
                id: seNodeId,
                type: 'person',
                position: { x: 0, y: 0 },
                data: {
                  name: se.full_name, role: 'employee', jobTitle: se.job_title,
                  isSupervisor: se.user_id ? isSup(se.user_id) : false,
                  onClick: () => onClickPerson({
                    name: se.full_name, email: se.email, role: 'employee',
                    jobTitle: se.job_title, phone: se.phone,
                    directorate: dir.name, employeeNumber: se.employee_number,
                    userId: se.user_id,
                  }),
                },
              });
            }
            edges.push(makeEdge(nodeId, seNodeId, '#f97316'));
          });
        }
      }
    });

    // Unassigned employees
    if (unassignedEmps.length > 0 && parentForDirs) {
      const groupId = 'unassigned-group';
      nodes.push({
        id: groupId,
        type: 'group',
        position: { x: 0, y: 0 },
        data: { label: `موظفون بدون إدارة (${unassignedEmps.length})` },
      });
      edges.push(makeEdge(parentForDirs, groupId, '#9ca3af'));

      unassignedEmps.forEach(emp => {
        const empNodeId = `unemp-${emp.id}`;
        nodes.push({
          id: empNodeId,
          type: 'person',
          position: { x: 0, y: 0 },
          data: {
            name: emp.full_name, role: 'employee', jobTitle: emp.job_title,
            isSupervisor: emp.user_id ? isSup(emp.user_id) : false,
            onClick: () => onClickPerson({
              name: emp.full_name, email: emp.email, role: 'employee',
              jobTitle: emp.job_title, phone: emp.phone,
              employeeNumber: emp.employee_number, userId: emp.user_id,
            }),
          },
        });
        edges.push(makeEdge(groupId, empNodeId, '#9ca3af'));
      });
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [ceoUsers, directorates, employees, supervisorMap, supervisedEmpsMap, expandedDirs, expandedSupervisors, stats]);

  // Apply dagre layout
  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (initialNodes.length === 0) return { layoutNodes: [], layoutEdges: [] };
    const { nodes: ln, edges: le } = getLayoutedElements(initialNodes, initialEdges);
    return { layoutNodes: ln, layoutEdges: le };
  }, [initialNodes, initialEdges]);

  // Compute connected set for hover highlighting
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    return getDirectConnectedNodeIds(hoveredNodeId, layoutEdges);
  }, [hoveredNodeId, layoutEdges]);

  // Inject hover state into node data
  const nodesWithHover = useMemo(() => {
    return layoutNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        _hoveredNodeId: hoveredNodeId,
        _connectedNodeIds: connectedNodeIds,
        _onNodeHover: handleNodeHover,
      },
    }));
  }, [layoutNodes, hoveredNodeId, connectedNodeIds, handleNodeHover]);

  // Highlight edges on hover
  const edgesWithHover = useMemo(() => {
    if (!hoveredNodeId) return layoutEdges;
    return layoutEdges.map(edge => {
      const isConnected = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
      return {
        ...edge,
        animated: isConnected,
        style: {
          ...edge.style,
          strokeWidth: isConnected ? 3 : 1.5,
          opacity: isConnected ? 1 : 0.2,
          stroke: isConnected ? edge.style?.stroke : '#d1d5db',
        },
      };
    });
  }, [layoutEdges, hoveredNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithHover);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesWithHover);

  // Update when layout or hover changes
  useEffect(() => {
    setNodes(nodesWithHover);
    setEdges(edgesWithHover);
  }, [nodesWithHover, edgesWithHover, setNodes, setEdges]);

  // Fit view after layout changes (not hover)
  const prevLayoutRef = useRef<string>('');
  useEffect(() => {
    const key = layoutNodes.map(n => n.id).join(',');
    if (key !== prevLayoutRef.current) {
      prevLayoutRef.current = key;
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
    }
  }, [layoutNodes, fitView]);

  // MiniMap node color
  const miniMapNodeColor = useCallback((node: Node) => {
    if (node.type === 'directorate') return '#8b5cf6';
    if (node.type === 'group') return '#9ca3af';
    const role = node.data?.role || 'employee';
    return ROLE_COLORS[role]?.minimap || '#10b981';
  }, []);

  if (initialNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <Network className="h-12 w-12 text-gray-300" />
        </div>
        <p className="text-gray-600 text-lg font-bold">لا توجد بيانات للهيكل التنظيمي</p>
        <p className="text-gray-400 text-sm mt-2">قم بإضافة الإدارات والموظفين</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2.5}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnDrag={true}
      zoomOnScroll={true}
      zoomOnPinch={true}
      panOnScroll={false}
      selectNodesOnDrag={false}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{
        type: 'smoothstep',
        style: { strokeWidth: 2 },
      }}
    >
      <Controls
        showInteractive={false}
        position="bottom-left"
        className="!bg-white !border !border-gray-200 !rounded-xl !shadow-lg"
      />
      <MiniMap
        nodeColor={miniMapNodeColor}
        nodeStrokeWidth={2}
        maskColor="rgba(0, 0, 0, 0.08)"
        className="!bg-white/90 !border !border-gray-200 !rounded-xl !shadow-lg"
        position="bottom-right"
        pannable
        zoomable
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
    </ReactFlow>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   Job Titles Tab Component
   ═══════════════════════════════════════════════════════════════════════ */

const JOB_TITLE_DEPARTMENTS = [
  {
    name: 'إدارة المشاريع',
    colors: { dot: '#2dd4bf', line: '#99f6e4', badgeBg: '#f0fdfa', badgeText: '#0f766e', hoverBg: 'rgba(20,184,166,0.06)', gradFrom: '#14b8a6', gradTo: '#0891b2' },
    titles: ['مدير إدارة المشاريع', 'مدير حساب', 'مدير مشروع أول', 'مدير مشروع', 'مساعد مدير مشروع'],
  },
  {
    name: 'إدارة المحتوى الإبداعي',
    colors: { dot: '#a78bfa', line: '#c4b5fd', badgeBg: '#f5f3ff', badgeText: '#6d28d9', hoverBg: 'rgba(139,92,246,0.06)', gradFrom: '#8b5cf6', gradTo: '#7c3aed' },
    titles: ['مدير إدارة المحتوى الإبداعي', 'مشرف قسم', 'كاتب محتوى إبداعي أول', 'كاتب محتوى إبداعي'],
  },
  {
    name: 'إدارة تطوير الأعمال',
    colors: { dot: '#60a5fa', line: '#93c5fd', badgeBg: '#eff6ff', badgeText: '#1d4ed8', hoverBg: 'rgba(59,130,246,0.06)', gradFrom: '#3b82f6', gradTo: '#4f46e5' },
    titles: ['مدير إدارة تطوير الأعمال', 'مشرف قسم', 'أخصائي أول تطوير أعمال', 'أخصائي أول تسويق', 'أخصائي أول مبيعات', 'أخصائي أول تواصل', 'أخصائي تطوير أعمال', 'أخصائي تسويق', 'أخصائي مبيعات', 'أخصائي تواصل داخلي'],
  },
  {
    name: 'إدارة المالية والشؤون الإدارية',
    colors: { dot: '#34d399', line: '#6ee7b7', badgeBg: '#ecfdf5', badgeText: '#047857', hoverBg: 'rgba(16,185,129,0.06)', gradFrom: '#10b981', gradTo: '#059669' },
    titles: ['مدير إدارة المالية والشؤون الإدارية', 'مشرف قسم', 'محاسب عام', 'محاسب', 'أخصائي موارد بشرية أول', 'أخصائي موارد بشرية', 'أخصائي لوجستي أول', 'أخصائي لوجستي'],
  },
  {
    name: 'إدارة الإنتاج',
    colors: { dot: '#fbbf24', line: '#fcd34d', badgeBg: '#fffbeb', badgeText: '#b45309', hoverBg: 'rgba(245,158,11,0.06)', gradFrom: '#f59e0b', gradTo: '#ea580c' },
    titles: ['مدير إدارة الإنتاج', 'مشرف قسم', 'مصور فيديو', 'مصور سينمائي', 'مصور فوتوغرافي', 'مصمم جرافيك أول', 'مصمم جرافيك', 'محرر فيديو أول', 'محرر فيديو', 'مصمم رسوم متحركة أول', 'مصمم رسوم متحركة', 'رسام أول', 'رسام'],
  },
];

const JobTitlesTab: React.FC = () => (
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
    </div>

    {/* Department Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
      {JOB_TITLE_DEPARTMENTS.map((dept) => {
        const c = dept.colors;
        return (
          <div
            key={dept.name}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col"
          >
            <div className="p-4 relative overflow-hidden" style={{ background: `linear-gradient(to left, ${c.gradFrom}, ${c.gradTo})` }}>
              <div className="relative">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Landmark className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.8)' }} />
                </div>
                <h3 className="text-white font-bold text-sm text-center leading-relaxed">{dept.name}</h3>
                <div className="flex justify-center mt-2">
                  <span className="backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    {dept.titles.length} مسمى وظيفي
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 flex-1">
              <div className="relative">
                {dept.titles.map((title, idx) => {
                  const isDir = idx === 0;
                  const isSup = title === 'مشرف قسم';
                  const isLast = idx === dept.titles.length - 1;
                  return (
                    <div key={idx} className="relative flex items-start gap-3">
                      {!isLast && (
                        <div className="absolute right-[9px] top-5 bottom-0 w-[2px]" style={{ background: c.line, borderRadius: '1px' }} />
                      )}
                      <div className="relative z-10 flex-shrink-0 mt-1.5">
                        {isDir ? (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white" style={{ background: `linear-gradient(135deg, ${c.gradFrom}, ${c.gradTo})` }}>
                            <Crown className="h-2.5 w-2.5 text-white" />
                          </div>
                        ) : isSup ? (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white" style={{ background: `linear-gradient(135deg, ${c.gradFrom}, ${c.gradTo})`, opacity: 0.8 }}>
                            <Shield className="h-2.5 w-2.5 text-white" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center" style={{ background: c.dot, boxShadow: `0 0 0 1px ${c.line}` }}>
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 pb-3 rounded-lg px-2 py-1.5 -my-0.5 transition-colors cursor-default title-row" style={{ '--hover-bg': c.hoverBg } as React.CSSProperties}>
                        <p className={`text-sm font-medium text-right leading-relaxed ${isDir ? 'text-gray-900 font-bold' : isSup ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>
                          {title}
                        </p>
                        {isDir && (
                          <span className="inline-block text-[9px] font-bold mt-0.5 px-2 py-0.5 rounded-full" style={{ background: c.badgeBg, color: c.badgeText, boxShadow: `0 0 0 1px ${c.line}` }}>
                            قائد الإدارة
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-50" style={{ background: 'rgba(249,250,251,0.5)' }}>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
                <Target className="h-3 w-3" />
                <span>ارتقِ بمسيرتك المهنية</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Motivational Footer */}
    <div className="relative overflow-hidden rounded-2xl border p-6" style={{ background: 'linear-gradient(to left, #f0fdfa, #ecfeff)', borderColor: '#99f6e4' }}>
      <div className="absolute left-0 top-0 w-32 h-32 rounded-full blur-2xl" style={{ background: 'rgba(153,246,228,0.2)' }} />
      <div className="relative flex items-center gap-4 justify-center flex-wrap">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #14b8a6, #0891b2)', boxShadow: '0 10px 15px -3px rgba(20,184,166,0.3)' }}>
          <Target className="h-5 w-5 text-white" />
        </div>
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: '#134e4a' }}>طموحك هو بداية رحلتك</p>
          <p className="text-xs mt-0.5" style={{ color: '#0d9488' }}>كل مسمى وظيفي هو فرصة جديدة للنمو والتطور — ابدأ اليوم واصنع مستقبلك.</p>
        </div>
      </div>
    </div>
  </div>
);

export const OrgStructure: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ceoUsers, setCeoUsers] = useState<OrgUser[]>([]);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supervisorMap, setSupervisorMap] = useState<Record<string, SupervisorAssignment[]>>({});
  const [supervisedEmpsMap, setSupervisedEmpsMap] = useState<Record<string, SupervisedEmployee[]>>({});
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'org' | 'titles'>('org');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ directors: 0, employees: 0, supervisors: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
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
      const [directoratesRes, , employeesRes, supervisorRes] = await Promise.all([
        supabase.from('directorates').select('id, name, director_id, secondary_director_id, director:users!directorates_director_id_fkey(full_name), secondary_director:users!directorates_secondary_director_id_fkey(full_name)'),
        supabase.from('departments').select('id, name, manager_id, directorate_id').eq('status', 'active'),
        supabase.from('employees').select('id, user_id, full_name, email, job_title, phone, employee_number, department_id, directorate_id, manager_id').eq('status', 'active'),
        supabase.from('supervisor_assignments').select('id, user_id, title, status, start_date, end_date').eq('status', 'active'),
      ]);

      const dirData = (directoratesRes.data || []) as any[];
      const emps = (employeesRes.data || []) as Employee[];

      // Fetch CEO users first so we can tag directors who are CEOs
      const { data: ceoData } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('role', 'ceo');
      const ceoUsers_ = (ceoData || []) as OrgUser[];
      const ceoIdSet = new Set(ceoUsers_.map(c => c.id));
      setCeoUsers(ceoUsers_);

      // Build director OrgUser from FK join (full_name) + director_id
      const buildDirectorUser = (id: string | null, joinData: any): OrgUser | null => {
        if (!id || !joinData?.full_name) return null;
        return { id, full_name: joinData.full_name, email: '', role: ceoIdSet.has(id) ? 'ceo' : 'director' };
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
      setExpandedDirs(new Set(dirs.map(d => d.id)));

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
      setExpandedSupervisors(new Set(Object.keys(sMap)));

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
    });
  };

  const toggleDir = (id: string) => setExpandedDirs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSupervisor = (uid: string) => setExpandedSupervisors(p => { const n = new Set(p); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });

  const expandAll = () => { setExpandedDirs(new Set(directorates.map(d => d.id))); setExpandedSupervisors(new Set(Object.keys(supervisedEmpsMap))); };
  const collapseAll = () => { setExpandedDirs(new Set()); setExpandedSupervisors(new Set()); };

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
        .react-flow__controls button {
          border-radius: 8px !important;
          border: 1px solid #e5e7eb !important;
          background: white !important;
          width: 32px !important;
          height: 32px !important;
        }
        .react-flow__controls button:hover {
          background: #f3f4f6 !important;
        }
        .react-flow__controls {
          gap: 4px !important;
        }
        .react-flow__minimap {
          border-radius: 12px !important;
          overflow: hidden !important;
        }
        .react-flow__edge path {
          transition: stroke-width 0.25s ease, opacity 0.25s ease, stroke 0.25s ease;
        }
        .react-flow__node {
          transition: none !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        /* Animated edge dash effect */
        .react-flow__edge.animated path {
          stroke-dasharray: 8;
          animation: edgeDash 0.6s linear infinite;
        }
        @keyframes edgeDash {
          to { stroke-dashoffset: -16; }
        }
        .title-row:hover {
          background: var(--hover-bg);
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <Network className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الهيكل التنظيمي</h1>
            <p className="text-gray-500 text-sm">التسلسل الهرمي للمنظمة — اضغط على أي عنصر لعرض التفاصيل</p>
          </div>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('org')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'org'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-100 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">جاري تحميل الهيكل التنظيمي...</p>
        </div>
      ) : (<>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'مديري إدارات', v: stats.directors, icon: <Landmark className="h-5 w-5" />, bg: 'bg-purple-50 text-purple-600' },
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

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="بحث بالاسم أو البريد..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
        </div>
        <div className="h-7 w-px bg-gray-200" />
        <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1.5 hover:bg-blue-50 rounded-lg transition-colors">توسيع الكل</button>
        <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors">طي الكل</button>
        <div className="h-7 w-px bg-gray-200" />
        <button onClick={toggleFullscreen}
          className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-1.5"
          title={isFullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}>
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFullscreen ? 'تصغير' : 'ملء الشاشة'}
        </button>
        <div className="h-7 w-px bg-gray-200" />
        <div className="flex items-center gap-3 text-[10px] text-gray-500 mr-auto flex-wrap">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />إدارة عليا</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" />مديري إدارات</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />موظفون</span>
          <span className="flex items-center gap-1">
            <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <Shield className="h-2 w-2 text-white" />
            </div>مشرف
          </span>
        </div>
      </div>

      {/* Interactive help hint */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400 px-1 flex-wrap">
        <span className="flex items-center gap-1">🖱️ اسحب للتنقل</span>
        <span className="flex items-center gap-1">🔍 مرر للتكبير/التصغير</span>
        <span className="flex items-center gap-1">👆 اضغط على الإدارة للتوسيع/الطي</span>
        <span className="flex items-center gap-1">📋 اضغط على أي شخص لعرض التفاصيل</span>
      </div>

      {/* SVG Tree Chart */}
      <div
        ref={chartContainerRef}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 380px)', minHeight: 450 }}
      >
        <ReactFlowProvider>
          <FlowChart
            ceoUsers={ceoUsers}
            directorates={directorates}
            employees={employees}
            supervisorMap={supervisorMap}
            supervisedEmpsMap={supervisedEmpsMap}
            expandedDirs={expandedDirs}
            expandedSupervisors={expandedSupervisors}
            searchQuery={searchQuery}
            onClickPerson={handleClick}
            onToggleDir={toggleDir}
            onToggleSupervisor={toggleSupervisor}
            stats={stats}
          />
        </ReactFlowProvider>
      </div>

      {/* Modal */}
      {selectedPerson && <DetailModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
      </>)}
      </>)}

      {activeTab === 'titles' && <JobTitlesTab />}
    </div>
  );
};
