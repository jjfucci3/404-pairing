import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force-3d';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function GraphView({ knownPairs, allNames }) {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [excludedNames, setExcludedNames] = useState(new Set());
  const [excludeInput, setExcludeInput] = useState('');
  const [excludeSuggestions, setExcludeSuggestions] = useState([]);

  // Measure container
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(500, Math.min(700, window.innerHeight - 220)),
        });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Callback ref — sets forces the instant the component mounts
  const graphRef = useCallback((el) => {
    fgRef.current = el;
    if (!el) return;
    el.d3Force('charge')?.strength(-300);
    el.d3Force('link')?.distance(80).strength(0.5);
    el.d3Force('center')?.strength(0.05);
    el.d3Force('collide', forceCollide(15).iterations(3));
  }, []);

  // Rebuild graph data only when pairs/exclusions change
  const graphData = useMemo(() => {
    const activePairs = knownPairs.filter(
      ([a, b]) => !excludedNames.has(a) && !excludedNames.has(b)
    );
    const connected = new Set(activePairs.flat());
    return {
      nodes: allNames.filter(n => connected.has(n)).map(n => ({ id: n })),
      links: activePairs.map(([a, b]) => ({ source: a, target: b })),
    };
  }, [knownPairs, allNames, excludedNames]);

  const degreeMap = useMemo(() => {
    const m = {};
    for (const { source, target } of graphData.links) {
      const s = typeof source === 'object' ? source.id : source;
      const t = typeof target === 'object' ? target.id : target;
      m[s] = (m[s] || 0) + 1;
      m[t] = (m[t] || 0) + 1;
    }
    return m;
  }, [graphData]);

  const activeNode = selectedNode || hoveredNode;

  const connectedIds = useMemo(() => {
    const s = new Set();
    if (!activeNode) return s;
    s.add(activeNode);
    for (const [a, b] of knownPairs) {
      if (a === activeNode) s.add(b);
      if (b === activeNode) s.add(a);
    }
    return s;
  }, [activeNode, knownPairs]);

  const nodeRadius = useCallback((node) => {
    const degree = degreeMap[node.id] || 1;
    return Math.max(9, Math.min(13, 8 + degree * 0.35));
  }, [degreeMap]);

  // Paint nodes: circles with initials, subtly sized by connection count
  const paintNode = useCallback((node, ctx) => {
    const r = nodeRadius(node);
    const isActive = !activeNode || connectedIds.has(node.id);
    const isSelected = node.id === activeNode;

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected
      ? '#a78bfa'
      : isActive
      ? 'rgba(167,139,250,0.18)'
      : 'rgba(100,80,180,0.05)';
    ctx.fill();
    ctx.strokeStyle = isSelected
      ? '#c4b5fd'
      : isActive
      ? 'rgba(167,139,250,0.5)'
      : 'rgba(167,139,250,0.1)';
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.stroke();

    const fs = Math.max(5, Math.round(r * 0.6));
    ctx.font = `600 ${fs}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isSelected
      ? '#0d0d0d'
      : isActive
      ? 'rgba(240,240,240,0.85)'
      : 'rgba(240,240,240,0.18)';
    ctx.fillText(getInitials(node.id), node.x, node.y);
  }, [activeNode, connectedIds, nodeRadius]);

  const paintNodePointerArea = useCallback((node, color, ctx) => {
    const r = nodeRadius(node);
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, [nodeRadius]);

  const getLinkColor = useCallback((link) => {
    if (!activeNode) return 'rgba(167,139,250,0.2)';
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return connectedIds.has(s) && connectedIds.has(t)
      ? 'rgba(167,139,250,0.7)'
      : 'rgba(167,139,250,0.03)';
  }, [activeNode, connectedIds]);

  const getLinkWidth = useCallback((link) => {
    if (!activeNode) return 1;
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return connectedIds.has(s) && connectedIds.has(t) ? 2 : 0.3;
  }, [activeNode, connectedIds]);

  // Zoom to fit once simulation settles
  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(600, 60);
  }, []);

  // Re-apply forces and re-fit whenever graphData changes (exclusion toggled)
  useEffect(() => {
    const el = fgRef.current;
    if (!el) return;
    el.d3Force('charge')?.strength(-300);
    el.d3Force('link')?.distance(80).strength(0.5);
    el.d3Force('center')?.strength(0.05);
    el.d3Force('collide', forceCollide(15).iterations(3));
    el.d3ReheatSimulation();
  }, [graphData]);

  // --- Exclusion filter ---
  function handleExcludeInput(e) {
    const val = e.target.value;
    setExcludeInput(val);
    setExcludeSuggestions(
      val.trim()
        ? allNames.filter(n =>
            !excludedNames.has(n) &&
            n.toLowerCase().includes(val.toLowerCase())
          ).slice(0, 6)
        : []
    );
  }

  function addExclusion(name) {
    setExcludedNames(prev => new Set([...prev, name]));
    setExcludeInput('');
    setExcludeSuggestions([]);
    setSelectedNode(null);
  }

  function removeExclusion(name) {
    setExcludedNames(prev => { const n = new Set(prev); n.delete(name); return n; });
  }

  if (graphData.nodes.length === 0) {
    return <div className="graph-empty">No relationships to visualise yet.</div>;
  }

  return (
    <div className="graph-wrapper">
      <div className="graph-filter-bar">
        <div className="graph-filter-input-wrap">
          <input
            type="text"
            className="graph-filter-input"
            placeholder="Hide a person from graph…"
            value={excludeInput}
            onChange={handleExcludeInput}
            autoComplete="off"
          />
          {excludeSuggestions.length > 0 && (
            <ul className="graph-filter-suggestions">
              {excludeSuggestions.map(n => (
                <li key={n} onMouseDown={() => addExclusion(n)}>{n}</li>
              ))}
            </ul>
          )}
        </div>
        {[...excludedNames].map(name => (
          <span key={name} className="exclusion-chip">
            {name}
            <button onClick={() => removeExclusion(name)}>✕</button>
          </span>
        ))}
      </div>

      <div className="graph-container" ref={containerRef}>
        {activeNode && (
          <div className="graph-tooltip">
            <strong>{activeNode}</strong>
            <span>{degreeMap[activeNode] || 0} connection{degreeMap[activeNode] !== 1 ? 's' : ''}</span>
            {selectedNode && (
              <button className="graph-deselect" onClick={() => setSelectedNode(null)}>✕</button>
            )}
          </div>
        )}
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#0d0d0d"
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={paintNodePointerArea}
          nodeRelSize={1}
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          onNodeHover={node => setHoveredNode(node ? node.id : null)}
          onNodeClick={node => setSelectedNode(prev => prev === node.id ? null : node.id)}
          onBackgroundClick={() => setSelectedNode(null)}
          nodeLabel={(node) =>
            selectedNode && node.id !== selectedNode && connectedIds.has(node.id)
              ? node.id
              : ''
          }
          warmupTicks={80}
          cooldownTicks={100}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.25}
          onEngineStop={handleEngineStop}
          enableNodeDrag
          enableZoomInteraction
        />
      </div>
    </div>
  );
}
