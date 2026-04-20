# Command Center

Tu día, organizado. Kanban + Eisenhower + Time Blocks + Focus Timer + copiloto de IA, en una sola app.

Hecho en **Next.js 14** (App Router) + **React 18** + **Tailwind CSS** + **Anthropic Claude Sonnet 4**.

---

## Features

- **Tablero Kanban** — 5 columnas (Inbox, Hoy, En Progreso, Revisión, Hecho) con drag & drop
- **Vista Día** — bloques de tiempo por hora
- **Matriz Eisenhower** — Q1/Q2/Q3/Q4 con drag & drop para repriorizar
- **Enfoque** — Pomodoro con progreso circular
- **Notas** — captura rápida estilo GTD, convertibles a tareas
- **Proyectos dinámicos** — crea/edita/elimina con paleta de 12 colores
- **Subtareas, bloqueadores, links, recurrencia** — todo dentro de cada tarea
- **Esperando de** — vista de delegaciones agrupadas por persona
- **Bloqueadores activos** — dashboard con fechas vencidas en rojo
- **Copiloto IA** — Brief matutino, Weekly Review (viernes), priorización, resumen ejecutivo, creación de tareas por lenguaje natural
- **Persistencia local** — todo en `localStorage`, sin backend

---

## Quick start (local)

**Requisitos:** Node.js 18.17+ y pnpm (o npm/yarn).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar la API key de Anthropic
cp .env.local.example .env.local
# Edita .env.local y pega tu key real de https://console.anthropic.com

# 3. Correr en dev
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) y listo.

---

## Deploy a Vercel

### Opción 1: Dashboard de Vercel (recomendado)

1. **Push a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: command center"
   git branch -M main
   git remote add origin git@github.com:TU_USUARIO/command-center.git
   git push -u origin main
   ```

2. **Importa en Vercel**
   - Ve a [vercel.com/new](https://vercel.com/new)
   - Selecciona tu repo
   - Framework preset: **Next.js** (detectado auto)
   - En **Environment Variables**, agrega:
     - `ANTHROPIC_API_KEY` = `sk-ant-api03-...`
   - Click **Deploy**

3. Listo. Tu app estará en `https://command-center-XXX.vercel.app`.

### Opción 2: CLI

```bash
npm i -g vercel
vercel login
vercel           # deploy a preview
vercel --prod    # deploy a producción
```

Vercel te pedirá la env var `ANTHROPIC_API_KEY` durante el setup. Si no, agrégala después:

```bash
vercel env add ANTHROPIC_API_KEY production
```

---

## Estructura

```
command-center/
├── app/
│   ├── api/ai/route.js       ← proxy server-side a Anthropic (oculta la API key)
│   ├── globals.css           ← Tailwind + Google Fonts
│   ├── layout.js             ← root layout
│   └── page.js               ← renderiza <CommandCenter />
├── components/
│   └── CommandCenter.jsx     ← la app completa (client component)
├── lib/
│   ├── ai.js                 ← cliente que llama a /api/ai
│   └── storage.js            ← wrapper de localStorage
├── public/
├── .env.local.example
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── README.md
```

---

## Cómo funciona

### Persistencia
Todo vive en `localStorage` del navegador, bajo estas keys:
- `cc_projects` — objeto `{ id: project }`
- `cc_project_meta` — metadata por proyecto (descripción, notas, decisiones, links)
- `cc_tasks` — array de tareas
- `cc_notes` — array de notas sin procesar
- `cc_last_brief` — fecha del último brief generado (para auto-mostrar una vez al día)

Esto significa: **los datos están por navegador/dispositivo**. Si abres la app en otra compu, empiezas vacío. Para sync multi-dispositivo necesitarías agregar Supabase o similar (fácil de hacer después).

### AI
Todas las llamadas a Claude pasan por `/api/ai` (Next.js API route en el server). La `ANTHROPIC_API_KEY` **nunca** se expone al cliente. El route usa `@anthropic-ai/sdk` y reenvía `{ system, messages, max_tokens }`.

### Modelo
Por default usa `claude-sonnet-4-20250514`. Si quieres cambiarlo, edita `app/api/ai/route.js`.

---

## Customización rápida

- **Equipo:** edita `TEAM` en `components/CommandCenter.jsx` línea ~32
- **Paleta de colores:** edita `PROJECT_COLORS` en `components/CommandCenter.jsx` línea ~43
- **Horas del Day View:** edita `hours` dentro de `DayView` (default 7am–7pm)
- **Modelo de Claude:** edita `app/api/ai/route.js`

---

## Ideas de siguiente iteración

- [ ] Sync multi-dispositivo con Supabase
- [ ] Auth (NextAuth v5)
- [ ] Editor de equipo (agregar/quitar miembros)
- [ ] Export a CSV / Markdown
- [ ] Integración con Google Calendar para Day View
- [ ] Integración con WhatsApp para capturar notas desde el teléfono
- [ ] Dark/light mode toggle (actualmente solo dark)

---

## Troubleshooting

**"ANTHROPIC_API_KEY no está configurada"**
→ Te falta `.env.local` con la key. En Vercel, agrega la env var en Settings → Environment Variables y re-deploy.

**Las fuentes se ven mal**
→ Google Fonts se carga por `@import` en `globals.css`. Si quieres hosting local, migra a `next/font`.

**El build falla por lucide-react**
→ Verifica versión ^0.400.0 en `package.json`.

**localStorage quota exceeded**
→ Poco probable con uso normal, pero si pasa, implementa IndexedDB en `lib/storage.js`.

---

## License

MIT. Úsalo como quieras.
