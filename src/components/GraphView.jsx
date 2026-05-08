import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function GraphView({ knownPairs, allNames }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [excludedNames, setExcludedNames] = useState(new Set());
  const [excludeInput, setExcludeInput] = useState('');
  const [excludeSuggestions, setExcludeSuggestions] = useState([]);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(480, Math.min(680, window.innerHeight - 240)),
        });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Rebuild graph data when pairs or exclusions change
  const graphData = useMemo(() => {
    const activePairs = knownPairs.filter(
      ([a, b]) => !excludedNames.has(a) && !excludedNames.has(b)
    );
    const connected = new Set(activePairs.flat());
    return {
      nodes: allNames
        .filter(n => connected.has(n))
        .map(n => ({ id: n })),
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

  const paintNode = useCallback((node, ctx, globalScale) => {
    const degree = degreeMap[node.id] || 1;
    const r = Math.max(14, Math.min(22, 12 + degree * 0.7));
    const isActive = !activeNode || connectedIds.has(node.id);
    const isSelected = node.id === activeNode;

    // Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected
      ? '#a78bfa'
      : isActive
      ? 'rgba(167,139,250,0.22)'
      : 'rgba(100,80,180,0.07)';
    ctx.fill();
    ctx.strokeStyle = isSelected
      ? '#c4b5fd'
      : isActive
      ? 'rgba(167,139,250,0.55)'
      : 'rgba(167,139,250,0.12)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Initials
    const fontSize = Math.max(8, Math.min(11, r * 0.55));
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isSelected
      ? '#0d0d0d'
      : isActive
      ? 'rgba(240,240,240,0.9)'
      : 'rgba(240,240,240,0.2)';
    ctx.fillText(getInitials(node.id), node.x, node.y);
  }, [activeNode, connectedIds, degreeMap]);

  const getLinkColor = useCallback((link) => {
    if (!activeNode) return 'rgba(167,139,250,0.3)';
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return connectedIds.has(s) && connectedIds.has(t)
      ? 'rgba(167,139,250,0.75)'
      : 'rgba(167,139,250,0.04)';
  }, [activeNode, connectedIds]);

  const getLinkWidth = useCallback((link) => {
    if (!activeNode) return 1.5;
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return connectedIds.has(s) && connectedIds.has(t) ? 2.5 : 0.5;
  }, [activeNode, connectedIds]);

  const zoomFit = useCallback(() => {
    graphRef.current?.zoomToFit(800, 50);
  }, []);

  const handleEngineStop = useCallback(() => {
    setTimeout(zoomFit, 100);
  }, [zoomFit]);

  useEffect(() => {
    const t = setTimeout(zoomFit, 2000);
    return () => clearTimeout(t);
  }, [zoomFit, graphData]);

  // Exclude filter helpers
  function handleExcludeInput(e) {
    const val = e.target.value;
    setExcludeInput(val);
    if (!val.trim()) { setExcludeSuggestions([]); return; }
    setExcludeSuggestions(
      allNames.filter(n =>
        !excludedNames.has(n) &&
        n.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6)
    );
  }

  function addExclusion(name) {
    setExcludedNames(prev => new Set([...prev, name]));
    setExcludeInput('');
    setExcludeSuggestions([]);
    setSelectedNode(null);
    setHoveredNode(null);
  }

  function removeExclusion(name) {
    setExcludedNames(prev => { const n = new Set(prev); n.delete(name); return n; });
  }

  if (graphData.nodes.length === 0) {
    return <div className="graph-empty">No relationships to visualise yet.</div>;
  }

  return (
    <div className="graph-wrapper">
      {/* Exclusion filter bar */}
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
          nodeRelSize={1}
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          onNodeHover={node => setHoveredNode(node ? node.id : null)}
          onNodeClick={node => setSelectedNode(prev => prev === node.id ? null : node.id)}
          onBackgroundClick={() => setSelectedNode(null)}
          nodeLabel={() => ''}
          cooldownTicks={200}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          onEngineStop={handleEngineStop}
          enableNodeDrag
          enableZoomInteraction
        />
      </div>
    </div>
  );
}
