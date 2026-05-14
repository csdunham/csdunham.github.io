import { useState, useRef, useEffect, useCallback } from "react";

// ── Column definitions ───────────────────────────────────────────
const INBOX_COL = {
  id: "inbox", label: "INBOX", emoji: "📥",
  subtitle: "Captured, not yet decided",
  color: "#94a3b8", bg: "rgba(148,163,184,0.07)", border: "rgba(148,163,184,0.2)",
  maxItems: null, isInbox: true,
};
const COLUMNS = [
  { id: "active",  label: "ACTIVE",             emoji: "✅", subtitle: "What I'm actually working on right now",          color: "#22c55e", bg: "rgba(34,197,94,0.08)",    border: "rgba(34,197,94,0.25)",    maxItems: 5 },
  { id: "parked",  label: "PARKED",             emoji: "⏸️", subtitle: "Said yes to, but not happening right now",        color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  maxItems: null },
  { id: "notmine", label: "NOT MINE / DECLINING",emoji: "🚫", subtitle: "Explicitly off the list. Written down so it stays decided.", color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   maxItems: null },
  { id: "done",    label: "DONE THIS WEEK",     emoji: "✅", subtitle: "Evidence of progress",                            color: "#818cf8", bg: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.25)", maxItems: null, hasFilter: true },
];
const ALL_COLUMNS = [INBOX_COL, ...COLUMNS];
const DONE_FILTERS = [
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
];

// ── Date helpers ─────────────────────────────────────────────────
function getWeekStart() {
  const d = new Date(); const day = d.getDay();
  return new Date(new Date(d).setDate(d.getDate() - day + (day === 0 ? -6 : 1)));
}
function getMonthStart()   { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }
function getQuarterStart() { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return new Date(d.getFullYear(), q * 3, 1); }
function generateId()      { return Math.random().toString(36).slice(2, 10); }
function formatDate(iso)   { if (!iso) return ""; return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

// ── Sample data ──────────────────────────────────────────────────
const INITIAL_ITEMS = {
  inbox: [
    { id: generateId(), text: "Reach out to new landscaping vendor",         createdAt: new Date().toISOString() },
    { id: generateId(), text: "Review draft minutes from April board meeting", createdAt: new Date().toISOString() },
  ],
  active: [
    { id: generateId(), text: "Finalize Q2 budget proposal",               createdAt: new Date().toISOString() },
    { id: generateId(), text: "Solar lighting install — condo parking lot", createdAt: new Date().toISOString() },
  ],
  parked:  [{ id: generateId(), text: "HOA website redesign — needs board vote first",       createdAt: new Date().toISOString() }],
  notmine: [{ id: generateId(), text: "Landscaping vendor negotiations — delegated to Sarah", createdAt: new Date().toISOString() }],
  done: [
    { id: generateId(), text: "Sent out May HOA newsletter",               createdAt: new Date(Date.now() - 2*864e5).toISOString(),  completedAt: new Date().toISOString(),                    completedFrom: "active" },
    { id: generateId(), text: "Approved new leasing permit template",      createdAt: new Date(Date.now() - 12*864e5).toISOString(), completedAt: new Date(Date.now() - 8*864e5).toISOString(), completedFrom: "parked" },
    { id: generateId(), text: "Completed trail planning for FJ trip",      createdAt: new Date(Date.now() - 45*864e5).toISOString(), completedAt: new Date(Date.now() - 40*864e5).toISOString(), completedFrom: "active" },
    { id: generateId(), text: "Declined vendor cold outreach — website redesign", createdAt: new Date(Date.now() - 5*864e5).toISOString(), completedAt: new Date(Date.now() - 864e5).toISOString(), completedFrom: "notmine" },
  ],
};

// ── Add Item Input ───────────────────────────────────────────────
function AddItemInput({ onAdd, disabled, placeholder }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", opacity: disabled ? 0.38 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <span style={{ fontSize: "14px", color: "#4b5563", flexShrink: 0 }}>+</span>
      <input ref={ref} value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && value.trim()) { onAdd(value.trim()); setValue(""); }
          if (e.key === "Escape") { setValue(""); ref.current?.blur(); }
        }}
        placeholder={disabled ? "Max 5 items reached" : (placeholder || "Add item… press Enter")}
        style={{ background: "transparent", border: "none", borderBottom: "1px solid #2a2a38", color: "#d1d5db", fontSize: "13px", fontFamily: "inherit", padding: "4px 2px", width: "100%", outline: "none", caretColor: "#818cf8" }}
      />
    </div>
  );
}

