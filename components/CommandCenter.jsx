'use client';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  Plus, Search, Sparkles, LayoutGrid, Calendar, Target, Focus,
  Clock, CheckCircle2, Trash2, X, Send, Loader2, Zap, AlertCircle,
  ArrowRight, Play, Pause, Coffee, ChevronRight, ChevronLeft,
  Briefcase, Users, Inbox, Flame, Brain, CloudLightning,
  Link as LinkIcon, FileText, Repeat, Ban, UserCheck,
  Lightbulb, Sunrise, BookOpen, ListChecks, Square, CheckSquare,
  Pencil, StickyNote, ArrowUpRight
} from 'lucide-react';
import { storage } from '../lib/storage';
import { callClaude } from '../lib/ai';

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════

const COLUMNS = [
  { id: 'inbox',       name: 'Inbox',        sub: 'Captura',    icon: Inbox },
  { id: 'hoy',         name: 'Hoy',          sub: 'Enfoque',    icon: Flame },
  { id: 'en_progreso', name: 'En Progreso',  sub: 'Deep work',  icon: Play },
  { id: 'revision',    name: 'En Revisión',  sub: 'Delegado',   icon: Clock },
  { id: 'hecho',       name: 'Hecho',        sub: 'Cerrado',    icon: CheckCircle2 },
];

