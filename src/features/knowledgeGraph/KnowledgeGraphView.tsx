import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, KnowledgeGraph } from './KnowledgeGraphService';
import './KnowledgeGraphView.css';

interface KnowledgeGraphViewProps {
  workspacePath: string;
  onNodeClick?: (node: GraphNode) => void;
}

interface D3Node extends GraphNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link {
  source: D3Node | string;
  target: D3Node | string;
  type: 'link' | 'reference' | 'tag' | 'folder';
  strength: number;
}

const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({ 
  workspacePath,
  onNodeClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setSelectedNode] = useState<string | null>(null); // For future use
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'notes' | 'tags' | 'folders'>('all');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [stats, setStats] = useState<KnowledgeGraph['stats'] | null>(null);

  // Load graph data
  useEffect(() => {
    loadGraphData();
  }, [workspacePath]);

  const loadGraphData = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.knowledgeGraph?.buildGraph(workspacePath);
      if (result?.success && result.graph) {
        setGraphData(result.graph);
        setStats(result.graph.stats);
      }
    } catch (error) {
      console.error('Error loading knowledge graph:', error);
    } finally {
      setLoading(false);
    }
  };

  // Render D3 graph
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    renderGraph();
  }, [graphData, filterType, searchTerm]);

  const renderGraph = () => {
    if (!svgRef.current || !graphData) return;

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    // Filter nodes based on search and type
    const filteredNodes = graphData.nodes.filter(node => {
      const matchesSearch = !searchTerm || 
        node.label.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || 
        (filterType === 'notes' && node.type === 'note') ||
        (filterType === 'tags' && node.type === 'tag') ||
        (filterType === 'folders' && node.type === 'folder');
      return matchesSearch && matchesType;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.links.filter(
      link => nodeIds.has(link.source as string) && nodeIds.has(link.target as string)
    );

    // Setup dimensions
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Create container for zoom/pan
    const container = svg.append('g');

    // Create force simulation
    const simulation = d3.forceSimulation<D3Node>(filteredNodes as D3Node[])
      .force('link', d3.forceLink<D3Node, D3Link>(filteredLinks as D3Link[])
        .id(d => d.id)
        .distance(d => 50 * (2 - (d as D3Link).strength))
        .strength(d => (d as D3Link).strength))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => (d as D3Node).size + 5));

    // Create links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(filteredLinks)
      .join('line')
      .attr('class', d => `link link-${d.type}`)
      .attr('stroke-width', d => Math.sqrt(d.strength * 3));

    // Create nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(filteredNodes as D3Node[])
      .join('g')
      .attr('class', d => `node node-${d.type}`)
      .call(d3.drag<SVGGElement, D3Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => getNodeColor(d.type))
      .on('mouseover', function(_event, d) {
        setHoveredNode(d.id);
        d3.select(this).transition().duration(200).attr('r', d.size * 1.2);
      })
      .on('mouseout', function(_event, d) {
        setHoveredNode(null);
        d3.select(this).transition().duration(200).attr('r', d.size);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.id);
        if (onNodeClick && d.type === 'note') {
          onNodeClick(d);
        }
      });

    // Add labels to nodes
    node.append('text')
      .text(d => d.label)
      .attr('x', 0)
      .attr('y', d => d.size + 15)
      .attr('text-anchor', 'middle')
      .attr('class', 'node-label')
      .style('font-size', '12px')
      .style('pointer-events', 'none');

    // Add icons for node types
    node.append('text')
      .text(d => getNodeIcon(d.type))
      .attr('x', 0)
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('class', 'node-icon')
      .style('font-size', '16px')
      .style('pointer-events', 'none');

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as unknown as D3Node).x!)
        .attr('y1', d => (d.source as unknown as D3Node).y!)
        .attr('x2', d => (d.target as unknown as D3Node).x!)
        .attr('y2', d => (d.target as unknown as D3Node).y!);

      node.attr('transform', d => `translate(${(d as any).x},${(d as any).y})`);
    });

    // Drag functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  };

  const getNodeColor = (type: GraphNode['type']): string => {
    switch (type) {
      case 'note': return '#8e7cc3';
      case 'tag': return '#7cc38e';
      case 'folder': return '#c3a87c';
      default: return '#999';
    }
  };

  const getNodeIcon = (type: GraphNode['type']): string => {
    switch (type) {
      case 'note': return '📄';
      case 'tag': return '#';
      case 'folder': return '📁';
      default: return '•';
    }
  };

  const handleRefresh = () => {
    loadGraphData();
  };

  const handleReset = () => {
    setSearchTerm('');
    setFilterType('all');
    setSelectedNode(null);
    renderGraph();
  };

  if (loading) {
    return (
      <div className="knowledge-graph-loading">
        <div className="loading-spinner">🔄</div>
        <p>Building knowledge graph...</p>
      </div>
    );
  }

  return (
    <div className="knowledge-graph-container">
      <div className="graph-controls">
        <div className="control-group">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="control-group">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="filter-select"
          >
            <option value="all">All Nodes</option>
            <option value="notes">Notes Only</option>
            <option value="tags">Tags Only</option>
            <option value="folders">Folders Only</option>
          </select>
        </div>

        <div className="control-group">
          <button onClick={handleReset} className="control-btn">
            Reset View
          </button>
          <button onClick={handleRefresh} className="control-btn">
            Refresh
          </button>
        </div>
      </div>

      <div className="graph-main">
        <svg ref={svgRef} className="knowledge-graph-svg"></svg>
        
        {hoveredNode && (
          <div className="node-tooltip">
            {graphData?.nodes.find(n => n.id === hoveredNode)?.label}
          </div>
        )}
      </div>

      {stats && (
        <div className="graph-stats">
          <div className="stat-item">
            <span className="stat-label">Nodes:</span>
            <span className="stat-value">{stats.totalNodes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Links:</span>
            <span className="stat-value">{stats.totalLinks}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Orphaned:</span>
            <span className="stat-value">{stats.orphanedNodes.length}</span>
          </div>
          {stats.mostConnected[0] && (
            <div className="stat-item">
              <span className="stat-label">Most Connected:</span>
              <span className="stat-value">
                {graphData?.nodes.find(n => n.id === stats.mostConnected[0].id)?.label}
                ({stats.mostConnected[0].connections})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphView;