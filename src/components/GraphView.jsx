import { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function GraphView({ knownPairs, allNames }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

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

  // Build graph data — stable refs so the simulation doesn't restart on every render
  const connectedNames = new Set(knownPairs.flat());

  const graphData = useRef(null);
  if (!graphData.current) {
    graphData.current = {
      nodes: allNames
        .filter(name => connectedNames.has(name))
        .map(name => ({
          id: name,
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
        })),
      links: knownPairs.map(([a, b]) => ({ source: a, target: b })),
    };
  }

  // Connection count per node
  const degreeMap = {};
  for (const [a, b] of knownPairs) {
    degreeMap[a] = (degreeMap[a] || 0) + 1;
    degreeMap[b] = (degreeMap[b] || 0) + 1;
  }

  const activeNode = selectedNode || hoveredNode;

  const connectedIds = new Set();
  if (activeNode) {
    connectedIds.add(activeNode);
    for (const [a, b] of knownPairs) {
      if (a === activeNode) connectedIds.add(b);
      if (b === activeNode) connectedIds.add(a);
    }
  }

  const paintNode = useCallback((node, ctx, globalScale) => {
    const degree = degreeMap[node.id] || 1;
    const r = Math.max(4, Math.min(10, 3 + degree * 0.8));
    const label = node.id.split(' ')[0];
    const isActive = !activeNode || connectedIds.has(node.id);
    const isSelected = node.id === activeNode;

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isSelected ? '#a78bfa' : isActive ? '#c4b5fd' : 'rgba(100,80,180,0.2)';
    ctx.fill();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(167,139,250,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const fontSize = Math.max(9, Math.min(12, 9 / Math.max(0.5, globalScale * 0.5)));
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = isActive ? 'rgba(240,240,240,0.9)' : 'rgba(240,240,240,0.15)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, node.x, node.y + r + 2);
  }, [activeNode, connectedIds, degreeMap]);

  const getLinkColor = useCallback((link) => {
    if (!activeNode) return 'rgba(167,139,250,0.35)';
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return connectedIds.has(s) && connectedIds.has(t)
      ? 'rgba(167,139,250,0.8)'
      : 'rgba(167,139,250,0.04)';
  }, [activeNode, connectedIds]);

  const getLinkWidth = useCallback((link) => {
    if (!activeNode) return 1.5;
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return connectedIds.has(s) && connectedIds.has(t) ? 2.5 : 0.5;
  }, [activeNode, connectedIds]);

  function handleNodeClick(node) {
    setSelectedNode(prev => (prev === node.id ? null : node.id));
  }

  const zoomFit = useCallback(() => {
    graphRef.current?.zoomToFit(800, 50);
  }, []);

  const handleEngineStop = useCallback(() => {
    setTimeout(zoomFit, 50);
  }, [zoomFit]);

  useEffect(() => {
    // Belt-and-suspenders: fire zoomToFit at 1s and 3s
    const t1 = setTimeout(zoomFit, 1000);
    const t2 = setTimeout(zoomFit, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [zoomFit]);

  if (graphData.current.nodes.length === 0) {
    return <div className="graph-empty">No relationships to visualise yet.</div>;
  }

  return (
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
        graphData={graphData.current}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0d0d0d"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        onNodeHover={node => setHoveredNode(node ? node.id : null)}
        onNodeClick={handleNodeClick}
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
  );
}
