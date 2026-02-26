import { useState, useCallback, useRef, useMemo, DragEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  Panel,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GlassPanel } from "@/components/GlassPanel";
import { ActionBadge, ActionType } from "@/components/ActionBadge";
import { FlowActionNode, StartNode, EndNode, type FlowActionData } from "@/components/FlowActionNode";
import { toast } from "sonner";
import {
  Save, Play, Plus, Trash2, Wand2, Variable, ArrowLeft, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";

interface EditorAction {
  id: string;
  type: ActionType;
  selector: string;
  value: string;
  timeout: number;
  optional: boolean;
}

const ACTION_LIBRARY: { category: string; actions: { type: ActionType; label: string; desc: string }[] }[] = [
  { category: "Navigation", actions: [
    { type: "navigate", label: "Navigate", desc: "Go to URL" },
    { type: "wait", label: "Wait for URL", desc: "Wait for URL pattern" },
    { type: "scroll", label: "Scroll", desc: "Scroll to element" },
  ]},
  { category: "Input", actions: [
    { type: "fill", label: "Fill Input", desc: "Type into field" },
    { type: "select", label: "Select Option", desc: "Choose dropdown" },
    { type: "checkbox", label: "Checkbox", desc: "Toggle checkbox" },
    { type: "radio", label: "Radio Button", desc: "Select radio option" },
    { type: "textarea", label: "Textarea", desc: "Fill multiline text" },
    { type: "upload", label: "File Upload", desc: "Upload a file" },
  ]},
  { category: "Interaction", actions: [
    { type: "click", label: "Click", desc: "Click element" },
    { type: "hover", label: "Hover", desc: "Hover over element" },
    { type: "drag", label: "Drag & Drop", desc: "Drag to target" },
    { type: "keypress", label: "Keypress", desc: "Press keyboard key" },
    { type: "screenshot", label: "Screenshot", desc: "Capture screenshot" },
  ]},
  { category: "Logic", actions: [
    { type: "condition", label: "Condition", desc: "If/else branching" },
    { type: "loop", label: "Loop", desc: "Repeat actions" },
    { type: "delay", label: "Delay", desc: "Wait fixed time" },
  ]},
  { category: "Advanced", actions: [
    { type: "function", label: "Function", desc: "Run custom JS" },
    { type: "api", label: "API Call", desc: "HTTP request" },
    { type: "extract", label: "Extract Data", desc: "Scrape element text" },
    { type: "assert", label: "Assert", desc: "Verify element" },
  ]},
];

const defaultActions: EditorAction[] = [
  { id: "1", type: "navigate", selector: "", value: "https://example.com/signup", timeout: 5000, optional: false },
  { id: "2", type: "fill", selector: "input#email", value: "{{USER_EMAIL}}", timeout: 5000, optional: false },
  { id: "3", type: "fill", selector: "input#password", value: "{{PASSWORD}}", timeout: 5000, optional: false },
  { id: "4", type: "click", selector: "button#submit", value: "", timeout: 5000, optional: false },
];

function actionsToNodes(actions: EditorAction[], isViewMode: boolean): Node[] {
  const nodes: Node[] = [
    { id: "start", type: "startNode", position: { x: 250, y: 0 }, data: {}, draggable: !isViewMode },
  ];
  actions.forEach((a, i) => {
    nodes.push({
      id: a.id,
      type: "actionNode",
      position: { x: 250, y: 100 + i * 120 },
      data: {
        actionId: a.id,
        type: a.type,
        selector: a.selector,
        value: a.value,
        timeout: a.timeout,
        optional: a.optional,
        isViewMode,
      } as FlowActionData,
      draggable: !isViewMode,
    });
  });
  nodes.push({
    id: "end",
    type: "endNode",
    position: { x: 250, y: 100 + actions.length * 120 },
    data: {},
    draggable: !isViewMode,
  });
  return nodes;
}

function actionsToEdges(actions: EditorAction[]): Edge[] {
  const edges: Edge[] = [];
  const ids = ["start", ...actions.map(a => a.id), "end"];
  for (let i = 0; i < ids.length - 1; i++) {
    edges.push({
      id: `e-${ids[i]}-${ids[i + 1]}`,
      source: ids[i],
      target: ids[i + 1],
      sourceHandle: "bottom",
      targetHandle: "top",
      type: "smoothstep",
      animated: true,
      style: { stroke: "hsl(190 100% 50% / 0.4)", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(190 100% 50% / 0.5)" },
    });
  }
  return edges;
}

const nodeTypes = {
  actionNode: FlowActionNode,
  startNode: StartNode,
  endNode: EndNode,
};

const FlowCanvas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isViewMode = location.pathname.endsWith("/view");
  const isCreateMode = location.pathname.endsWith("/create");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [name, setName] = useState(isCreateMode ? "Untitled Blueprint" : "New Blueprint");
  const [actionsData, setActionsData] = useState<EditorAction[]>(isCreateMode ? [] : defaultActions);
  const [variables, setVariables] = useState<{ name: string; defaultValue: string; type: string }[]>([
    { name: "USER_EMAIL", defaultValue: "test@example.com", type: "text" },
    { name: "PASSWORD", defaultValue: "S3cureP@ss!", type: "secret" },
    { name: "MAX_RETRIES", defaultValue: "3", type: "number" },
    { name: "HEADLESS", defaultValue: "true", type: "boolean" },
  ]);

  const initialNodes = useMemo(() => actionsToNodes(actionsData, isViewMode), []);
  const initialEdges = useMemo(() => actionsToEdges(actionsData), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const syncNodesFromActions = useCallback((newActions: EditorAction[]) => {
    setActionsData(newActions);
    setNodes(actionsToNodes(newActions, isViewMode));
    setEdges(actionsToEdges(newActions));
  }, [isViewMode, setNodes, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({
      ...connection,
      type: "smoothstep",
      animated: true,
      style: { stroke: "hsl(190 100% 50% / 0.4)", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(190 100% 50% / 0.5)" },
    }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === "start" || node.id === "end") {
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    const deletedIds = deletedNodes
      .filter(n => n.id !== "start" && n.id !== "end")
      .map(n => n.id);
    if (deletedIds.length === 0) return;
    const updated = actionsData.filter(a => !deletedIds.includes(a.id));
    syncNodesFromActions(updated);
    if (selectedNodeId && deletedIds.includes(selectedNodeId)) setSelectedNodeId(null);
    toast.success(`Deleted ${deletedIds.length} action(s)`);
  }, [actionsData, selectedNodeId, syncNodesFromActions]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (isViewMode) return;
    setEdges(eds => eds.filter(e => e.id !== edge.id));
    toast.success("Connection removed");
  }, [isViewMode, setEdges]);

  const addAction = useCallback((type: ActionType, position?: { x: number; y: number }) => {
    const newId = Date.now().toString();
    const newAction: EditorAction = {
      id: newId, type, selector: "", value: "", timeout: 5000, optional: false,
    };
    const updated = [...actionsData, newAction];
    setActionsData(updated);

    const newNode: Node = {
      id: newId,
      type: "actionNode",
      position: position || { x: 250, y: 100 + (actionsData.length) * 120 },
      data: {
        actionId: newId, type, selector: "", value: "", timeout: 5000, optional: false, isViewMode,
      } as FlowActionData,
      draggable: !isViewMode,
    };

    setNodes(prev => {
      const withoutEnd = prev.filter(n => n.id !== "end");
      const endNode = prev.find(n => n.id === "end");
      return [
        ...withoutEnd,
        newNode,
        { ...endNode!, position: position ? { x: position.x, y: position.y + 120 } : { x: 250, y: 100 + updated.length * 120 } },
      ];
    });
    setEdges(actionsToEdges(updated));
    setSelectedNodeId(newId);
  }, [actionsData, isViewMode, setNodes, setEdges]);

  const removeAction = useCallback((id: string) => {
    const updated = actionsData.filter(a => a.id !== id);
    syncNodesFromActions(updated);
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [actionsData, selectedNodeId, syncNodesFromActions]);

  const updateAction = useCallback((id: string, updates: Partial<EditorAction>) => {
    const updated = actionsData.map(a => a.id === id ? { ...a, ...updates } : a);
    setActionsData(updated);
    setNodes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const action = updated.find(a => a.id === id)!;
      return {
        ...n,
        data: {
          actionId: action.id,
          type: action.type,
          selector: action.selector,
          value: action.value,
          timeout: action.timeout,
          optional: action.optional,
          isViewMode,
        } as FlowActionData,
      };
    }));
  }, [actionsData, isViewMode, setNodes]);

  const selected = actionsData.find(a => a.id === selectedNodeId);

  const saveDraft = useCallback(() => {
    localStorage.setItem(`blueprint-draft-${name}`, JSON.stringify({ name, actions: actionsData, variables }));
    toast.success(`Blueprint "${name}" saved as draft`);
  }, [name, actionsData, variables]);

  const saveAndRun = useCallback(() => {
    saveDraft();
    toast.success(`Blueprint "${name}" saved. Navigating to execute...`);
  }, [saveDraft, name]);

  // Drag from library
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow") as ActionType;
    if (!type) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addAction(type, position);
  }, [screenToFlowPosition, addAction]);

  const onDragStart = useCallback((event: DragEvent, actionType: ActionType) => {
    event.dataTransfer.setData("application/reactflow", actionType);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/blueprints")}
            className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-muted-foreground/30">|</span>
          {isViewMode ? (
            <h1 className="font-mono text-lg font-bold text-foreground">{name}</h1>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent font-mono text-lg font-bold text-foreground outline-none border-b border-transparent hover:border-glass-border focus:border-primary/40 transition-colors"
            />
          )}
          {isViewMode && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-muted/20 text-muted-foreground border border-glass-border">View Only</span>
          )}
        </div>
        {!isViewMode && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-muted-foreground">Auto-saved 2m ago</span>
            <button onClick={saveDraft} className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs border border-glass-border text-muted-foreground hover:text-foreground transition-colors">
              <Save className="w-3 h-3" /> Save Draft
            </button>
            <button onClick={saveAndRun} className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors">
              <Play className="w-3 h-3" /> Save & Run
            </button>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="flex-1 grid lg:grid-cols-[220px_1fr_280px] gap-4 min-h-0">
        {/* Left Panel - Action Library */}
        {!isViewMode && (
          <GlassPanel glow="none" className="p-3 overflow-y-auto space-y-3">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">Action Library</span>
            <p className="font-mono text-[9px] text-muted-foreground/60">Drag actions onto the canvas</p>
            {ACTION_LIBRARY.map((cat) => (
              <div key={cat.category}>
                <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{cat.category}</span>
                <div className="mt-1.5 space-y-1">
                  {cat.actions.map((action) => (
                    <div
                      key={action.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, action.type)}
                      onClick={() => addAction(action.type)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-muted/20 transition-colors group cursor-grab active:cursor-grabbing"
                    >
                      <ActionBadge type={action.type} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] text-foreground/80 group-hover:text-foreground truncate">{action.label}</div>
                        <div className="font-mono text-[9px] text-muted-foreground truncate">{action.desc}</div>
                      </div>
                      <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </GlassPanel>
        )}

        {/* Center - React Flow Canvas */}
        <div
          ref={reactFlowWrapper}
          className={`rounded-2xl border border-glass-border overflow-hidden bg-[hsl(var(--glass-bg))] ${isViewMode ? "lg:col-span-2" : ""}`}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={!isViewMode ? onNodesChange : undefined}
            onEdgesChange={!isViewMode ? onEdgesChange : undefined}
            onConnect={!isViewMode ? onConnect : undefined}
            onNodesDelete={!isViewMode ? onNodesDelete : undefined}
            onEdgeClick={onEdgeClick}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode={isViewMode ? null : "Delete"}
            proOptions={{ hideAttribution: true }}
            className="blueprint-flow"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="hsl(215 20% 25%)"
            />
            <Controls
              showInteractive={false}
              className="!bg-[hsl(var(--glass-bg))] !border-glass-border !rounded-xl !shadow-lg [&>button]:!bg-transparent [&>button]:!border-glass-border [&>button]:!text-muted-foreground [&>button:hover]:!text-foreground"
            />
            <Panel position="top-right" className="flex gap-2">
              <span className="font-mono text-[10px] text-muted-foreground bg-[hsl(var(--glass-bg))] px-3 py-1.5 rounded-lg border border-glass-border">
                {actionsData.length} actions
              </span>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Panel - Properties & Variables */}
        <div className="space-y-4 overflow-y-auto">
          {selected ? (
            <GlassPanel glow="none" className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wand2 className="w-4 h-4 text-secondary" />
                <h3 className="font-mono text-sm font-semibold tracking-wider uppercase text-secondary">Properties</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Action Type</label>
                  <select
                    value={selected.type}
                    disabled={isViewMode}
                    onChange={(e) => updateAction(selected.id, { type: e.target.value as ActionType })}
                    className="w-full bg-muted/20 border border-glass-border rounded-xl px-3 py-2.5 font-mono text-xs text-foreground outline-none cursor-pointer disabled:opacity-60"
                  >
                    {["navigate","fill","click","select","wait","assert","screenshot","upload","scroll","hover","drag","keypress","checkbox","radio","textarea","condition","loop","function","api","delay","extract","custom"].map(t => (
                      <option key={t} className="bg-background" value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Selector</label>
                  <input
                    value={selected.selector}
                    disabled={isViewMode}
                    onChange={(e) => updateAction(selected.id, { selector: e.target.value })}
                    placeholder="e.g. input#email, button.submit"
                    className="w-full bg-muted/20 border border-glass-border rounded-xl px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Value</label>
                  <input
                    value={selected.value}
                    disabled={isViewMode}
                    onChange={(e) => updateAction(selected.id, { value: e.target.value })}
                    placeholder="Value or {{VARIABLE}}"
                    className="w-full bg-muted/20 border border-glass-border rounded-xl px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Timeout: {selected.timeout}ms</label>
                  <input
                    type="range" min={1000} max={30000} step={1000}
                    value={selected.timeout}
                    disabled={isViewMode}
                    onChange={(e) => updateAction(selected.id, { timeout: parseInt(e.target.value) })}
                    className="w-full h-1 bg-muted/40 rounded-full appearance-none accent-primary disabled:opacity-60"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={selected.optional}
                    disabled={isViewMode}
                    onChange={(e) => updateAction(selected.id, { optional: e.target.checked })}
                    className="accent-primary"
                  />
                  <span className="font-mono text-xs text-muted-foreground">Optional (skip on failure)</span>
                </label>
                {!isViewMode && (
                  <button
                    onClick={() => removeAction(selected.id)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-mono text-xs border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors mt-2"
                  >
                    <Trash2 className="w-3 h-3" /> Delete Action
                  </button>
                )}
              </div>
            </GlassPanel>
          ) : (
            <GlassPanel glow="none" className="p-6 flex flex-col items-center justify-center text-center">
              <Wand2 className="w-6 h-6 text-muted-foreground/30 mb-2" />
              <p className="font-mono text-xs text-muted-foreground">Click a node to {isViewMode ? "view" : "edit"} properties</p>
            </GlassPanel>
          )}

          {/* Variables */}
          <GlassPanel glow="none" className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Variable className="w-4 h-4 text-primary" />
              <h3 className="font-mono text-[10px] font-semibold tracking-wider uppercase text-primary">Variables</h3>
            </div>
            <div className="space-y-2.5 overflow-hidden">
              {variables.map((v, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] min-w-0">
                    <input
                      value={v.name}
                      disabled={isViewMode}
                      onChange={(e) => {
                        const updated = [...variables];
                        updated[i].name = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "");
                        setVariables(updated);
                      }}
                      className="w-20 shrink-0 bg-muted/20 border border-glass-border rounded-lg px-2 py-1.5 text-secondary outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
                    />
                    <select
                      value={v.type}
                      disabled={isViewMode}
                      onChange={(e) => {
                        const updated = [...variables];
                        updated[i].type = e.target.value;
                        setVariables(updated);
                      }}
                      className="w-[72px] shrink-0 bg-muted/20 border border-glass-border rounded-lg px-1.5 py-1.5 text-[10px] text-foreground/70 outline-none cursor-pointer disabled:opacity-60"
                    >
                      {["text", "number", "boolean", "secret", "list", "json", "file", "date", "url"].map(t => (
                        <option key={t} className="bg-background" value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      value={v.defaultValue}
                      disabled={isViewMode}
                      type={v.type === "secret" ? "password" : v.type === "number" ? "number" : "text"}
                      placeholder={v.type === "boolean" ? "true / false" : v.type === "list" ? "a, b, c" : v.type === "json" ? '{"key": "val"}' : "Default"}
                      onChange={(e) => {
                        const updated = [...variables];
                        updated[i].defaultValue = e.target.value;
                        setVariables(updated);
                      }}
                      className="flex-1 min-w-0 bg-muted/20 border border-glass-border rounded-lg px-2 py-1.5 text-foreground/70 outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
                    />
                    {!isViewMode && (
                      <button
                        onClick={() => setVariables(variables.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!isViewMode && (
                <button
                  onClick={() => setVariables([...variables, { name: "NEW_VAR", defaultValue: "", type: "text" }])}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg border border-dashed border-glass-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors font-mono text-[10px]"
                >
                  <Plus className="w-3 h-3" /> Add Variable
                </button>
              )}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
};

const BlueprintEditor = () => (
  <ReactFlowProvider>
    <FlowCanvas />
  </ReactFlowProvider>
);

export default BlueprintEditor;
