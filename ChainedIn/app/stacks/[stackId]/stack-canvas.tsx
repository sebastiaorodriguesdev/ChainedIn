"use client";
import { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  Position,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ECOSYSTEM_LABELS, SEVERITY_COLORS, worstSeverity } from "@/lib/utils";
import { SeverityRow } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Search, X, Package, AlertTriangle } from "lucide-react";
import Link from "next/link";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CveData { severity: string; cvssScore: number | null }
interface SoftwareVersion {
  id: string; version: string;
  software: { name: string; slug: string; ecosystem: string };
  cveCache: CveData[];
}
interface RawNode {
  id: string; positionX: number; positionY: number;
  softwareVersionId: string | null;
  softwareVersion: SoftwareVersion | null;
  freeformName: string | null; freeformVersion: string | null; freeformEcosystem: string | null;
}
interface RawEdge { id: string; sourceId: string; targetId: string }
interface Stack {
  id: string; name: string; description: string | null;
  nodes: RawNode[]; edges: RawEdge[];
}

// ─── Custom Node ──────────────────────────────────────────────────────────────

type NodeData = {
  label: string; version: string; ecosystem: string;
  cves: CveData[]; isLinked: boolean;
  onDelete: (id: string) => void;
  nodeId: string;
};

function DepNode({ data, id }: NodeProps & { data: NodeData }) {
  const worst = worstSeverity(data.cves.map(c => c.severity));
  const borderColor = data.cves.length > 0 ? (SEVERITY_COLORS[worst] ?? "#888") : "#d1d5db";

  return (
    <div
      className="rounded-lg bg-white shadow-md border-2 p-3 min-w-[180px] max-w-[220px]"
      style={{ borderColor }}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {data.isLinked ? (
            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          )}
          <span className="font-semibold text-sm truncate">{data.label}</span>
        </div>
        <button
          onClick={() => data.onDelete(id)}
          className="text-muted-foreground hover:text-destructive shrink-0 -mt-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="font-mono text-xs text-muted-foreground">{data.version}</span>
        <span className="text-xs bg-muted px-1 rounded">{ECOSYSTEM_LABELS[data.ecosystem] ?? data.ecosystem}</span>
      </div>
      {data.cves.length > 0 ? (
        <SeverityRow cves={data.cves} />
      ) : (
        <span className="text-xs text-muted-foreground">{data.isLinked ? "No CVE data" : "Unknown package"}</span>
      )}
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
}

const nodeTypes = { dep: DepNode };

// ─── Main Canvas ──────────────────────────────────────────────────────────────

export function StackCanvas({ stack }: { stack: Stack }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toFlowNode(raw: RawNode, onDelete: (id: string) => void): Node {
    const sv = raw.softwareVersion;
    return {
      id: raw.id,
      type: "dep",
      position: { x: raw.positionX, y: raw.positionY },
      data: {
        label: sv ? sv.software.name : raw.freeformName ?? "?",
        version: sv ? sv.version : raw.freeformVersion ?? "?",
        ecosystem: sv ? sv.software.ecosystem : raw.freeformEcosystem ?? "other",
        cves: sv ? sv.cveCache : [],
        isLinked: !!sv,
        onDelete,
        nodeId: raw.id,
      },
    };
  }

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [ecoFilter, setEcoFilter] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; slug: string; ecosystem: string; versions: SoftwareVersion[] }>>([]);
  const [searching, setSearching] = useState(false);
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);
  const [freeform, setFreeform] = useState({ name: "", version: "", ecosystem: "npm" });
  const [addTab, setAddTab] = useState<"search" | "freeform">("search");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelete = useCallback(async (nodeId: string) => {
    await fetch(`/api/stacks/${stack.id}/nodes/${nodeId}`, { method: "DELETE" });
    setNodes(prev => prev.filter(n => n.id !== nodeId));
  }, [stack.id, setNodes]);

  useEffect(() => {
    setNodes(stack.nodes.map(n => toFlowNode(n, handleDelete)));
    setEdges(stack.edges.map(e => ({ id: e.id, source: e.sourceId, target: e.targetId, animated: true })));
  }, [stack, handleDelete]);

  // Update node positions after drag (debounced)
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetch(`/api/stacks/${stack.id}/nodes/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y }),
        });
      }, 500);
    },
    [stack.id]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      const res = await fetch(`/api/stacks/${stack.id}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: connection.source, targetId: connection.target }),
      });
      if (res.ok) {
        const newEdge = await res.json();
        setEdges(eds => addEdge({ ...connection, id: newEdge.id, animated: true }, eds));
      }
    },
    [stack.id, setEdges]
  );

  const onEdgeDoubleClick = useCallback(
    async (_: React.MouseEvent, edge: Edge) => {
      await fetch(`/api/stacks/${stack.id}/edges/${edge.id}`, { method: "DELETE" });
      setEdges(eds => eds.filter(e => e.id !== edge.id));
    },
    [stack.id, setEdges]
  );

  const fetchSoftware = useCallback(async (q: string, eco: string) => {
    setSearching(true);
    const params = new URLSearchParams({ withVersions: "1" });
    if (q) params.set("q", q);
    if (eco) params.set("ecosystem", eco);
    const res = await fetch(`/api/software?${params}`);
    const data = await res.json();
    setSearchResults(data);
    setSearching(false);
  }, []);

  // Trigger search whenever query or ecosystem filter changes
  useEffect(() => {
    if (addTab !== "search") return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchSoftware(searchQ, ecoFilter), 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQ, ecoFilter, addTab, fetchSoftware]);

  // Load all packages when search tab opens; reset filters when panel closes
  useEffect(() => {
    if (showAddPanel && addTab === "search") {
      fetchSoftware(searchQ, ecoFilter);
    }
    if (!showAddPanel) {
      setSearchQ("");
      setEcoFilter("");
      setExpandedPkg(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddPanel, addTab]);

  async function addLinkedNode(softwareVersionId: string, version: SoftwareVersion) {
    const pos = { positionX: 100 + nodes.length * 30, positionY: 100 + nodes.length * 30 };
    const res = await fetch(`/api/stacks/${stack.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ softwareVersionId, ...pos }),
    });
    if (res.ok) {
      const node = await res.json();
      setNodes(prev => [...prev, toFlowNode(node, handleDelete)]);
      setExpandedPkg(null);
      setShowAddPanel(false);
    }
  }

  async function addFreeformNode() {
    if (!freeform.name || !freeform.version) return;
    const pos = { positionX: 100 + nodes.length * 30, positionY: 100 + nodes.length * 30 };
    const res = await fetch(`/api/stacks/${stack.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeformName: freeform.name, freeformVersion: freeform.version, freeformEcosystem: freeform.ecosystem, ...pos }),
    });
    if (res.ok) {
      const node = await res.json();
      setNodes(prev => [...prev, toFlowNode(node, handleDelete)]);
      setFreeform({ name: "", version: "", ecosystem: "npm" });
      setShowAddPanel(false);
    }
  }

  // Exposure summary
  const allCves = nodes.flatMap(n => (n.data as NodeData).cves as CveData[]);
  const exposureCounts: Record<string, number> = {};
  for (const c of allCves) {
    exposureCounts[c.severity] = (exposureCounts[c.severity] ?? 0) + 1;
  }
  const worstExp = worstSeverity(allCves.map(c => c.severity));
  const expColor = allCves.length > 0 ? (SEVERITY_COLORS[worstExp] ?? "#888") : "#16a34a";

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-background z-10">
        <Link href="/stacks">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Stacks</Button>
        </Link>
        <div>
          <span className="font-semibold">{stack.name}</span>
          {stack.description && <span className="text-sm text-muted-foreground ml-2">{stack.description}</span>}
        </div>
        <div className="flex-1" />
        {/* Exposure summary */}
        <div className="flex items-center gap-2 text-sm border rounded px-3 py-1" style={{ borderColor: expColor }}>
          <span className="font-medium" style={{ color: expColor }}>Exposure:</span>
          {allCves.length === 0 ? (
            <span className="text-green-600 text-xs">Clean</span>
          ) : (
            <>
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(s =>
                exposureCounts[s] ? (
                  <span key={s} className="text-xs font-semibold" style={{ color: SEVERITY_COLORS[s] }}>
                    {exposureCounts[s]} {s}
                  </span>
                ) : null
              )}
            </>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAddPanel(v => !v)}>
          <Plus className="h-4 w-4 mr-1" />Add node
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Add node panel */}
        {showAddPanel && (
          <div className="w-72 border-r bg-background overflow-y-auto p-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add dependency</h3>
              <button onClick={() => setShowAddPanel(false)}><X className="h-4 w-4" /></button>
            </div>

            <div className="flex gap-1 mb-4">
              <button
                className={`flex-1 py-1.5 text-sm rounded-md ${addTab === "search" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                onClick={() => setAddTab("search")}
              >
                Platform
              </button>
              <button
                className={`flex-1 py-1.5 text-sm rounded-md ${addTab === "freeform" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                onClick={() => setAddTab("freeform")}
              >
                Unknown
              </button>
            </div>

            {addTab === "search" ? (
              <div className="flex flex-col gap-3">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search packages…"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    className="pl-8"
                    autoFocus
                  />
                  {searchQ && (
                    <button
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setSearchQ("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Ecosystem filter chips */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { value: "", label: "All" },
                    { value: "npm",    label: "npm" },
                    { value: "pip",    label: "PyPI" },
                    { value: "maven",  label: "Maven" },
                    { value: "cargo",  label: "Cargo" },
                    { value: "go",     label: "Go" },
                    { value: "gem",    label: "RubyGems" },
                    { value: "nuget",  label: "NuGet" },
                    { value: "other",  label: "Other" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEcoFilter(opt.value)}
                      className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                        ecoFilter === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent border-input"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Results */}
                <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-18rem)]">
                  {searching && (
                    <p className="text-xs text-muted-foreground py-2 text-center">Searching…</p>
                  )}
                  {!searching && searchResults.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      No packages found. Try the <button className="underline" onClick={() => setAddTab("freeform")}>Unknown</button> tab.
                    </p>
                  )}
                  {!searching && searchResults.map(pkg => {
                    const isExpanded = expandedPkg === pkg.id;
                    return (
                      <div key={pkg.id} className="rounded-md border overflow-hidden">
                        {/* Package header row */}
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                          onClick={() => setExpandedPkg(isExpanded ? null : pkg.id)}
                        >
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pkg.name}</p>
                            <p className="text-xs text-muted-foreground">{ECOSYSTEM_LABELS[pkg.ecosystem] ?? pkg.ecosystem} · {pkg.versions.length} version{pkg.versions.length !== 1 ? "s" : ""}</p>
                          </div>
                          <span className={`text-muted-foreground text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                        </button>

                        {/* Version list (expanded) */}
                        {isExpanded && (
                          <div className="border-t bg-muted/20">
                            {pkg.versions.length === 0 && (
                              <p className="text-xs text-muted-foreground px-3 py-2">No versions published yet.</p>
                            )}
                            {pkg.versions.map((v: SoftwareVersion) => {
                              const worst = worstSeverity(v.cveCache.map(c => c.severity));
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => addLinkedNode(v.id, v)}
                                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-accent text-xs border-b last:border-b-0"
                                >
                                  <span className="font-mono">{v.version}</span>
                                  {v.cveCache.length > 0 ? (
                                    <span className="font-semibold" style={{ color: SEVERITY_COLORS[worst] }}>
                                      {v.cveCache.length} CVE
                                    </span>
                                  ) : (
                                    <span className="text-green-600">Clean</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Add a dependency not listed on ChainedIn.</p>
                <div className="space-y-2">
                  <Label>Package name</Label>
                  <Input value={freeform.name} onChange={e => setFreeform({...freeform, name: e.target.value})} placeholder="e.g. my-internal-lib" />
                </div>
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input value={freeform.version} onChange={e => setFreeform({...freeform, version: e.target.value})} placeholder="e.g. 1.0.0" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Ecosystem</Label>
                  <Select value={freeform.ecosystem} onValueChange={v => setFreeform({...freeform, ecosystem: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ECOSYSTEM_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={addFreeformNode} disabled={!freeform.name || !freeform.version}>
                  Add node
                </Button>
              </div>
            )}
          </div>
        )}

        {/* React Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onEdgeDoubleClick={onEdgeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
          >
            <Background />
            <Controls />
            <MiniMap nodeColor={(n) => {
              const d = n.data as NodeData;
              const w = worstSeverity((d.cves as CveData[]).map(c => c.severity));
              return d.cves.length > 0 ? (SEVERITY_COLORS[w] ?? "#888") : "#d1d5db";
            }} />
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="bg-background/80 rounded-lg border p-4 text-sm text-muted-foreground text-center">
                  Click <strong>Add node</strong> to start building your stack.
                  <br />
                  Connect nodes by dragging between handles. Double-click an edge to delete it.
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