// ── Draggable Item Card ──────────────────────────────────────────
function ItemCard({ item, onDelete, onMove, color, columns, columnId, isDragging, dragHandleProps }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const isInbox = columnId === "inbox";
  const isDone  = columnId === "done";
  const otherCols = columns.filter(c => c.id !== columnId);
  const completedFromCol = item.completedFrom ? ALL_COLUMNS.find(c => c.id === item.completedFrom) : null;

  return (
    <div style={{
      position: "relative", padding: "10px 12px", borderRadius: "8px",
      background: isDragging ? "rgba(255,255,255,0.1)" : (isInbox ? "rgba(148,163,184,0.04)" : "rgba(255,255,255,0.03)"),
      border: `1px solid ${isDragging ? "rgba(255,255,255,0.18)" : (isInbox ? "rgba(148,163,184,0.1)" : "rgba(255,255,255,0.06)")}`,
      marginBottom: "2px", display: "flex", alignItems: "flex-start", gap: "8px",
      transition: "background 0.12s, border 0.12s, opacity 0.12s",
      opacity: isDragging ? 0.55 : 1,
      userSelect: "none",
    }}>
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        title="Drag to reorder"
        style={{
          display: "flex", flexDirection: "column", gap: "3px",
          padding: "4px 2px", marginTop: "2px", flexShrink: 0,
          cursor: isDragging ? "grabbing" : "grab",
          opacity: 0.25, transition: "opacity 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
        onMouseLeave={e => e.currentTarget.style.opacity = "0.25"}
      >
        {[0,1].map(i => (
          <div key={i} style={{ display: "flex", gap: "3px" }}>
            <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: color }} />
            <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: color }} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "13.5px", lineHeight: "1.5", color: isInbox ? "#94a3b8" : "#e2e8f0", wordBreak: "break-word" }}>
          {item.text}
        </span>
        {isDone && (
          <div style={{ marginTop: "5px", display: "flex", flexDirection: "column", gap: "2px" }}>
            {completedFromCol && (
              <span style={{ fontSize: "11px", color: "#4b5563", lineHeight: 1.4 }}>
                Completed from{" "}
                <span style={{ color: completedFromCol.color, opacity: 0.75, fontFamily: "'DM Mono', monospace", fontSize: "10.5px", letterSpacing: "0.04em" }}>
                  {completedFromCol.label}
                </span>
              </span>
            )}
            {item.completedAt && (
              <span style={{ fontSize: "11px", color: "#4b5563", lineHeight: 1.4 }}>
                Completed on {formatDate(item.completedAt)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ⋯ menu */}
      <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
        <button onClick={() => setMenuOpen(o => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", fontSize: "16px", padding: "0 2px", lineHeight: 1, transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#9ca3af"}
          onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}
        >⋯</button>
        {menuOpen && (
          <div style={{ position: "absolute", right: 0, top: "24px", zIndex: 50, background: "#1a1a28", border: "1px solid #2d2d3d", borderRadius: "10px", padding: "6px", minWidth: "175px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            {isInbox && <div style={{ padding: "5px 10px 6px", fontSize: "10px", color: "#4b5563", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>Decide →</div>}
            {otherCols.map(col => (
              <button key={col.id} onClick={() => { onMove(item.id, col.id); setMenuOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: "6px", color: "#cbd5e1", fontSize: "12px", textAlign: "left", transition: "background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: col.color, flexShrink: 0, display: "inline-block" }} />
                {isInbox ? col.label : `Move to ${col.label}`}
              </button>
            ))}
            <div style={{ height: "1px", background: "#2d2d3d", margin: "4px 0" }} />
            <button onClick={() => { onDelete(item.id); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: "6px", color: "#f87171", fontSize: "12px", textAlign: "left", transition: "background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >✕ Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Drop Indicator Line ──────────────────────────────────────────
function DropIndicator({ color }) {
  return (
    <div style={{ position: "relative", height: "6px", margin: "1px 0", display: "flex", alignItems: "center" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", border: `2px solid ${color}`, background: "transparent", flexShrink: 0 }} />
      <div style={{ flex: 1, height: "2px", background: color, borderRadius: "2px" }} />
    </div>
  );
}

// ── Sortable Item List (handles drag logic) ──────────────────────
function SortableList({ items, columnId, color, onReorder, onDelete, onMove, allColumns }) {
  const [dragIndex, setDragIndex] = useState(null);   // index being dragged
  const [overIndex, setOverIndex] = useState(null);   // index we're hovering over
  const [overPos, setOverPos]     = useState(null);   // "before" | "after"
  const dragItem = useRef(null);

  const handleDragStart = (e, index) => {
    dragItem.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Transparent drag image
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";
    setOverIndex(index);
    setOverPos(pos);
  };

  const handleDragLeave = () => {
    setOverIndex(null);
    setOverPos(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const from = dragItem.current;
    if (from === null || from === index) { reset(); return; }
    const newItems = [...items];
    const [moved] = newItems.splice(from, 1);
    // Insert before or after target
    let insertAt = overPos === "before" ? index : index + 1;
    if (from < index) insertAt = overPos === "before" ? index - 1 : index;
    newItems.splice(Math.max(0, insertAt), 0, moved);
    onReorder(columnId, newItems);
    reset();
  };

  const handleDragEnd = () => reset();

  const reset = () => {
    setDragIndex(null);
    setOverIndex(null);
    setOverPos(null);
    dragItem.current = null;
  };

  if (items.length === 0) {
    return (
      <p style={{ color: "#374151", fontSize: "12px", fontStyle: "italic", textAlign: "center", paddingTop: "12px" }}>
        Nothing here yet
      </p>
    );
  }

  return (
    <div>
      {items.map((item, index) => {
        const showBefore = overIndex === index && overPos === "before" && dragIndex !== index;
        const showAfter  = overIndex === index && overPos === "after"  && dragIndex !== index;
        return (
          <div key={item.id}>
            {showBefore && <DropIndicator color={color} />}
            <div
              draggable
              onDragStart={e => handleDragStart(e, index)}
              onDragOver={e => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{ marginBottom: "6px" }}
            >
              <ItemCard
                item={item}
                color={color}
                columnId={columnId}
                columns={allColumns}
                isDragging={dragIndex === index}
                dragHandleProps={{
                  onMouseDown: e => e.stopPropagation(),
                }}
                onDelete={(id) => onDelete(columnId, id)}
                onMove={(id, targetCol) => onMove(id, columnId, targetCol)}
              />
            </div>
            {showAfter && <DropIndicator color={color} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Inbox Column ─────────────────────────────────────────────────
function InboxColumn({ items, onAdd, onDelete, onMove, onReorder, allColumns }) {
  const col = INBOX_COL;
  return (
    <div style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "20px 18px", display: "flex", flexDirection: "column", minWidth: 0, flex: "1 1 220px", maxWidth: "290px" }}>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontSize: "13px" }}>{col.emoji}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: "600", fontSize: "11px", letterSpacing: "0.12em", color: col.color }}>{col.label}</span>
          {items.length > 0 && (
            <span style={{ background: "rgba(148,163,184,0.15)", color: "#94a3b8", borderRadius: "20px", fontSize: "10px", padding: "1px 7px", fontFamily: "'DM Mono', monospace", fontWeight: "600" }}>{items.length}</span>
          )}
        </div>
        <p style={{ fontSize: "11px", color: "#4b5563", margin: 0, lineHeight: "1.4", fontStyle: "italic" }}>{col.subtitle}</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "60vh" }}>
        <SortableList items={items} columnId={col.id} color={col.color} onReorder={onReorder} onDelete={onDelete} onMove={onMove} allColumns={allColumns} />
      </div>
      <AddItemInput onAdd={(text) => onAdd(col.id, text)} placeholder="Capture anything… press Enter" />
    </div>
  );
}

// ── Main Column ──────────────────────────────────────────────────
function Column({ col, items, onAdd, onDelete, onMove, onReorder, allColumns, doneFilter, onDoneFilterChange }) {
  const isActive = col.id === "active";
  const atMax = isActive && items.length >= 5;

  let displayItems = items;
  if (col.hasFilter) {
    let cutoff;
    if (doneFilter === "week")    cutoff = getWeekStart();
    if (doneFilter === "month")   cutoff = getMonthStart();
    if (doneFilter === "quarter") cutoff = getQuarterStart();
    if (cutoff) displayItems = items.filter(i => new Date(i.createdAt) >= cutoff);
  }

  return (
    <div style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: "14px", padding: "20px 18px", display: "flex", flexDirection: "column", minWidth: 0, flex: "1 1 240px", maxWidth: "340px" }}>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px" }}>{col.emoji}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: "600", fontSize: "11px", letterSpacing: "0.12em", color: col.color }}>{col.label}</span>
          </div>
          {isActive && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: items.length >= 5 ? "#ef4444" : col.color, opacity: 0.8, fontWeight: "600" }}>{items.length}/5</span>
          )}
        </div>
        <p style={{ fontSize: "11px", color: "#6b7280", margin: 0, lineHeight: "1.4", fontStyle: "italic" }}>{col.subtitle}</p>
        {col.hasFilter && (
          <div style={{ display: "flex", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
            {DONE_FILTERS.map(f => (
              <button key={f.id} onClick={() => onDoneFilterChange(f.id)}
                style={{ padding: "3px 10px", borderRadius: "20px", border: `1px solid ${doneFilter === f.id ? col.color : "rgba(255,255,255,0.1)"}`, background: doneFilter === f.id ? `${col.color}22` : "transparent", color: doneFilter === f.id ? col.color : "#6b7280", fontSize: "10px", fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.15s" }}
              >{f.label}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "60vh" }}>
        <SortableList
          items={displayItems}
          columnId={col.id}
          color={col.color}
          onReorder={onReorder}
          onDelete={onDelete}
          onMove={onMove}
          allColumns={allColumns}
        />
      </div>
      <AddItemInput onAdd={(text) => onAdd(col.id, text)} disabled={atMax} />
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────
const STORAGE_KEY  = "wtl-items-v1";
const PREFS_KEY    = "wtl-prefs-v1";

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return INITIAL_ITEMS;
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { doneFilter: "week", showInbox: false };
}

export default function WeeklyTruthList() {
  const [items,      setItems]      = useState(loadItems);
  const [doneFilter, setDoneFilter] = useState(() => loadPrefs().doneFilter);
  const [showInbox,  setShowInbox]  = useState(() => loadPrefs().showInbox);
  const [saveFlash,  setSaveFlash]  = useState(false);

  // Persist items whenever they change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (_) {}
    // Brief "saved" flash
    setSaveFlash(true);
    const t = setTimeout(() => setSaveFlash(false), 900);
    return () => clearTimeout(t);
  }, [items]);

  // Persist UI prefs
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ doneFilter, showInbox })); } catch (_) {}
  }, [doneFilter, showInbox]);

  const clearAllData = () => {
    if (window.confirm("Clear all data and reset to sample items?")) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PREFS_KEY);
      setItems(INITIAL_ITEMS);
      setDoneFilter("week");
      setShowInbox(false);
    }
  };

  const addItem = (columnId, text) => {
    const col = ALL_COLUMNS.find(c => c.id === columnId);
    if (col?.maxItems && items[columnId].length >= col.maxItems) return;
    setItems(prev => ({ ...prev, [columnId]: [...prev[columnId], { id: generateId(), text, createdAt: new Date().toISOString() }] }));
  };

  const deleteItem = (columnId, itemId) => {
    setItems(prev => ({ ...prev, [columnId]: prev[columnId].filter(i => i.id !== itemId) }));
  };

  const moveItem = (itemId, fromCol, toCol) => {
    const targetDef = ALL_COLUMNS.find(c => c.id === toCol);
    if (targetDef?.maxItems && items[toCol].length >= targetDef.maxItems) return;
    const item = items[fromCol].find(i => i.id === itemId);
    if (!item) return;
    const now = new Date().toISOString();
    setItems(prev => ({
      ...prev,
      [fromCol]: prev[fromCol].filter(i => i.id !== itemId),
      [toCol]: [...prev[toCol], {
        ...item,
        completedAt:   toCol === "done" ? now       : undefined,
        completedFrom: toCol === "done" ? fromCol   : undefined,
      }],
    }));
  };

  const reorderItems = useCallback((columnId, newOrder) => {
    setItems(prev => ({ ...prev, [columnId]: newOrder }));
  }, []);

  const weekLabel = getWeekStart().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const inboxCount = items.inbox.length;
  const visibleCols = showInbox ? ALL_COLUMNS : COLUMNS;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f17", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d2d3d; border-radius: 4px; }
        input::placeholder { color: #374151 !important; }
        @keyframes slideIn { from { opacity:0; transform:translateX(-14px); } to { opacity:1; transform:translateX(0); } }
        .inbox-enter { animation: slideIn 0.2s ease; }
        @media (max-width: 700px) {
          .wtl-columns > div { max-width: 100% !important; flex: 1 1 auto !important; }
          .wtl-columns { flex-direction: column !important; }
          .wtl-header { padding: 20px 16px 0 !important; }
          .wtl-body   { padding: 12px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="wtl-header" style={{ padding: "28px 32px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontFamily: "'DM Mono', monospace", fontWeight: "600", fontSize: "clamp(17px, 3.5vw, 24px)", color: "#f1f5f9", margin: "0 0 4px", letterSpacing: "-0.01em" }}>Weekly Truth List</h1>
          <p style={{ color: "#374151", fontSize: "11px", margin: 0, fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em" }}>Week of {weekLabel}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Inbox toggle */}
          <button onClick={() => setShowInbox(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: showInbox ? "rgba(148,163,184,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${showInbox ? "rgba(148,163,184,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: "8px", padding: "6px 12px", cursor: "pointer", transition: "all 0.18s" }}>
            <span style={{ fontSize: "12px" }}>📥</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: showInbox ? "#94a3b8" : "#6b7280", letterSpacing: "0.06em" }}>{showInbox ? "Hide Inbox" : "Show Inbox"}</span>
            {inboxCount > 0 && <span style={{ background: showInbox ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.15)", color: "#94a3b8", borderRadius: "20px", fontSize: "10px", padding: "1px 6px", fontFamily: "'DM Mono', monospace", fontWeight: "600" }}>{inboxCount}</span>}
          </button>
          {/* Status pill */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "6px 12px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "#6b7280" }}>{items.active.length} active · {items.done.length} done</span>
          </div>
          {/* Save indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", transition: "opacity 0.3s", opacity: saveFlash ? 1 : 0.3 }}>
            <span style={{ fontSize: "10px" }}>{saveFlash ? "💾" : "🔒"}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: saveFlash ? "#6ee7b7" : "#374151", transition: "color 0.3s" }}>{saveFlash ? "saved" : "local"}</span>
          </div>
          {/* Clear data */}
          <button onClick={clearAllData}
            title="Clear all data"
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", color: "#374151", fontSize: "11px", fontFamily: "'DM Mono', monospace", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#374151"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
          >reset</button>
        </div>
      </div>

      {/* Columns */}
      <div className="wtl-body" style={{ padding: "0 32px 32px" }}>
        <div className="wtl-columns" style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px", alignItems: "flex-start" }}>
          {showInbox && (
            <div className="inbox-enter" style={{ display: "contents" }}>
              <InboxColumn items={items.inbox} onAdd={addItem} onDelete={deleteItem} onMove={moveItem} onReorder={reorderItems} allColumns={visibleCols} />
            </div>
          )}
          {COLUMNS.map(col => (
            <Column key={col.id} col={col} items={items[col.id]} onAdd={addItem} onDelete={deleteItem} onMove={moveItem} onReorder={reorderItems} allColumns={visibleCols} doneFilter={doneFilter} onDoneFilterChange={setDoneFilter} />
          ))}
        </div>
      </div>
    </div>
  );
}