const PRIORITIES = {
  q1: { label: 'Urgente + Importante', short: 'Q1', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  q2: { label: 'Importante',           short: 'Q2', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  q3: { label: 'Urgente',              short: 'Q3', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  q4: { label: 'Después',              short: 'Q4', color: '#71717A', bg: 'rgba(113,113,122,0.12)' },
};

const TEAM = ['Alejandro', 'Diego', 'Tania', 'Berenice', 'Emilse', 'Gaby'];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No recurrente' },
  { value: 'daily', label: 'Cada día' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'biweekly', label: 'Cada 2 semanas' },
  { value: 'monthly', label: 'Cada mes' },
];

const PROJECT_COLORS = [
  { name: 'Ámbar',     value: '#F59E0B' },
  { name: 'Naranja',   value: '#EA580C' },
  { name: 'Rojo',      value: '#EF4444' },
  { name: 'Rosa',      value: '#F472B6' },
  { name: 'Violeta',   value: '#A78BFA' },
  { name: 'Índigo',    value: '#818CF8' },
  { name: 'Cielo',     value: '#38BDF8' },
  { name: 'Cian',      value: '#06B6D4' },
  { name: 'Esmeralda', value: '#10B981' },
  { name: 'Lima',      value: '#84CC16' },
  { name: 'Amarillo',  value: '#EAB308' },
  { name: 'Gris',      value: '#A1A1AA' },
];

const FALLBACK_PROJECT = { name: '???', subtitle: 'eliminado', color: '#71717A' };

// ═══════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════

const ProjectsContext = createContext({});
const useProjects = () => useContext(ProjectsContext);
const getProject = (projects, id) => projects[id] || FALLBACK_PROJECT;

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════

export default function CommandCenter() {
  const [projects, setProjects] = useState({});
  const [projectMeta, setProjectMeta] = useState({});
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [view, setView] = useState('tablero');
  const [selectedProjectKey, setSelectedProjectKey] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [kanbanFilter, setKanbanFilter] = useState('ALL');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hola. Soy tu copiloto. Puedo crear tareas, priorizar tu día o generarte un resumen. Escríbeme en lenguaje natural.' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [focusTask, setFocusTask] = useState(null);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefContent, setBriefContent] = useState('');
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyContent, setWeeklyContent] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const tasksRef = useRef([]);
  const projectsRef = useRef({});
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // Load
  useEffect(() => {
    (async () => {
      try {
        const [t, p, pm, n] = await Promise.all([
          storage.get('cc_tasks'),
          storage.get('cc_projects'),
          storage.get('cc_project_meta'),
          storage.get('cc_notes'),
        ]);
        if (t?.value) {
          const parsed = JSON.parse(t.value);
          const migrated = parsed.map(task => ({
            description: '', subtasks: [], blocker: null, links: [],
            recurrence: 'none', notes: '', ...task
          }));
          setTasks(migrated);
        }
        if (p?.value) setProjects(JSON.parse(p.value));
        if (pm?.value) setProjectMeta(JSON.parse(pm.value));
        if (n?.value) setNotes(JSON.parse(n.value));
      } catch {}
      setLoaded(true);

      try {
        const last = await storage.get('cc_last_brief');
        const today = new Date().toISOString().slice(0, 10);
        if (!last?.value || last.value !== today) {
          setTimeout(() => {
            if (tasksRef.current.length > 0) generateBrief(true);
          }, 1200);
          await storage.set('cc_last_brief', today);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => { if (loaded) storage.set('cc_tasks', JSON.stringify(tasks)).catch(() => {}); }, [tasks, loaded]);
  useEffect(() => { if (loaded) storage.set('cc_projects', JSON.stringify(projects)).catch(() => {}); }, [projects, loaded]);
  useEffect(() => { if (loaded) storage.set('cc_project_meta', JSON.stringify(projectMeta)).catch(() => {}); }, [projectMeta, loaded]);
  useEffect(() => { if (loaded) storage.set('cc_notes', JSON.stringify(notes)).catch(() => {}); }, [notes, loaded]);

  useEffect(() => {
    if (!focusRunning) return;
    const i = setInterval(() => setFocusSeconds(s => s + 1), 1000);
    return () => clearInterval(i);
  }, [focusRunning]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedTaskId) setSelectedTaskId(null);
      else if (quickAddOpen) { setQuickAddOpen(false); setQuickAddPrefill(null); }
      else if (projectModalOpen) { setProjectModalOpen(false); setEditingProject(null); }
      else if (summaryOpen) setSummaryOpen(false);
      else if (briefOpen) setBriefOpen(false);
      else if (weeklyOpen) setWeeklyOpen(false);
      else if (copilotOpen) setCopilotOpen(false);
      else if (confirmDelete) setConfirmDelete(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedTaskId, quickAddOpen, projectModalOpen, summaryOpen, briefOpen, weeklyOpen, copilotOpen, confirmDelete]);

  const showToast = (msg) => setToast(msg);

  // ─────── Project ops ───────
  const createProject = ({ name, subtitle, color }) => {
    const id = 'p_' + Date.now() + Math.floor(Math.random() * 1000);
    const project = { id, name: name.trim(), subtitle: (subtitle || '').trim(), color, createdAt: Date.now() };
    setProjects(prev => ({ ...prev, [id]: project }));
    setProjectMeta(prev => ({ ...prev, [id]: { description: '', notes: '', links: [], decisions: [] } }));
    showToast('Proyecto creado');
    return project;
  };

  const updateProject = (id, patch) => {
    setProjects(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    showToast('Proyecto actualizado');
  };

  const deleteProject = (id) => {
    setTasks(prev => prev.filter(t => t.project !== id));
    setProjects(prev => { const { [id]: _, ...rest } = prev; return rest; });
    setProjectMeta(prev => { const { [id]: _, ...rest } = prev; return rest; });
    if (selectedProjectKey === id) { setSelectedProjectKey(null); setView('tablero'); }
    if (kanbanFilter === id) setKanbanFilter('ALL');
    showToast('Proyecto eliminado');
  };

  // ─────── Task ops ───────
  const addTask = (partial) => {
    const projectKeys = Object.keys(projectsRef.current);
    const defaultProject = partial.project || projectKeys[0];
    if (!defaultProject) { showToast('Crea un proyecto primero'); return null; }
    const newTask = {
      id: 't' + Date.now() + Math.floor(Math.random() * 1000),
      title: partial.title || 'Nueva tarea',
      project: defaultProject,
      column: partial.column || 'inbox',
      priority: partial.priority || 'q2',
      estimate: partial.estimate || 30,
      assignee: partial.assignee || 'Alejandro',
      time: partial.time || null,
      description: partial.description || '',
      subtasks: partial.subtasks || [],
      blocker: partial.blocker || null,
      links: partial.links || [],
      recurrence: partial.recurrence || 'none',
      notes: partial.notes || '',
    };
    setTasks(prev => [newTask, ...prev]);
    return newTask;
  };

  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTaskId === id) setSelectedTaskId(null);
  };

  const moveTask = (id, column) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;
    if (column === 'hecho' && task.recurrence && task.recurrence !== 'none') {
      const clone = {
        ...task,
        id: 't' + Date.now() + Math.floor(Math.random() * 1000),
        column: 'inbox',
        subtasks: task.subtasks.map(s => ({ ...s, done: false })),
      };
      setTasks(prev => [clone, ...prev.map(t => t.id === id ? { ...t, column } : t)]);
      showToast('Tarea recurrente recreada en Inbox');
    } else {
      updateTask(id, { column });
    }
  };

  const toggleSubtask = (taskId, subId) => setTasks(prev => prev.map(t => t.id === taskId ? {
    ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s)
  } : t));

  const addSubtask = (taskId, title) => {
    const newSub = { id: 's' + Date.now() + Math.floor(Math.random() * 1000), title, done: false };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, newSub] } : t));
  };

  const deleteSubtask = (taskId, subId) => setTasks(prev => prev.map(t => t.id === taskId ? {
    ...t, subtasks: t.subtasks.filter(s => s.id !== subId)
  } : t));

  const addLink = (taskId, link) => setTasks(prev => prev.map(t => t.id === taskId ? { ...t, links: [...t.links, link] } : t));
  const removeLink = (taskId, idx) => setTasks(prev => prev.map(t => t.id === taskId ? {
    ...t, links: t.links.filter((_, i) => i !== idx)
  } : t));

  // ─────── Notes ops ───────
  const addNote = ({ title, body }) => {
    const newNote = {
      id: 'n_' + Date.now() + Math.floor(Math.random() * 1000),
      title: (title || body.split('\n')[0].slice(0, 80)) || 'Nota sin título',
      body: body || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setNotes(prev => [newNote, ...prev]);
    return newNote;
  };

  const updateNote = (id, patch) => setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  const deleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));

  const convertNoteToTask = (note) => {
    if (Object.keys(projects).length === 0) {
      showToast('Crea un proyecto primero');
      return;
    }
    setQuickAddPrefill({
      title: note.title,
      description: note.body,
      _fromNoteId: note.id,
    });
    setQuickAddOpen(true);
  };

  // ─────── AI ───────
  const handleAISend = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiLoading(true);

    const projectList = Object.values(projectsRef.current).map(p => p.name).join(', ') || 'ninguno';
    const projectKeyList = Object.entries(projectsRef.current).map(([id, p]) => `${p.name}=${id}`).join(', ');
    const sys = `Eres el copiloto del founder. Proyectos actuales: ${projectList}. IDs: ${projectKeyList}. Equipo: ${TEAM.join(', ')}.

Responde SIEMPRE con JSON válido (sin backticks, sin markdown):
{ "intent": "create_task" | "chat",
  "tasks": [ { "title": "...", "project": "<project_id_exacto>", "column": "inbox|hoy|en_progreso|revision|hecho", "priority": "q1|q2|q3|q4", "estimate": 30, "assignee": "<nombre_del_equipo>", "time": "HH:MM", "description": "...", "recurrence": "none|daily|weekly|biweekly|monthly" } ],
  "message": "respuesta corta en español" }

Usa el project_id exacto (no el nombre). Si no hay proyectos, intent="chat" y sugiere crear uno. Eisenhower: q1=urgente+importante, q2=importante, q3=urgente, q4=ninguno.`;

    try {
      const raw = await callClaude(sys, userMsg);
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.intent === 'create_task' && Array.isArray(parsed.tasks)) {
        let created = 0;
        parsed.tasks.forEach(t => { if (addTask(t)) created++; });
        if (created > 0) showToast(`${created} tarea(s) creada(s)`);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: parsed.message || 'Listo.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No pude procesar eso. Intenta de nuevo.' }]);
    }
    setAiLoading(false);
  };

  const prioritizeDay = async () => {
    setAiLoading(true);
    setCopilotOpen(true);
    setMessages(prev => [...prev, { role: 'user', content: '🧭 Prioriza mi día' }]);
    const todayTasks = tasksRef.current.filter(t => t.column === 'hoy' || t.column === 'inbox');
    if (todayTasks.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No tienes tareas en Hoy o Inbox. Agrega tareas primero.' }]);
      setAiLoading(false);
      return;
    }
    const sys = `Coach de productividad. Tareas bloqueadas NO avanzan hasta desbloquear.
JSON solo: { "order": ["task_id"], "rationale": "breve", "morning_block": "qué 9-11am" }`;
    const userPrompt = `Tareas:\n${todayTasks.map(t => {
      const proj = getProject(projectsRef.current, t.project);
      return `- [${t.id}] ${t.title} (${proj.name}, ${PRIORITIES[t.priority].short}, ${t.estimate}min${t.blocker ? `, BLOQUEADO: ${t.blocker.reason}` : ''})`;
    }).join('\n')}`;
    try {
      const raw = await callClaude(sys, userPrompt);
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setMessages(prev => [...prev, { role: 'assistant', content: `**Bloque matutino:** ${parsed.morning_block}\n\n**Razón:** ${parsed.rationale}` }]);
      showToast('Día priorizado');
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'No pude priorizar.' }]);
    }
    setAiLoading(false);
  };

  const generateSummary = async () => {
    setAiLoading(true);
    const list = tasksRef.current;
    const pj = projectsRef.current;
    const done = list.filter(t => t.column === 'hecho');
    const progress = list.filter(t => t.column === 'en_progreso' || t.column === 'revision');
    const pending = list.filter(t => t.column === 'hoy');
    const sys = `Resumen ejecutivo del día. Tono directo sin adornos. Español. Máx 200 palabras.`;
    const fmt = (t) => `- ${t.title} (${getProject(pj, t.project).name})`;
    const userPrompt = `Hecho:\n${done.map(fmt).join('\n')}\n\nEn progreso:\n${progress.map(fmt).join('\n')}\n\nPendientes hoy:\n${pending.map(fmt).join('\n')}`;
    try {
      const raw = await callClaude(sys, userPrompt);
      setSummary(raw); setSummaryOpen(true);
    } catch {
      setSummary('No pude generar resumen.'); setSummaryOpen(true);
    }
    setAiLoading(false);
  };

  const generateBrief = async (silent = false) => {
    if (!silent) setAiLoading(true);
    const list = tasksRef.current;
    const pj = projectsRef.current;
    const hoy = list.filter(t => t.column === 'hoy' || t.column === 'en_progreso');
    if (hoy.length === 0 && !silent) {
      setBriefContent('No tienes tareas para hoy. Agrega algunas y vuelve.');
      setBriefOpen(true);
      setAiLoading(false);
      return;
    }
    if (hoy.length === 0 && silent) { setAiLoading(false); return; }
    const q1Count = hoy.filter(t => t.priority === 'q1').length;
    const blocked = list.filter(t => t.blocker && t.column !== 'hecho');
    const totalMin = hoy.reduce((s, t) => s + t.estimate, 0);
    const sys = `Brief matutino. 3-4 frases cortas, directo, español. Sin saludos genéricos. Empieza con acción concreta para las primeras 2 horas.`;
    const userPrompt = `Hoy: ${hoy.length} tareas (${q1Count} Q1). ${Math.floor(totalMin/60)}h ${totalMin%60}m netas.\n\nBloqueadores activos:\n${blocked.map(t => `- ${t.title}: ${t.blocker.reason}`).join('\n') || 'Ninguno'}\n\nTareas hoy:\n${hoy.map(t => `- ${t.title} (${getProject(pj, t.project).name}, ${PRIORITIES[t.priority].short})`).join('\n')}`;
    try {
      const raw = await callClaude(sys, userPrompt, 400);
      setBriefContent(raw); setBriefOpen(true);
    } catch {
      setBriefContent('No pude generar el brief.'); setBriefOpen(true);
    }
    if (!silent) setAiLoading(false);
  };

  const generateWeeklyReview = async () => {
    setAiLoading(true);
    const list = tasksRef.current;
    const pj = projectsRef.current;
    const done = list.filter(t => t.column === 'hecho');
    const pending = list.filter(t => t.column !== 'hecho');
    const blocked = list.filter(t => t.blocker && t.column !== 'hecho');
    const sys = `Weekly Review (estilo GTD). Estructura:
**Qué shipeaste** (logros)
**Qué se atoró y por qué**
**Señal vs ruido** (patrón de discipline)
**Plan lunes** (top 3 prioridades)
Tono directo, español. Máx 300 palabras. Honesto sobre lo que no avanzó.`;
    const byProject = {};
    [...done, ...pending].forEach(t => {
      const name = getProject(pj, t.project).name;
      if (!byProject[name]) byProject[name] = { done: 0, pending: 0 };
      byProject[name][t.column === 'hecho' ? 'done' : 'pending']++;
    });
    const userPrompt = `Por proyecto:\n${Object.entries(byProject).map(([p, s]) => `- ${p}: ${s.done} hechas, ${s.pending} pendientes`).join('\n')}\n\nHecho:\n${done.map(t => `- ${t.title} (${getProject(pj, t.project).name})`).join('\n')}\n\nBloqueadores:\n${blocked.map(t => `- ${t.title}: ${t.blocker.reason}`).join('\n') || 'Ninguno'}`;
    try {
      const raw = await callClaude(sys, userPrompt, 800);
      setWeeklyContent(raw); setWeeklyOpen(true);
    } catch {
      setWeeklyContent('No pude generar el weekly review.'); setWeeklyOpen(true);
    }
    setAiLoading(false);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const projectCount = Object.keys(projects).length;
  const waitingCount = tasks.filter(t => t.column === 'revision' && t.assignee !== 'Alejandro').length;
  const blockersCount = tasks.filter(t => t.blocker && t.column !== 'hecho').length;
  const kanbanTasks = kanbanFilter === 'ALL' ? tasks : tasks.filter(t => t.project === kanbanFilter);

  const stats = {
    done: tasks.filter(t => t.column === 'hecho').length,
    total: tasks.length,
    todayMin: tasks.filter(t => t.column === 'hoy' || t.column === 'en_progreso').reduce((s, t) => s + t.estimate, 0),
    q1: tasks.filter(t => t.priority === 'q1' && t.column !== 'hecho').length,
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const isFriday = now.getDay() === 5;

  return (
    <ProjectsContext.Provider value={projects}>
    <div className="min-h-screen w-full text-stone-100 font-sans" style={{ background: '#0a0a0a' }}>
      <style>{`
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .slide-in { animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
      `}</style>

      <header className="sticky top-0 z-30 border-b border-stone-800/80 backdrop-blur-xl" style={{ background: 'rgba(10,10,10,0.85)' }}>
        <div className="flex items-center h-16 px-6 gap-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('tablero'); setSelectedProjectKey(null); }} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F59E0B, #EA580C)' }}>
              <CloudLightning className="w-5 h-5 text-stone-950" strokeWidth={2.5} />
            </button>
            <div>
              <div className="font-display text-[15px] leading-none font-semibold">
                <span className="italic font-light">command</span><span className="tracking-tight">.center</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mt-0.5 font-mono">{dateStr}</div>
            </div>
          </div>

          <div className="flex-1 max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input type="text" placeholder="Pregúntale a tu copiloto o crea una tarea…" value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setCopilotOpen(true); handleAISend(); } }}
                onFocus={() => setCopilotOpen(true)}
                className="w-full bg-stone-900/60 border border-stone-800 rounded-xl pl-11 pr-20 py-2.5 text-sm placeholder:text-stone-500 focus:outline-none focus:border-amber-500/50 focus:bg-stone-900 transition-all" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                <kbd className="px-1.5 py-0.5 border border-stone-700 rounded bg-stone-900">⌘</kbd>
                <kbd className="px-1.5 py-0.5 border border-stone-700 rounded bg-stone-900">K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => generateBrief()} disabled={aiLoading} className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-medium transition-all disabled:opacity-50">
              <Sunrise className="w-3.5 h-3.5 text-amber-400" /><span>Brief</span>
            </button>
            {isFriday && (
              <button onClick={generateWeeklyReview} disabled={aiLoading} className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-medium transition-all disabled:opacity-50">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" /><span>Weekly</span>
              </button>
            )}
            <button onClick={prioritizeDay} disabled={aiLoading} className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs font-medium transition-all disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /><span>Priorizar</span>
            </button>
            <button onClick={() => setCopilotOpen(!copilotOpen)} className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all relative">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {aiLoading && <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full pulse-dot" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-60 shrink-0 border-r border-stone-800/80 min-h-[calc(100vh-4rem)] p-4">
          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-2 px-2">Métrica hoy</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Hecho</div>
                <div className="font-display text-2xl font-light mt-1">{stats.done}<span className="text-stone-600 text-sm">/{stats.total}</span></div>
              </div>
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Q1</div>
                <div className="font-display text-2xl font-light mt-1 text-red-400">{stats.q1}</div>
              </div>
            </div>
            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-3 mt-2">
              <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">Minutos hoy</div>
              <div className="font-display text-2xl font-light mt-1">{Math.floor(stats.todayMin / 60)}h {stats.todayMin % 60}m</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-2 px-2">Colecciones</div>
            <button onClick={() => { setView('notas'); setSelectedProjectKey(null); }} className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all ${view === 'notas' ? 'bg-stone-800/80 text-stone-100' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'}`}>
              <StickyNote className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Notas</span>
              {notes.length > 0 && <span className="text-[10px] text-stone-500 font-mono">{notes.length}</span>}
            </button>
            <button onClick={() => { setView('esperando'); setSelectedProjectKey(null); }} className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all ${view === 'esperando' ? 'bg-stone-800/80 text-stone-100' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'}`}>
              <UserCheck className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Esperando de</span>
              {waitingCount > 0 && <span className="text-[10px] text-amber-400 font-mono">{waitingCount}</span>}
            </button>
            <button onClick={() => { setView('bloqueadores'); setSelectedProjectKey(null); }} className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all ${view === 'bloqueadores' ? 'bg-stone-800/80 text-stone-100' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'}`}>
              <Ban className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Bloqueadores</span>
              {blockersCount > 0 && <span className="text-[10px] text-red-400 font-mono">{blockersCount}</span>}
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Proyectos</div>
              <button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }} className="p-0.5 text-stone-500 hover:text-amber-400" title="Nuevo proyecto">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {Object.keys(projects).length === 0 && (
              <button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }} className="w-full py-3 rounded-lg border border-dashed border-stone-800 text-[11px] text-stone-500 hover:border-amber-500/50 hover:text-amber-400 transition-all">
                + Crear primer proyecto
              </button>
            )}
            {Object.values(projects).map(p => {
              const count = tasks.filter(t => t.project === p.id && t.column !== 'hecho').length;
              const isActive = view === 'proyecto' && selectedProjectKey === p.id;
              return (
                <div key={p.id} className="group relative">
                  <button onClick={() => { setView('proyecto'); setSelectedProjectKey(p.id); }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-stone-800/80 text-stone-100' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs font-semibold tracking-wide truncate">{p.name}</div>
                      {p.subtitle && <div className="text-[9px] text-stone-500 uppercase tracking-wider font-mono truncate">{p.subtitle}</div>}
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono group-hover:hidden">{count}</span>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5 bg-stone-900 rounded">
                    <button onClick={(e) => { e.stopPropagation(); setEditingProject(p); setProjectModalOpen(true); }} className="p-1 text-stone-500 hover:text-amber-400" title="Editar">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'project', id: p.id, name: p.name, taskCount: tasks.filter(t => t.project === p.id).length }); }} className="p-1 text-stone-500 hover:text-red-400" title="Eliminar">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-2 px-2">Equipo</div>
            <div className="space-y-0.5">
              {TEAM.map(name => {
                const count = tasks.filter(t => t.assignee === name && t.column !== 'hecho').length;
                return (
                  <div key={name} className="flex items-center gap-3 px-2 py-1.5 text-xs text-stone-400">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center text-[9px] font-semibold text-stone-300 shrink-0">{name[0]}</div>
                    <span className="flex-1">{name}</span>
                    <span className="text-[10px] text-stone-600 font-mono">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 relative">
          {(view === 'tablero' || view === 'dia' || view === 'matriz' || view === 'enfoque') && (
            <div className="px-6 lg:px-8 pt-8 pb-4 border-b border-stone-800/50">
              <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-2">{projectCount === 0 ? 'Empieza aquí' : 'Tu día'}</div>
                  <h1 className="font-display text-4xl md:text-5xl font-light leading-none">
                    {projectCount === 0 ? (
                      <><span className="italic text-stone-300">Crea tu primer</span>{' '}<span className="text-amber-400 font-semibold">proyecto.</span></>
                    ) : (
                      <><span className="italic text-stone-300">Hoy toca</span>{' '}<span className="text-amber-400 font-semibold">ejecutar.</span></>
                    )}
                  </h1>
                </div>
                {projectCount === 0 ? (
                  <button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20">
                    <Plus className="w-4 h-4" strokeWidth={2.5} /> Nuevo proyecto
                  </button>
                ) : (
                  <button onClick={() => setQuickAddOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20">
                    <Plus className="w-4 h-4" strokeWidth={2.5} /> Nueva tarea
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 border-b border-stone-800 -mb-px overflow-x-auto scrollbar-thin">
                {[
                  { id: 'tablero',  label: 'Tablero',   icon: LayoutGrid, sub: 'Kanban' },
                  { id: 'dia',      label: 'Día',       icon: Calendar,   sub: 'Time blocks' },
                  { id: 'matriz',   label: 'Matriz',    icon: Target,     sub: 'Eisenhower' },
                  { id: 'enfoque',  label: 'Enfoque',   icon: Focus,      sub: 'Deep work' },
                ].map(v => (
                  <button key={v.id} onClick={() => setView(v.id)} className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${view === v.id ? 'text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}>
                    <v.icon className="w-3.5 h-3.5" />
                    <span>{v.label}</span>
                    <span className="text-[9px] text-stone-600 uppercase tracking-wider font-mono hidden sm:inline">{v.sub}</span>
                    {view === v.id && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-400" />}
                  </button>
                ))}
              </div>

              {view === 'tablero' && projectCount > 0 && (
                <div className="flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-thin pb-1">
                  <button onClick={() => setKanbanFilter('ALL')} className={`text-xs px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${kanbanFilter === 'ALL' ? 'bg-stone-100 text-stone-950 border-stone-100' : 'border-stone-800 text-stone-400 hover:border-stone-600'}`}>Todos</button>
                  {Object.values(projects).map(p => (
                    <button key={p.id} onClick={() => setKanbanFilter(p.id)} className={`text-xs px-3 py-1.5 rounded-full border transition-all whitespace-nowrap flex items-center gap-1.5 ${kanbanFilter === p.id ? 'text-stone-950 border-transparent font-semibold' : 'border-stone-800 text-stone-400 hover:border-stone-600'}`} style={kanbanFilter === p.id ? { background: p.color } : {}}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: kanbanFilter === p.id ? '#09090b' : p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-6 lg:p-8 fade-in" key={view + (selectedProjectKey || '')}>
            {projectCount === 0 && (view === 'tablero' || view === 'dia' || view === 'matriz' || view === 'enfoque') ? (
              <EmptyState onCreate={() => { setEditingProject(null); setProjectModalOpen(true); }} />
            ) : (
              <>
                {view === 'tablero' && (
                  <KanbanView tasks={kanbanTasks} onMove={moveTask} onDelete={deleteTask}
                    onFocus={(t) => { setFocusTask(t); setView('enfoque'); setFocusSeconds(0); setFocusRunning(true); }}
                    onOpen={(t) => setSelectedTaskId(t.id)}
                    draggedId={draggedId} setDraggedId={setDraggedId}
                    dragOverCol={dragOverCol} setDragOverCol={setDragOverCol} />
                )}
                {view === 'dia' && <DayView tasks={tasks} onOpen={(t) => setSelectedTaskId(t.id)} />}
                {view === 'matriz' && <MatrixView tasks={tasks} onUpdate={updateTask} onOpen={(t) => setSelectedTaskId(t.id)} />}
                {view === 'enfoque' && (
                  <FocusView task={focusTask} seconds={focusSeconds} running={focusRunning}
                    onToggle={() => setFocusRunning(r => !r)}
                    onComplete={() => { if (focusTask) { moveTask(focusTask.id, 'hecho'); setFocusTask(null); setFocusRunning(false); setView('tablero'); showToast('¡Tarea completada!'); } }}
                    onPick={(t) => { setFocusTask(t); setFocusSeconds(0); setFocusRunning(true); }}
                    availableTasks={tasks.filter(t => t.column === 'hoy' || t.column === 'en_progreso')} />
                )}
              </>
            )}
            {view === 'notas' && (
              <NotesView notes={notes} onAdd={addNote} onUpdate={updateNote} onDelete={deleteNote} onConvert={convertNoteToTask} />
            )}
            {view === 'proyecto' && selectedProjectKey && projects[selectedProjectKey] && (
              <ProjectDetailView project={projects[selectedProjectKey]}
                meta={projectMeta[selectedProjectKey] || { description: '', notes: '', links: [], decisions: [] }}
                tasks={tasks.filter(t => t.project === selectedProjectKey)}
                onOpenTask={(t) => setSelectedTaskId(t.id)}
                onUpdateMeta={(patch) => setProjectMeta(prev => ({ ...prev, [selectedProjectKey]: { ...prev[selectedProjectKey], ...patch } }))}
                onEdit={() => { setEditingProject(projects[selectedProjectKey]); setProjectModalOpen(true); }}
                onBack={() => { setView('tablero'); setSelectedProjectKey(null); }} />
            )}
            {view === 'esperando' && <WaitingView tasks={tasks} onOpen={(t) => setSelectedTaskId(t.id)} onMove={moveTask} />}
            {view === 'bloqueadores' && <BlockersView tasks={tasks} onOpen={(t) => setSelectedTaskId(t.id)} onClearBlocker={(id) => updateTask(id, { blocker: null })} />}
          </div>
        </main>

        {selectedTask && (
          <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTaskId(null)}
            onUpdate={(patch) => updateTask(selectedTask.id, patch)}
            onDelete={() => deleteTask(selectedTask.id)}
            onToggleSubtask={(subId) => toggleSubtask(selectedTask.id, subId)}
            onAddSubtask={(title) => addSubtask(selectedTask.id, title)}
            onDeleteSubtask={(subId) => deleteSubtask(selectedTask.id, subId)}
            onAddLink={(link) => addLink(selectedTask.id, link)}
            onRemoveLink={(idx) => removeLink(selectedTask.id, idx)}
            onFocus={() => { setFocusTask(selectedTask); setSelectedTaskId(null); setView('enfoque'); setFocusSeconds(0); setFocusRunning(true); }} />
        )}

        {copilotOpen && (
          <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-stone-950 border-l border-stone-800 z-40 flex flex-col slide-in">
            <div className="h-16 px-5 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-stone-950" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-display text-sm font-semibold italic">Copiloto</div>
                  <div className="text-[10px] text-stone-500 font-mono">claude-sonnet-4</div>
                </div>
              </div>
              <button onClick={() => setCopilotOpen(false)} className="p-1.5 hover:bg-stone-900 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} fade-in`}>
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-amber-500 text-stone-950 rounded-br-sm' : 'bg-stone-900 border border-stone-800 rounded-bl-sm'}`}>
                    {m.content.split('\n').map((line, j) => (
                      <div key={j} className="whitespace-pre-wrap">
                        {line.split(/(\*\*[^*]+\*\*)/g).map((part, k) =>
                          part.startsWith('**') && part.endsWith('**')
                            ? <strong key={k} className="font-semibold">{part.slice(2, -2)}</strong>
                            : part
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-stone-900 border border-stone-800 rounded-bl-sm flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span className="text-xs text-stone-400">Pensando…</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-800 space-y-2.5">
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: 'Brief', action: () => generateBrief() },
                  { label: 'Priorizar', action: prioritizeDay },
                  { label: 'Weekly', action: generateWeeklyReview },
                  { label: 'Resumen', action: generateSummary },
                ].map(s => (
                  <button key={s.label} onClick={s.action} className="text-[11px] px-2.5 py-1 rounded-full bg-stone-900 border border-stone-800 text-stone-400 hover:text-amber-400 hover:border-amber-500/30 transition-all">{s.label}</button>
                ))}
              </div>
              <div className="flex gap-2 items-end">
                <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAISend(); } }}
                  placeholder="Ej: agrega llamada con Diego mañana 10am"
                  rows={2} className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
                <button onClick={handleAISend} disabled={!aiInput.trim() || aiLoading} className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 rounded-lg transition-all">
                  <Send className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {quickAddOpen && (
          <QuickAddModal
            projects={projects}
            prefill={quickAddPrefill}
            onClose={() => { setQuickAddOpen(false); setQuickAddPrefill(null); }}
            onAdd={(t) => {
              addTask(t);
              setQuickAddOpen(false);
              setQuickAddPrefill(null);
              showToast('Tarea creada');
            }}
          />
        )}

        {projectModalOpen && (
          <ProjectModal
            project={editingProject}
            onClose={() => { setProjectModalOpen(false); setEditingProject(null); }}
            onSave={(data) => {
              if (editingProject) updateProject(editingProject.id, data);
              else createProject(data);
              setProjectModalOpen(false);
              setEditingProject(null);
            }}
          />
        )}

        {confirmDelete && (
          <ConfirmModal
            title="Eliminar proyecto"
            message={`¿Seguro que quieres eliminar "${confirmDelete.name}"? ${confirmDelete.taskCount > 0 ? `Esto también eliminará sus ${confirmDelete.taskCount} tarea(s).` : ''}`}
            confirmLabel="Eliminar"
            danger
            onConfirm={() => { deleteProject(confirmDelete.id); setConfirmDelete(null); }}
            onClose={() => setConfirmDelete(null)}
          />
        )}

        {summaryOpen && <ContentModal title="Resumen ejecutivo" subtitle="Tu día en un vistazo" content={summary} icon={Brain} onClose={() => setSummaryOpen(false)} />}
        {briefOpen && <ContentModal title="Brief matutino" subtitle={dateStr} content={briefContent} icon={Sunrise} onClose={() => setBriefOpen(false)} accent="amber" />}
        {weeklyOpen && <ContentModal title="Weekly Review" subtitle="GTD · Semana en revisión" content={weeklyContent} icon={BookOpen} onClose={() => setWeeklyOpen(false)} accent="indigo" />}

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-stone-900 border border-amber-500/30 rounded-lg text-sm shadow-2xl shadow-black/50 fade-in flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />{toast}
          </div>
        )}
      </div>
    </div>
    </ProjectsContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════
function EmptyState({ onCreate }) {
  return (
    <div className="max-w-xl mx-auto text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
        <Briefcase className="w-8 h-8 text-amber-400" />
      </div>
      <h2 className="font-display text-3xl font-light italic mb-3">Sin proyectos aún</h2>
      <p className="text-sm text-stone-400 leading-relaxed mb-8 max-w-md mx-auto">
        Empieza creando un proyecto — puede ser un negocio, un cliente, un área de tu vida, o un objetivo. Después agrega tareas, subtareas y bloqueadores.
      </p>
      <button onClick={onCreate} className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20">
        <Plus className="w-4 h-4" strokeWidth={2.5} /> Crear primer proyecto
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KANBAN
// ═══════════════════════════════════════════════════════════
function KanbanView({ tasks, onMove, onDelete, onFocus, onOpen, draggedId, setDraggedId, dragOverCol, setDragOverCol }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin -mx-2 px-2">
      {COLUMNS.map((col, idx) => {
        const colTasks = tasks.filter(t => t.column === col.id);
        const totalMin = colTasks.reduce((s, t) => s + t.estimate, 0);
        const Icon = col.icon;
        const isOver = dragOverCol === col.id;
        return (
          <div key={col.id}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => { e.preventDefault(); if (draggedId) onMove(draggedId, col.id); setDraggedId(null); setDragOverCol(null); }}
            className={`shrink-0 w-[300px] rounded-xl border transition-all ${isOver ? 'border-amber-500/50 bg-stone-900/60' : 'border-stone-800 bg-stone-900/20'}`}>
            <div className="p-4 border-b border-stone-800/70">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-stone-500" />
                  <div className="text-sm font-semibold tracking-tight">{col.name}</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-800 text-stone-400 font-mono">{colTasks.length}</span>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono flex items-center justify-between">
                <span>{col.sub}</span>
                {totalMin > 0 && <span>{Math.floor(totalMin / 60)}h {totalMin % 60}m</span>}
              </div>
            </div>
            <div className="p-2 space-y-2 min-h-[400px] max-h-[calc(100vh-24rem)] overflow-y-auto scrollbar-thin">
              {colTasks.length === 0 && (
                <div className="text-center py-10 text-xs text-stone-600 italic font-display">
                  {idx === 0 && 'Captura aquí'}
                  {idx === 1 && 'Arrastra a hoy'}
                  {idx > 1 && 'Vacío'}
                </div>
              )}
              {colTasks.map(task => (
                <TaskCard key={task.id} task={task}
                  onDelete={() => onDelete(task.id)}
                  onFocus={() => onFocus(task)}
                  onOpen={() => onOpen(task)}
                  onDragStart={() => setDraggedId(task.id)}
                  onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onDelete, onFocus, onOpen, onDragStart, onDragEnd, compact = false }) {
  const projects = useProjects();
  const project = getProject(projects, task.project);
  const priority = PRIORITIES[task.priority];
  const subDone = task.subtasks?.filter(s => s.done).length || 0;
  const subTotal = task.subtasks?.length || 0;
  const subPct = subTotal > 0 ? (subDone / subTotal) * 100 : 0;

  return (
    <div draggable={!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      className="group relative bg-stone-950 border border-stone-800 rounded-lg p-3 cursor-pointer hover:border-stone-700 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40">
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full" style={{ background: task.blocker ? '#EF4444' : project.color }} />
      <div className="flex items-start gap-2 pl-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-[9px] uppercase tracking-wider font-mono font-semibold truncate max-w-[120px]" style={{ color: project.color }}>{project.name}</span>
            <span className="text-stone-700">·</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-semibold" style={{ color: priority.color, background: priority.bg }}>{priority.short}</span>
            {task.recurrence && task.recurrence !== 'none' && <span title="Recurrente" className="text-indigo-400"><Repeat className="w-3 h-3" /></span>}
            {task.blocker && <span title={task.blocker.reason} className="text-red-400"><Ban className="w-3 h-3" /></span>}
          </div>
          <div className={`${compact ? 'text-xs' : 'text-[13px]'} leading-snug text-stone-100 font-medium`}>{task.title}</div>

          {subTotal > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[9px] text-stone-500 font-mono mb-1">
                <span className="flex items-center gap-1"><ListChecks className="w-2.5 h-2.5" /> {subDone}/{subTotal}</span>
              </div>
              <div className="h-0.5 bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${subPct}%`, background: project.color }} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2.5 text-[10px] text-stone-500 font-mono">
            {task.time && <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.time}</div>}
            <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.estimate}m</div>
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center text-[8px] font-semibold text-stone-300">{task.assignee[0]}</div>
              <span className="text-stone-500">{task.assignee}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        {onFocus && <button onClick={(e) => { e.stopPropagation(); onFocus(); }} className="p-1 hover:bg-stone-800 rounded text-stone-500 hover:text-amber-400"><Focus className="w-3 h-3" /></button>}
        {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-stone-800 rounded text-stone-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════════════════════════
function DayView({ tasks, onOpen }) {
  const projects = useProjects();
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  const todayTasks = tasks.filter(t => (t.column === 'hoy' || t.column === 'en_progreso') && t.time);
  const unscheduled = tasks.filter(t => (t.column === 'hoy' || t.column === 'en_progreso') && !t.time);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div className="bg-stone-900/20 border border-stone-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono">Hoy</div>
            <div className="font-display text-xl italic font-light">Bloques de tiempo</div>
          </div>
          <div className="text-[10px] text-stone-500 font-mono">{todayTasks.length} bloques</div>
        </div>
        <div className="divide-y divide-stone-800/50">
          {hours.map(h => {
            const hStr = h.toString().padStart(2, '0') + ':00';
            const tasksAtHour = todayTasks.filter(t => parseInt(t.time) === h);
            return (
              <div key={h} className="flex gap-4 p-4 min-h-[68px] hover:bg-stone-900/30 transition-colors">
                <div className="w-12 text-[11px] font-mono text-stone-500 pt-1">{hStr}</div>
                <div className="flex-1 space-y-2">
                  {tasksAtHour.map(t => {
                    const p = getProject(projects, t.project);
                    return (
                      <div key={t.id} onClick={() => onOpen(t)} className="cursor-pointer rounded-lg p-3 transition-all hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${p.color}15, ${p.color}08)`, border: `1px solid ${p.color}40` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] uppercase tracking-wider font-mono font-semibold" style={{ color: p.color }}>{p.name}</span>
                          <span className="text-[10px] text-stone-500 font-mono">· {t.estimate}m</span>
                          {t.blocker && <span className="text-red-400"><Ban className="w-3 h-3" /></span>}
                        </div>
                        <div className="text-sm font-medium text-stone-100">{t.title}</div>
                      </div>
                    );
                  })}
                  {tasksAtHour.length === 0 && <div className="text-[11px] text-stone-700 italic font-display">— vacío</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-stone-900/20 border border-stone-800 rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-3">Sin horario</div>
          {unscheduled.length === 0 && <div className="text-xs text-stone-600 italic font-display">Todo agendado</div>}
          <div className="space-y-2">
            {unscheduled.map(t => {
              const p = getProject(projects, t.project);
              return (
                <div key={t.id} onClick={() => onOpen(t)} className="cursor-pointer p-2.5 rounded-lg bg-stone-950 border border-stone-800 hover:border-stone-700">
                  <div className="text-[9px] uppercase tracking-wider font-mono font-semibold mb-1" style={{ color: p.color }}>{p.name}</div>
                  <div className="text-xs text-stone-200">{t.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MATRIX
// ═══════════════════════════════════════════════════════════
function MatrixView({ tasks, onUpdate, onOpen }) {
  const projects = useProjects();
  const active = tasks.filter(t => t.column !== 'hecho');
  const quads = [
    { id: 'q1', label: 'Hacer ahora', sub: 'Urgente + Importante', action: 'Ejecuta hoy', tasks: active.filter(t => t.priority === 'q1'), border: 'border-red-500/30', bg: 'from-red-500/10' },
    { id: 'q2', label: 'Agendar',     sub: 'Importante',           action: 'Time-block',  tasks: active.filter(t => t.priority === 'q2'), border: 'border-amber-500/30', bg: 'from-amber-500/10' },
    { id: 'q3', label: 'Delegar',     sub: 'Urgente no importante',action: 'Asigna ya',   tasks: active.filter(t => t.priority === 'q3'), border: 'border-sky-500/30',   bg: 'from-sky-500/10' },
    { id: 'q4', label: 'Eliminar',    sub: 'Ninguno',              action: 'Cuestiona',   tasks: active.filter(t => t.priority === 'q4'), border: 'border-stone-500/30', bg: 'from-stone-500/10' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {quads.map(q => (
        <div key={q.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('id'); if (id) onUpdate(id, { priority: q.id }); }}
          className={`rounded-xl border ${q.border} bg-gradient-to-br ${q.bg} to-transparent p-5 min-h-[280px]`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-1">{q.id.toUpperCase()} · {q.sub}</div>
              <div className="font-display text-2xl font-light italic">{q.label}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-light">{q.tasks.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono">{q.action}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {q.tasks.length === 0 && <div className="text-xs text-stone-600 italic font-display py-4">Arrastra tareas aquí</div>}
            {q.tasks.slice(0, 6).map(t => {
              const p = getProject(projects, t.project);
              return (
                <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('id', t.id)} onClick={() => onOpen(t)} className="flex items-center gap-2 p-2 rounded-lg bg-stone-950/60 border border-stone-800/50 hover:border-stone-700 cursor-pointer">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-xs text-stone-200 flex-1 truncate">{t.title}</span>
                  <span className="text-[9px] text-stone-500 font-mono">{t.estimate}m</span>
                </div>
              );
            })}
            {q.tasks.length > 6 && <div className="text-[10px] text-stone-500 font-mono pl-2">+ {q.tasks.length - 6} más…</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FOCUS
// ═══════════════════════════════════════════════════════════
function FocusView({ task, seconds, running, onToggle, onComplete, onPick, availableTasks }) {
  const projects = useProjects();
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  const pct = task ? Math.min(100, (seconds / 60 / task.estimate) * 100) : 0;

  if (!task) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-2">Deep Work · Pomodoro</div>
          <div className="font-display text-3xl font-light italic text-stone-300">Elige una tarea para enfocarte</div>
        </div>
        <div className="space-y-2">
          {availableTasks.length === 0 && <div className="text-center py-12 text-sm text-stone-600 italic font-display">No hay tareas en hoy / en progreso</div>}
          {availableTasks.map(t => {
            const p = getProject(projects, t.project);
            return (
              <button key={t.id} onClick={() => onPick(t)} className="w-full p-4 bg-stone-900/40 border border-stone-800 rounded-xl hover:border-amber-500/40 hover:bg-stone-900 transition-all group text-left flex items-center gap-4">
                <span className="w-1 h-12 rounded-full" style={{ background: p.color }} />
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider font-mono font-semibold mb-1" style={{ color: p.color }}>{p.name}</div>
                  <div className="text-sm text-stone-100">{t.title}</div>
                </div>
                <div className="text-right"><div className="text-xs text-stone-400 font-mono">{t.estimate} min</div></div>
                <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-amber-400" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const p = getProject(projects, task.project);
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="text-[10px] uppercase tracking-[0.25em] font-mono mb-3" style={{ color: p.color }}>{p.name} · enfoque</div>
      <div className="font-display text-3xl font-light italic mb-12">{task.title}</div>
      <div className="relative w-72 h-72 mx-auto mb-12">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#27272a" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="46" fill="none" stroke={p.color} strokeWidth="1.5" strokeLinecap="round" strokeDasharray={`${pct * 2.89} 289`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-7xl font-light tabular-nums">{mm}<span className="text-stone-600">:</span>{ss}</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono mt-2">meta {task.estimate}:00</div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button onClick={onToggle} className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20">
          {running ? <><Pause className="w-4 h-4" strokeWidth={2.5} /> Pausar</> : <><Play className="w-4 h-4" strokeWidth={2.5} /> Continuar</>}
        </button>
        <button onClick={onComplete} className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all">
          <CheckCircle2 className="w-4 h-4" /> Completar
        </button>
      </div>
      <div className="mt-12 inline-flex items-center gap-2 text-xs text-stone-500 font-mono">
        <Coffee className="w-3.5 h-3.5" />Pomodoro 25/5 · sin distracciones
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTES VIEW
// ═══════════════════════════════════════════════════════════
function NotesView({ notes, onAdd, onUpdate, onDelete, onConvert }) {
  const [draft, setDraft] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [editTitle, setEditTitle] = useState('');

  const capture = () => {
    if (!draft.trim()) return;
    onAdd({ body: draft.trim() });
    setDraft('');
  };

  const startEdit = (note) => {
    setExpandedId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);
  };

  const saveEdit = (id) => {
    onUpdate(id, { title: editTitle.trim() || 'Nota sin título', body: editBody });
    setExpandedId(null);
  };

  const fmt = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-2">GTD · Captura rápida</div>
        <h1 className="font-display text-4xl font-light"><span className="italic">Notas</span> <span className="text-amber-400 font-semibold">sin procesar</span></h1>
        <p className="text-sm text-stone-400 mt-2 max-w-2xl">Captura ahora, procesa después. Una idea, un pendiente, un link — dale aquí. Luego conviértela en tarea con proyecto, prioridad y tiempo.</p>
      </div>

      <div className="bg-stone-900/30 border border-stone-800 rounded-xl p-4 mb-8">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); capture(); } }}
          placeholder="Escribe una idea, link, pendiente… ⌘+Enter para guardar"
          rows={3}
          className="w-full bg-transparent text-sm leading-relaxed focus:outline-none resize-none placeholder:text-stone-600"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-800/60">
          <div className="text-[10px] text-stone-500 font-mono">{draft.length} caracteres</div>
          <button onClick={capture} disabled={!draft.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 rounded-lg text-xs font-semibold transition-all">
            <Plus className="w-3 h-3" strokeWidth={2.5} /> Capturar
          </button>
        </div>
      </div>

      {notes.length === 0 && (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 text-stone-700 mx-auto mb-4" strokeWidth={1.2} />
          <div className="font-display text-xl italic text-stone-400 mb-1">Sin notas aún</div>
          <div className="text-xs text-stone-600 font-mono">Tu cerebro es para pensar, no para recordar</div>
        </div>
      )}

      <div className="space-y-2">
        {notes.map(note => {
          const isExpanded = expandedId === note.id;
          return (
            <div key={note.id} className="group bg-stone-900/30 border border-stone-800 rounded-lg hover:border-stone-700 transition-all">
              {!isExpanded ? (
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <StickyNote className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-1" />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(note)}>
                      <div className="text-sm text-stone-100 font-medium truncate">{note.title}</div>
                      {note.body && note.body !== note.title && (
                        <div className="text-xs text-stone-500 mt-1 line-clamp-2">{note.body}</div>
                      )}
                      <div className="text-[10px] text-stone-600 font-mono mt-2">{fmt(note.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onConvert(note)} className="p-1.5 text-stone-500 hover:text-amber-400 rounded" title="Convertir a tarea">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => startEdit(note)} className="p-1.5 text-stone-500 hover:text-stone-300 rounded" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(note.id)} className="p-1.5 text-stone-500 hover:text-red-400 rounded" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-transparent border-b border-stone-800 focus:border-amber-500 pb-2 text-sm font-medium focus:outline-none"
                    placeholder="Título" />
                  <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
                    rows={5}
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-stone-700 resize-none"
                    placeholder="Contenido…" />
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-stone-500 font-mono">{fmt(note.createdAt)}</div>
                    <div className="flex gap-2">
                      <button onClick={() => onConvert(note)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition-all">
                        <ArrowUpRight className="w-3 h-3" /> Convertir a tarea
                      </button>
                      <button onClick={() => setExpandedId(null)} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200">Cancelar</button>
                      <button onClick={() => saveEdit(note.id)} className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-xs font-medium">Guardar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PROJECT DETAIL
// ═══════════════════════════════════════════════════════════
function ProjectDetailView({ project, meta, tasks, onOpenTask, onUpdateMeta, onEdit, onBack }) {
  const p = project;
  const [tab, setTab] = useState('tareas');
  const [newDecision, setNewDecision] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });

  const done = tasks.filter(t => t.column === 'hecho').length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const blocked = tasks.filter(t => t.blocker && t.column !== 'hecho');
  const thisWeekMin = tasks.filter(t => t.column !== 'hecho').reduce((s, t) => s + t.estimate, 0);
  const teamLoad = {};
  tasks.filter(t => t.column !== 'hecho').forEach(t => { teamLoad[t.assignee] = (teamLoad[t.assignee] || 0) + 1; });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 font-mono">
          <ChevronLeft className="w-3 h-3" /> VOLVER
        </button>
        <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-400 font-mono">
          <Pencil className="w-3 h-3" /> EDITAR PROYECTO
        </button>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${p.color}20`, border: `1px solid ${p.color}40` }}>
            <Briefcase className="w-5 h-5" style={{ color: p.color }} />
          </div>
          <div>
            {p.subtitle && <div className="text-[11px] uppercase tracking-[0.25em] font-mono font-semibold" style={{ color: p.color }}>{p.subtitle}</div>}
            <h1 className="font-display text-4xl font-light"><span className="italic font-light">proyecto</span> <span className="font-semibold" style={{ color: p.color }}>{p.name}</span></h1>
          </div>
        </div>
        <p className="text-sm text-stone-400 leading-relaxed max-w-2xl">{meta.description || 'Sin descripción.'}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <MetricCard label="Tareas activas" value={total - done} sub={`${done} cerradas`} />
        <MetricCard label="Progreso" value={`${pct}%`} sub={`${done}/${total}`} />
        <MetricCard label="Bloqueadores" value={blocked.length} sub={blocked.length > 0 ? 'revisar' : 'ok'} color={blocked.length > 0 ? '#EF4444' : undefined} />
        <MetricCard label="Horas estimadas" value={`${Math.floor(thisWeekMin / 60)}h`} sub={`${thisWeekMin % 60}m`} />
      </div>

      <div className="flex items-center gap-1 border-b border-stone-800 mb-6 overflow-x-auto scrollbar-thin">
        {[
          { id: 'tareas', label: 'Tareas', icon: LayoutGrid },
          { id: 'descripcion', label: 'Descripción', icon: FileText },
          { id: 'notas', label: 'Notas', icon: FileText },
          { id: 'decisiones', label: 'Decisiones', icon: Lightbulb },
          { id: 'links', label: 'Links', icon: LinkIcon },
          { id: 'equipo', label: 'Equipo', icon: Users },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}>
            <t.icon className="w-3.5 h-3.5" /><span>{t.label}</span>
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: p.color }} />}
          </button>
        ))}
      </div>

      {tab === 'tareas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {COLUMNS.filter(c => c.id !== 'hecho').map(col => {
            const colTasks = tasks.filter(t => t.column === col.id);
            return (
              <div key={col.id} className="bg-stone-900/30 border border-stone-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <col.icon className="w-3.5 h-3.5 text-stone-500" />
                  <div className="text-xs font-semibold">{col.name}</div>
                  <span className="text-[10px] text-stone-500 font-mono ml-auto">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.length === 0 && <div className="text-xs text-stone-600 italic py-2 px-2 font-display">Vacío</div>}
                  {colTasks.map(t => <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t)} compact />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'descripcion' && (
        <textarea value={meta.description || ''} onChange={(e) => onUpdateMeta({ description: e.target.value })}
          placeholder="¿De qué se trata este proyecto? Objetivo, stack, contexto…"
          className="w-full bg-stone-900/30 border border-stone-800 rounded-xl p-5 text-sm text-stone-200 leading-relaxed min-h-[200px] focus:outline-none focus:border-stone-700 resize-none font-sans placeholder:text-stone-600" />
      )}

      {tab === 'notas' && (
        <textarea value={meta.notes || ''} onChange={(e) => onUpdateMeta({ notes: e.target.value })}
          placeholder="Contexto, estrategia, notas del proyecto…"
          className="w-full bg-stone-900/30 border border-stone-800 rounded-xl p-5 text-sm text-stone-200 leading-relaxed min-h-[300px] focus:outline-none focus:border-stone-700 resize-none font-sans placeholder:text-stone-600" />
      )}

      {tab === 'decisiones' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={newDecision} onChange={(e) => setNewDecision(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newDecision.trim()) { onUpdateMeta({ decisions: [{ date: new Date().toISOString().slice(0, 10), text: newDecision.trim() }, ...(meta.decisions || [])] }); setNewDecision(''); } }}
              placeholder="Agregar decisión clave…"
              className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
            <button onClick={() => { if (newDecision.trim()) { onUpdateMeta({ decisions: [{ date: new Date().toISOString().slice(0, 10), text: newDecision.trim() }, ...(meta.decisions || [])] }); setNewDecision(''); } }} className="px-3 py-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            {(meta.decisions || []).length === 0 && <div className="text-xs text-stone-600 italic font-display py-4">Sin decisiones registradas</div>}
            {(meta.decisions || []).map((d, i) => (
              <div key={i} className="flex gap-3 p-3 bg-stone-900/30 border border-stone-800 rounded-lg group">
                <div className="text-[10px] font-mono text-stone-500 shrink-0 pt-0.5">{d.date}</div>
                <div className="flex-1 text-sm text-stone-200">{d.text}</div>
                <button onClick={() => onUpdateMeta({ decisions: meta.decisions.filter((_, idx) => idx !== i) })} className="opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'links' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={newLink.label} onChange={(e) => setNewLink(l => ({ ...l, label: e.target.value }))} placeholder="Nombre (ej: GitHub)" className="bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
            <div className="flex gap-2">
              <input type="url" value={newLink.url} onChange={(e) => setNewLink(l => ({ ...l, url: e.target.value }))} placeholder="https://…" className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
              <button onClick={() => { if (newLink.label && newLink.url) { onUpdateMeta({ links: [...(meta.links || []), newLink] }); setNewLink({ label: '', url: '' }); } }} className="px-3 py-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="space-y-2">
            {(meta.links || []).length === 0 && <div className="text-xs text-stone-600 italic font-display py-4">Sin links</div>}
            {(meta.links || []).map((l, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-stone-900/30 border border-stone-800 rounded-lg group">
                <LinkIcon className="w-3.5 h-3.5 text-stone-500" />
                <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-sm text-stone-200 hover:text-amber-400">{l.label}</a>
                <span className="text-[10px] text-stone-600 font-mono truncate max-w-[200px]">{l.url}</span>
                <button onClick={() => onUpdateMeta({ links: meta.links.filter((_, idx) => idx !== i) })} className="opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'equipo' && (
        <div className="space-y-2">
          {Object.keys(teamLoad).length === 0 && <div className="text-xs text-stone-600 italic font-display">Sin asignaciones activas</div>}
          {TEAM.filter(name => teamLoad[name]).map(name => {
            const count = teamLoad[name];
            const max = Math.max(...Object.values(teamLoad));
            const loadPct = (count / max) * 100;
            return (
              <div key={name} className="p-4 bg-stone-900/30 border border-stone-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center text-xs font-semibold text-stone-300">{name[0]}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-[10px] text-stone-500 font-mono">{count} tarea(s) activa(s)</div>
                  </div>
                  <div className="font-display text-2xl font-light">{count}</div>
                </div>
                <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${loadPct}%`, background: p.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/30 p-4">
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1">{label}</div>
      <div className="font-display text-3xl font-light" style={color ? { color } : {}}>{value}</div>
      <div className="text-[10px] text-stone-500 font-mono mt-1">{sub}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// WAITING
// ═══════════════════════════════════════════════════════════
function WaitingView({ tasks, onOpen, onMove }) {
  const projects = useProjects();
  const waitingTasks = tasks.filter(t => t.column === 'revision' && t.assignee !== 'Alejandro');
  const byPerson = {};
  waitingTasks.forEach(t => { if (!byPerson[t.assignee]) byPerson[t.assignee] = []; byPerson[t.assignee].push(t); });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-2">Delegación activa</div>
        <h1 className="font-display text-4xl font-light"><span className="italic">Esperando</span> <span className="text-amber-400 font-semibold">de tu equipo</span></h1>
        <p className="text-sm text-stone-400 mt-2 max-w-2xl">Tareas delegadas pendientes. Si algo lleva más de 3 días, haz follow-up.</p>
      </div>

      {waitingTasks.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🎯</div>
          <div className="font-display text-xl italic text-stone-400">Sin delegaciones pendientes</div>
          <div className="text-xs text-stone-600 mt-2 font-mono">Todo está en tu cancha</div>
        </div>
      )}

      <div className="space-y-6">
        {TEAM.filter(name => byPerson[name]).map(name => (
          <div key={name}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-700 to-stone-800 flex items-center justify-center text-sm font-semibold text-stone-300">{name[0]}</div>
              <div>
                <div className="font-display text-lg">{name}</div>
                <div className="text-[10px] text-stone-500 font-mono uppercase tracking-wider">{byPerson[name].length} tarea(s) en su cancha</div>
              </div>
            </div>
            <div className="space-y-2 ml-12">
              {byPerson[name].map(t => {
                const p = getProject(projects, t.project);
                return (
                  <div key={t.id} className="group flex items-center gap-3 p-3 bg-stone-900/30 border border-stone-800 rounded-lg hover:border-stone-700 transition-all">
                    <span className="w-1 h-8 rounded-full" style={{ background: p.color }} />
                    <div className="flex-1 cursor-pointer" onClick={() => onOpen(t)}>
                      <div className="text-[9px] uppercase tracking-wider font-mono font-semibold" style={{ color: p.color }}>{p.name}</div>
                      <div className="text-sm text-stone-100">{t.title}</div>
                    </div>
                    <button onClick={() => onMove(t.id, 'hoy')} className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all">
                      <ArrowRight className="w-3 h-3" /> Retomar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BLOCKERS
// ═══════════════════════════════════════════════════════════
function BlockersView({ tasks, onOpen, onClearBlocker }) {
  const projects = useProjects();
  const blocked = tasks.filter(t => t.blocker && t.column !== 'hecho');

  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-2">Portfolio health</div>
        <h1 className="font-display text-4xl font-light"><span className="italic">Bloqueadores</span> <span className="text-red-400 font-semibold">activos</span></h1>
        <p className="text-sm text-stone-400 mt-2 max-w-2xl">Tareas que no pueden avanzar. Cada día aquí es velocity perdida.</p>
      </div>

      {blocked.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🟢</div>
          <div className="font-display text-xl italic text-stone-400">Cero bloqueadores</div>
          <div className="text-xs text-stone-600 mt-2 font-mono">Todo fluye</div>
        </div>
      )}

      <div className="space-y-3">
        {blocked.map(t => {
          const p = getProject(projects, t.project);
          const days = daysUntil(t.blocker.expectedDate);
          const overdue = days !== null && days < 0;
          return (
            <div key={t.id} className={`p-5 rounded-xl border ${overdue ? 'border-red-500/40 bg-red-500/5' : 'border-stone-800 bg-stone-900/30'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${overdue ? 'bg-red-500/20' : 'bg-stone-800'}`}>
                  <Ban className={`w-5 h-5 ${overdue ? 'text-red-400' : 'text-stone-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-mono font-semibold" style={{ color: p.color }}>{p.name}</span>
                    <span className="text-stone-700">·</span>
                    <span className="text-[10px] text-stone-500 font-mono">{COLUMNS.find(c => c.id === t.column)?.name}</span>
                  </div>
                  <div className="text-base text-stone-100 font-medium mb-2 cursor-pointer hover:text-amber-400" onClick={() => onOpen(t)}>{t.title}</div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3 text-red-400" />
                      <span className="text-stone-300">{t.blocker.reason}</span>
                    </div>
                    {t.blocker.resolver && (
                      <div className="flex items-center gap-1.5 text-stone-500">
                        <UserCheck className="w-3 h-3" /><span>Desbloquea: <span className="text-stone-300">{t.blocker.resolver}</span></span>
                      </div>
                    )}
                    {t.blocker.expectedDate && (
                      <div className={`flex items-center gap-1.5 font-mono ${overdue ? 'text-red-400' : 'text-stone-500'}`}>
                        <Calendar className="w-3 h-3" /><span>{t.blocker.expectedDate}</span>
                        {days !== null && <span>· {overdue ? `${Math.abs(days)}d vencido` : days === 0 ? 'hoy' : `en ${days}d`}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => onClearBlocker(t.id)} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all">
                  <CheckCircle2 className="w-3 h-3" /> Desbloquear
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TASK DETAIL DRAWER
// ═══════════════════════════════════════════════════════════
function TaskDetailDrawer({ task, onClose, onUpdate, onDelete, onToggleSubtask, onAddSubtask, onDeleteSubtask, onAddLink, onRemoveLink, onFocus }) {
  const projects = useProjects();
  const project = getProject(projects, task.project);
  const priority = PRIORITIES[task.priority];
  const [newSub, setNewSub] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [editTitle, setEditTitle] = useState(task.title);
  const [editing, setEditing] = useState(false);
  const [blockerEdit, setBlockerEdit] = useState(false);
  const [blockerForm, setBlockerForm] = useState(task.blocker || { reason: '', expectedDate: '', resolver: '' });

  useEffect(() => { setEditTitle(task.title); }, [task.id]);
  useEffect(() => { setBlockerForm(task.blocker || { reason: '', expectedDate: '', resolver: '' }); }, [task.id]);

  const subDone = task.subtasks.filter(s => s.done).length;
  const subTotal = task.subtasks.length;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[560px] bg-stone-950 border-l border-stone-800 z-50 flex flex-col slide-in">
        <div className="p-5 border-b border-stone-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
              <span className="text-[10px] uppercase tracking-[0.2em] font-mono font-semibold" style={{ color: project.color }}>{project.name}</span>
              <span className="text-stone-700">·</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-semibold" style={{ color: priority.color, background: priority.bg }}>{priority.short}</span>
              {task.recurrence && task.recurrence !== 'none' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                  <Repeat className="w-2.5 h-2.5" /> {RECURRENCE_OPTIONS.find(o => o.value === task.recurrence)?.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onFocus} className="p-1.5 hover:bg-stone-900 rounded-lg text-stone-400 hover:text-amber-400" title="Enfocar"><Focus className="w-4 h-4" /></button>
              <button onClick={onDelete} className="p-1.5 hover:bg-stone-900 rounded-lg text-stone-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              <button onClick={onClose} className="p-1.5 hover:bg-stone-900 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {editing ? (
            <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => { onUpdate({ title: editTitle }); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { onUpdate({ title: editTitle }); setEditing(false); } }}
              className="w-full bg-transparent border-b border-amber-500 font-display text-2xl font-light pb-2 focus:outline-none" />
          ) : (
            <h2 onClick={() => setEditing(true)} className="font-display text-2xl font-light italic cursor-pointer hover:text-amber-400 transition-colors">{task.title}</h2>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {task.blocker && (
            <div className="mx-5 mt-5 p-3 border border-red-500/30 bg-red-500/5 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider font-mono text-red-400 mb-1">Bloqueada</div>
                  <div className="text-sm text-stone-200">{task.blocker.reason}</div>
                </div>
                <button onClick={() => onUpdate({ blocker: null })} className="text-[10px] px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded font-medium">Desbloquear</button>
              </div>
              <div className="flex gap-3 text-[10px] text-stone-500 font-mono pl-6 flex-wrap">
                {task.blocker.resolver && <span>→ {task.blocker.resolver}</span>}
                {task.blocker.expectedDate && <span>📅 {task.blocker.expectedDate}</span>}
              </div>
            </div>
          )}

          <div className="p-5 grid grid-cols-2 gap-3">
            <Field label="Columna">
              <select value={task.column} onChange={(e) => onUpdate({ column: e.target.value })} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50">
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={task.priority} onChange={(e) => onUpdate({ priority: e.target.value })} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50">
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.short} · {v.label}</option>)}
              </select>
            </Field>
            <Field label="Proyecto">
              <select value={task.project} onChange={(e) => onUpdate({ project: e.target.value })} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50">
                {Object.values(projects).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Asignado">
              <select value={task.assignee} onChange={(e) => onUpdate({ assignee: e.target.value })} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50">
                {TEAM.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Estimado (min)">
              <input type="number" value={task.estimate} onChange={(e) => onUpdate({ estimate: Number(e.target.value) })} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50" />
            </Field>
            <Field label="Hora">
              <input type="time" value={task.time || ''} onChange={(e) => onUpdate({ time: e.target.value || null })} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50" />
            </Field>
            <Field label="Recurrencia" full>
              <select value={task.recurrence || 'none'} onChange={(e) => onUpdate({ recurrence: e.target.value })} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50">
                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <Section title="Descripción" icon={FileText}>
            <textarea value={task.description || ''} onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="¿De qué se trata? contexto, resultado esperado…" rows={4}
              className="w-full bg-stone-900 border border-stone-800 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-stone-700 resize-none placeholder:text-stone-600" />
          </Section>

          <Section title={`Subtareas ${subTotal > 0 ? `· ${subDone}/${subTotal}` : ''}`} icon={ListChecks}>
            <div className="space-y-1.5 mb-2">
              {task.subtasks.map(s => (
                <div key={s.id} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-stone-900/60">
                  <button onClick={() => onToggleSubtask(s.id)}>
                    {s.done ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-stone-600 hover:text-stone-400" />}
                  </button>
                  <span className={`flex-1 text-sm ${s.done ? 'line-through text-stone-500' : 'text-stone-200'}`}>{s.title}</span>
                  <button onClick={() => onDeleteSubtask(s.id)} className="opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newSub} onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newSub.trim()) { onAddSubtask(newSub.trim()); setNewSub(''); } }}
                placeholder="+ Agregar subtarea"
                className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
              <button onClick={() => { if (newSub.trim()) { onAddSubtask(newSub.trim()); setNewSub(''); } }} className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
            </div>
          </Section>

          <Section title="Bloqueador" icon={Ban}>
            {!task.blocker && !blockerEdit && (
              <button onClick={() => setBlockerEdit(true)} className="w-full py-3 rounded-lg border border-dashed border-stone-800 text-xs text-stone-500 hover:border-red-500/50 hover:text-red-400 transition-all">
                + Marcar como bloqueada
              </button>
            )}
            {(task.blocker || blockerEdit) && (
              <div className="space-y-2">
                <input value={blockerForm.reason} onChange={(e) => setBlockerForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Motivo del bloqueo"
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/50 placeholder:text-stone-600" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={blockerForm.resolver} onChange={(e) => setBlockerForm(f => ({ ...f, resolver: e.target.value }))}
                    placeholder="Quién desbloquea"
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50 placeholder:text-stone-600" />
                  <input type="date" value={blockerForm.expectedDate} onChange={(e) => setBlockerForm(f => ({ ...f, expectedDate: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { onUpdate({ blocker: blockerForm.reason ? blockerForm : null }); setBlockerEdit(false); }} className="flex-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium">Guardar bloqueo</button>
                  {task.blocker && (
                    <button onClick={() => { onUpdate({ blocker: null }); setBlockerEdit(false); }} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium">Desbloquear</button>
                  )}
                </div>
              </div>
            )}
          </Section>

          <Section title="Links" icon={LinkIcon}>
            <div className="space-y-1.5 mb-2">
              {task.links.map((l, i) => (
                <div key={i} className="group flex items-center gap-2 p-2 rounded-lg bg-stone-900/40 border border-stone-800">
                  <LinkIcon className="w-3 h-3 text-stone-500" />
                  <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-sm text-stone-200 hover:text-amber-400 truncate">{l.label}</a>
                  <button onClick={() => onRemoveLink(i)} className="opacity-0 group-hover:opacity-100 text-stone-600 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input value={newLink.label} onChange={(e) => setNewLink(l => ({ ...l, label: e.target.value }))} placeholder="Nombre" className="bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
              <input value={newLink.url} onChange={(e) => setNewLink(l => ({ ...l, url: e.target.value }))} placeholder="URL" className="bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
              <button onClick={() => { if (newLink.label && newLink.url) { onAddLink(newLink); setNewLink({ label: '', url: '' }); } }} className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-xs"><Plus className="w-3 h-3" /></button>
            </div>
          </Section>

          <Section title="Notas" icon={FileText}>
            <textarea value={task.notes || ''} onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Notas rápidas, ideas…" rows={3}
              className="w-full bg-stone-900 border border-stone-800 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-stone-700 resize-none placeholder:text-stone-600" />
          </Section>

          <div className="h-8" />
        </div>
      </div>
    </>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-1">{label}</div>
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="p-5 border-t border-stone-800/60">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-stone-500" />
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-mono font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════
function ContentModal({ title, subtitle, content, icon: Icon, onClose, accent = 'stone' }) {
  const accentClasses = {
    amber: 'from-amber-500 to-orange-600',
    indigo: 'from-indigo-500 to-purple-600',
    stone: 'from-stone-600 to-stone-700',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-stone-950 border border-stone-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${accentClasses[accent]}`}>
              <Icon className="w-5 h-5 text-stone-950" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-1">{title}</div>
              <h2 className="font-display text-2xl font-light italic">{subtitle}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-900 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="text-stone-300 leading-relaxed whitespace-pre-wrap font-sans text-sm">
            {content.split('\n').map((line, i) => (
              <div key={i}>
                {line.split(/(\*\*[^*]+\*\*)/g).map((part, k) =>
                  part.startsWith('**') && part.endsWith('**')
                    ? <strong key={k} className="font-semibold text-stone-100">{part.slice(2, -2)}</strong>
                    : part
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel = 'Confirmar', danger, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-stone-950 border border-stone-800 rounded-2xl w-full max-w-md fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-2">Confirmación</div>
          <h2 className="font-display text-2xl font-light italic mb-3">{title}</h2>
          <p className="text-sm text-stone-400 leading-relaxed">{message}</p>
        </div>
        <div className="p-4 border-t border-stone-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200">Cancelar</button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${danger ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-amber-500 hover:bg-amber-400 text-stone-950'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function QuickAddModal({ projects, prefill, onClose, onAdd }) {
  const projectKeys = Object.keys(projects);
  const [title, setTitle] = useState(prefill?.title || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [project, setProject] = useState(projectKeys[0] || '');
  const [priority, setPriority] = useState('q2');
  const [column, setColumn] = useState('inbox');
  const [estimate, setEstimate] = useState(30);
  const [assignee, setAssignee] = useState('Alejandro');
  const [time, setTime] = useState('');
  const [recurrence, setRecurrence] = useState('none');

  const submit = () => {
    if (!title.trim() || !project) return;
    onAdd({ title: title.trim(), description: description.trim(), project, priority, column, estimate: Number(estimate), assignee, time: time || null, recurrence });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-stone-950 border border-stone-800 rounded-2xl w-full max-w-lg fade-in max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-stone-800">
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-1">{prefill ? 'Convertir nota a tarea' : 'Nueva tarea'}</div>
          <div className="font-display text-2xl font-light italic">{prefill ? 'Nota → Tarea' : 'Captura rápida'}</div>
        </div>
        <div className="p-6 space-y-4">
          <input autoFocus type="text" placeholder="¿Qué necesitas hacer?" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            className="w-full bg-transparent border-b border-stone-800 focus:border-amber-500 pb-3 text-lg font-display font-light focus:outline-none placeholder:text-stone-600" />
          {prefill && (
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Descripción" className="w-full bg-stone-900 border border-stone-800 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Proyecto" value={project} onChange={setProject} options={Object.values(projects).map(p => [p.id, p.name])} />
            <SelectField label="Prioridad" value={priority} onChange={setPriority} options={Object.keys(PRIORITIES).map(k => [k, PRIORITIES[k].short + ' · ' + PRIORITIES[k].label])} />
            <SelectField label="Columna" value={column} onChange={setColumn} options={COLUMNS.map(c => [c.id, c.name])} />
            <SelectField label="Asignado" value={assignee} onChange={setAssignee} options={TEAM.map(n => [n, n])} />
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-1.5">Minutos</div>
              <input type="number" value={estimate} onChange={(e) => setEstimate(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-1.5">Hora (opc.)</div>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <SelectField label="Recurrencia" value={recurrence} onChange={setRecurrence} options={RECURRENCE_OPTIONS.map(o => [o.value, o.label])} full />
          </div>
        </div>
        <div className="p-4 border-t border-stone-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200">Cancelar</button>
          <button onClick={submit} disabled={!title.trim() || !project} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 rounded-lg text-sm font-semibold transition-all">{prefill ? 'Crear tarea' : 'Crear tarea'}</button>
        </div>
      </div>
    </div>
  );
}

function ProjectModal({ project, onClose, onSave }) {
  const [name, setName] = useState(project?.name || '');
  const [subtitle, setSubtitle] = useState(project?.subtitle || '');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0].value);

  const submit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), subtitle: subtitle.trim(), color });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-stone-950 border border-stone-800 rounded-2xl w-full max-w-md fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-stone-800">
          <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500 font-mono mb-1">{project ? 'Editar' : 'Nuevo'} proyecto</div>
          <div className="font-display text-2xl font-light italic">{project ? 'Actualiza detalles' : 'Define tu proyecto'}</div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-1.5">Nombre</div>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Ej: Proyecto Alpha"
              className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-1.5">Subtítulo <span className="text-stone-700 normal-case">(opcional)</span></div>
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Ej: CRM · Agents"
              className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-stone-600" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-2">Color</div>
            <div className="grid grid-cols-6 gap-2">
              {PROJECT_COLORS.map(c => (
                <button key={c.value} onClick={() => setColor(c.value)}
                  className={`relative aspect-square rounded-lg transition-all ${color === c.value ? 'ring-2 ring-stone-100 ring-offset-2 ring-offset-stone-950' : 'hover:scale-105'}`}
                  style={{ background: c.value }}
                  title={c.name}>
                  {color === c.value && <CheckCircle2 className="absolute inset-0 m-auto w-4 h-4 text-stone-950" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-stone-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200">Cancelar</button>
          <button onClick={submit} disabled={!name.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 rounded-lg text-sm font-semibold transition-all">{project ? 'Guardar' : 'Crear proyecto'}</button>
        </div>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-mono mb-1.5">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
