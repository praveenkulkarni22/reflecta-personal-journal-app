import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Activity, 
  Sparkles, 
  Clock, 
  Calendar, 
  ArrowUpRight, 
  Filter, 
  Info, 
  Smile, 
  Compass, 
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Eye
} from 'lucide-react';
import { JournalEntry, ReflectionMood } from '../types';
import { useTheme } from '../context/ThemeContext';
import { formatFullDate, formatTimeAgo } from '../lib/utils';

export interface EmotionalTrendsChartProps {
  entries: JournalEntry[];
  onSelectEntry?: (entry: JournalEntry) => void;
  className?: string;
  isCompact?: boolean;
}

// Mood metadata mapping to sentiment valence (-100 to +100) and energy (0 to 100)
export const MOOD_METRICS: Record<
  ReflectionMood,
  { valence: number; energy: number; label: string; emoji: string; category: 'restorative' | 'centered' | 'friction' }
> = {
  peaceful: { valence: 90, energy: 20, label: 'Peaceful', emoji: '🕊️', category: 'restorative' },
  grateful: { valence: 85, energy: 55, label: 'Grateful', emoji: '✨', category: 'restorative' },
  energized: { valence: 82, energy: 90, label: 'Energized', emoji: '⚡', category: 'restorative' },
  calm: { valence: 75, energy: 25, label: 'Calm', emoji: '🍃', category: 'restorative' },
  curious: { valence: 65, energy: 65, label: 'Curious', emoji: '🔭', category: 'restorative' },
  thoughtful: { valence: 45, energy: 35, label: 'Thoughtful', emoji: '💭', category: 'centered' },
  searching: { valence: 15, energy: 45, label: 'Searching', emoji: '🧭', category: 'centered' },
  vulnerable: { valence: 20, energy: 30, label: 'Vulnerable', emoji: '🪶', category: 'centered' },
  melancholy: { valence: -35, energy: 25, label: 'Melancholy', emoji: '🕯️', category: 'friction' },
  exhausted: { valence: -50, energy: 15, label: 'Exhausted', emoji: '🍂', category: 'friction' },
  disappointed: { valence: -55, energy: 35, label: 'Disappointed', emoji: '🌧️', category: 'friction' },
  anxious: { valence: -65, energy: 80, label: 'Anxious', emoji: '⚡', category: 'friction' },
  sorrow: { valence: -75, energy: 20, label: 'Sorrow', emoji: '🥀', category: 'friction' },
  frustrated: { valence: -80, energy: 85, label: 'Frustrated', emoji: '🌋', category: 'friction' },
  overwhelmed: { valence: -85, energy: 85, label: 'Overwhelmed', emoji: '🌊', category: 'friction' },
  disgusted: { valence: -85, energy: 60, label: 'Disgusted', emoji: '🌪️', category: 'friction' },
};

export interface ChartDataPoint {
  id: string;
  date: Date;
  dateStr: string;
  valence: number;
  energy: number;
  mood: ReflectionMood;
  title: string;
  contentSnippet: string;
  wordCount: number;
  isSimulated?: boolean;
  rawEntry?: JournalEntry;
}

// Sample journey data points to illustrate trends when the user has few entries
const GENERATE_SAMPLE_JOURNEY = (): ChartDataPoint[] => {
  const now = new Date();
  const sampleMoods: ReflectionMood[] = [
    'searching', 'thoughtful', 'calm', 'grateful', 'curious', 
    'energized', 'vulnerable', 'anxious', 'frustrated', 'thoughtful',
    'calm', 'peaceful', 'grateful', 'energized', 'peaceful'
  ];

  const sampleTitles = [
    'Reflecting on new career aspirations',
    'Morning meditation and stillness',
    'Walking through the rain in quiet contemplation',
    'Gratitude for community and deep conversations',
    'Curious discoveries in a new reading list',
    'Burst of creative inspiration at twilight',
    'Honest appraisal of recent vulnerabilities',
    'Restless afternoon and deadline pressures',
    'Unpacking friction with compassionate pause',
    'Evening tea and centering breathwork',
    'Peaceful resolution of inner questions',
    'Serene weekend retreat notes',
    'Deep thankfulness for health and family',
    'Invigorating sunrise walk along the bay',
    'Grounded clarity in my personal sanctuary'
  ];

  return sampleMoods.map((mood, idx) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (sampleMoods.length - 1 - idx) * 2);
    const meta = MOOD_METRICS[mood];
    return {
      id: `sample-${idx}`,
      date: d,
      dateStr: d.toISOString().slice(0, 10),
      valence: meta.valence,
      energy: meta.energy,
      mood,
      title: sampleTitles[idx],
      contentSnippet: 'Explored thoughts, mindful insights, and emotional cadences recorded in the sanctuary journal.',
      wordCount: 140 + (idx * 23) % 180,
      isSimulated: true
    };
  });
};

export const EmotionalTrendsChart: React.FC<EmotionalTrendsChartProps> = ({
  entries,
  onSelectEntry,
  className = '',
  isCompact = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [metricMode, setMetricMode] = useState<'valence' | 'energy' | 'rolling'>('valence');
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d' | 'all'>('all');
  const [useSampleData, setUseSampleData] = useState<boolean>(entries.length < 2);
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 680, height: isCompact ? 260 : 340 });

  // Update sample toggle if entries become available
  useEffect(() => {
    if (entries.length >= 2) {
      setUseSampleData(false);
    }
  }, [entries.length]);

  // Handle ResizeObserver for responsive chart dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(chartEntries => {
      if (!chartEntries || chartEntries.length === 0) return;
      const { width } = chartEntries[0].contentRect;
      if (width > 0) {
        setDimensions({
          width,
          height: isCompact ? 240 : Math.min(380, Math.max(280, Math.round(width * 0.42)))
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isCompact]);

  // Extract and sort real entry data points
  const rawPoints = useMemo<ChartDataPoint[]>(() => {
    if (useSampleData || entries.length < 2) {
      return GENERATE_SAMPLE_JOURNEY();
    }

    return entries
      .map(entry => {
        const dateStr = entry.entryDate || (entry.createdAt ? entry.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
        const date = new Date(entry.createdAt || dateStr);
        const mood = entry.mood || 'thoughtful';
        const meta = MOOD_METRICS[mood] || MOOD_METRICS.thoughtful;

        return {
          id: entry.id,
          date,
          dateStr,
          valence: meta.valence,
          energy: meta.energy,
          mood,
          title: entry.title || 'Untitled Reflection',
          contentSnippet: entry.content.slice(0, 140) + (entry.content.length > 140 ? '...' : ''),
          wordCount: entry.wordCount,
          rawEntry: entry,
          isSimulated: false
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [entries, useSampleData]);

  // Filter points according to timeRange
  const filteredPoints = useMemo<ChartDataPoint[]>(() => {
    if (timeRange === 'all' || rawPoints.length === 0) return rawPoints;

    const latestDate = rawPoints[rawPoints.length - 1].date.getTime();
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const cutoff = latestDate - days * 24 * 60 * 60 * 1000;

    const filtered = rawPoints.filter(p => p.date.getTime() >= cutoff);
    return filtered.length >= 2 ? filtered : rawPoints;
  }, [rawPoints, timeRange]);

  // Calculate 7-day rolling average points if needed
  const chartPoints = useMemo(() => {
    if (metricMode !== 'rolling') return filteredPoints;

    return filteredPoints.map((pt, i, arr) => {
      // average valence of current and prior up to 3 points
      const slice = arr.slice(Math.max(0, i - 2), i + 1);
      const avgValence = Math.round(slice.reduce((acc, curr) => acc + curr.valence, 0) / slice.length);
      return {
        ...pt,
        valence: avgValence
      };
    });
  }, [filteredPoints, metricMode]);

  // Aggregate Key Statistics
  const stats = useMemo(() => {
    if (filteredPoints.length === 0) {
      return { avgValence: 0, dominantMood: 'calm', streak: 0, highestValence: 0 };
    }

    const totalValence = filteredPoints.reduce((sum, p) => sum + p.valence, 0);
    const avgValence = Math.round(totalValence / filteredPoints.length);

    // Count moods
    const counts: Record<string, number> = {};
    let positiveStreak = 0;
    let currentStreak = 0;

    filteredPoints.forEach(p => {
      counts[p.mood] = (counts[p.mood] || 0) + 1;
      if (p.valence > 0) {
        currentStreak++;
        if (currentStreak > positiveStreak) positiveStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    let dominantMood: ReflectionMood = 'peaceful';
    let maxCount = -1;
    Object.entries(counts).forEach(([m, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = m as ReflectionMood;
      }
    });

    const highestValence = Math.max(...filteredPoints.map(p => p.valence));

    return {
      avgValence,
      dominantMood,
      streak: positiveStreak,
      highestValence
    };
  }, [filteredPoints]);

  // Render D3 Visualization
  useEffect(() => {
    if (!svgRef.current || chartPoints.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { 
      top: 24, 
      right: 36, 
      bottom: 40, 
      left: 48 
    };

    const innerWidth = Math.max(10, width - margin.left - margin.right);
    const innerHeight = Math.max(10, height - margin.top - margin.bottom);

    // Create main grouping
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale (Date)
    const xExtent = d3.extent(chartPoints, d => d.date) as [Date, Date];
    const xScale = d3
      .scaleTime()
      .domain(xExtent[0] && xExtent[1] && xExtent[0].getTime() !== xExtent[1].getTime() ? xExtent : [new Date(Date.now() - 86400000), new Date()])
      .range([0, innerWidth]);

    // Y Scale: Valence is [-100, 100], Energy is [0, 100]
    const yDomain: [number, number] = metricMode === 'energy' ? [0, 100] : [-100, 100];
    const yScale = d3
      .scaleLinear()
      .domain(yDomain)
      .range([innerHeight, 0]);

    // Define unique IDs for gradient and drop-shadow filters
    const gradId = `emotion-grad-${Math.random().toString(36).substring(2, 7)}`;
    const lineGradId = `line-grad-${Math.random().toString(36).substring(2, 7)}`;

    // Defs for gradients
    const defs = svg.append('defs');

    // Area Gradient: Teal/Emerald top, subtle transparent bottom
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    if (metricMode === 'energy') {
      areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.45);
      areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.02);
    } else {
      areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#67C3DE').attr('stop-opacity', 0.45);
      areaGrad.append('stop').attr('offset', '50%').attr('stop-color', '#10b981').attr('stop-opacity', 0.20);
      areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.05);
    }

    // Line Stroke Gradient
    const lineGrad = defs
      .append('linearGradient')
      .attr('id', lineGradId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    lineGrad.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8');
    lineGrad.append('stop').attr('offset', '50%').attr('stop-color', '#67C3DE');
    lineGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981');

    // Soft subtle grid lines
    const yTicks = metricMode === 'energy' ? [0, 25, 50, 75, 100] : [-80, -40, 0, 40, 80];

    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
      .attr('stroke-dasharray', d => d === 0 ? '4 4' : '2 2')
      .attr('stroke-width', d => d === 0 ? 1.5 : 1);

    // Equilibrium Baseline (y = 0) Highlight & Annotation for Valence
    if (metricMode !== 'energy') {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(0))
        .attr('y2', yScale(0))
        .attr('stroke', isDark ? 'rgba(103,195,222,0.35)' : 'rgba(8,56,71,0.25)')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '5 5');

      // Baseline label
      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', yScale(0) - 5)
        .attr('text-anchor', 'end')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('fill', isDark ? '#67C3DE' : '#0c4a60')
        .attr('opacity', 0.85)
        .text('Equilibrium Baseline (0)');

      // Top Zone Label
      g.append('text')
        .attr('x', 6)
        .attr('y', yScale(80) - 6)
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .attr('fill', isDark ? '#34d399' : '#059669')
        .attr('opacity', 0.7)
        .text('▲ Uplifting & Restorative');

      // Bottom Zone Label
      g.append('text')
        .attr('x', 6)
        .attr('y', yScale(-80) + 14)
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .attr('fill', isDark ? '#f87171' : '#dc2626')
        .attr('opacity', 0.7)
        .text('▼ Friction & Vulnerability');
    }

    // Value extractor based on active metric
    const getValue = (d: ChartDataPoint) => (metricMode === 'energy' ? d.energy : d.valence);

    // D3 Area generator
    const areaGenerator = d3
      .area<ChartDataPoint>()
      .x(d => xScale(d.date))
      .y0(yScale(metricMode === 'energy' ? 0 : 0))
      .y1(d => yScale(getValue(d)))
      .curve(d3.curveMonotoneX);

    // Draw the area fill
    g.append('path')
      .datum(chartPoints)
      .attr('fill', `url(#${gradId})`)
      .attr('d', areaGenerator);

    // D3 Line generator
    const lineGenerator = d3
      .line<ChartDataPoint>()
      .x(d => xScale(d.date))
      .y(d => yScale(getValue(d)))
      .curve(d3.curveMonotoneX);

    // Draw the smooth bezier trend line
    const path = g
      .append('path')
      .datum(chartPoints)
      .attr('fill', 'none')
      .attr('stroke', `url(#${lineGradId})`)
      .attr('stroke-width', 2.8)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('d', lineGenerator);

    // Animation transition on line appearance
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || 0;
    if (totalLength > 0) {
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    }

    // X Axis with formatted dates
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(3, Math.floor(innerWidth / 90)))
      .tickFormat(d => d3.timeFormat('%b %d')(d as Date))
      .tickSize(4);

    const gx = g
      .append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis);

    gx.select('.domain').attr('stroke', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
    gx.selectAll('.tick line').attr('stroke', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
    gx.selectAll('.tick text')
      .attr('font-size', '10px')
      .attr('fill', isDark ? '#a3a3a3' : '#737373');

    // Y Axis with sentiment labels
    const yAxis = d3
      .axisLeft(yScale)
      .tickValues(yTicks)
      .tickFormat(d => (metricMode === 'energy' ? `${d}%` : `${Number(d) > 0 ? '+' : ''}${d}`))
      .tickSize(4);

    const gy = g.append('g').call(yAxis);
    gy.select('.domain').attr('stroke', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
    gy.selectAll('.tick line').attr('stroke', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
    gy.selectAll('.tick text')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('fill', isDark ? '#a3a3a3' : '#737373');

    // Crosshair line for tracking
    const crosshair = g
      .append('line')
      .attr('class', 'crosshair')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', isDark ? '#67C3DE' : '#083847')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3 3')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    // Draw Interactive Data Points & Nodes
    const nodesGroup = g.append('g').attr('class', 'nodes-layer');

    const nodeSelection = nodesGroup
      .selectAll('.node-item')
      .data(chartPoints)
      .enter()
      .append('g')
      .attr('class', 'node-item')
      .attr('transform', d => `translate(${xScale(d.date)}, ${yScale(getValue(d))})`)
      .style('cursor', 'pointer');

    // Outer ring halo
    nodeSelection
      .append('circle')
      .attr('r', 8)
      .attr('fill', d => {
        const val = getValue(d);
        if (metricMode === 'energy') return 'rgba(56, 189, 248, 0.15)';
        return val >= 40 ? 'rgba(16, 185, 129, 0.2)' : val >= 0 ? 'rgba(103, 195, 222, 0.2)' : 'rgba(244, 63, 94, 0.2)';
      })
      .attr('stroke', d => {
        const val = getValue(d);
        if (metricMode === 'energy') return '#38bdf8';
        return val >= 40 ? '#10b981' : val >= 0 ? '#67C3DE' : '#f43f5e';
      })
      .attr('stroke-width', 1.2);

    // Inner center dot
    nodeSelection
      .append('circle')
      .attr('r', 3.5)
      .attr('fill', isDark ? '#ffffff' : '#062534');

    // Interaction overlay rectangle for fast smooth mousemove
    const bisectDate = d3.bisector<ChartDataPoint, Date>(d => d.date).center;

    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event, g.node());
        if (mx < 0 || mx > innerWidth) {
          setHoveredPoint(null);
          setTooltipPos(null);
          crosshair.style('opacity', 0);
          return;
        }

        const dateAtMouse = xScale.invert(mx);
        const index = bisectDate(chartPoints, dateAtMouse);
        const pt = chartPoints[index];

        if (pt) {
          setHoveredPoint(pt);
          const px = xScale(pt.date) + margin.left;
          const py = yScale(getValue(pt)) + margin.top;
          setTooltipPos({ x: px, y: py });

          crosshair
            .attr('x1', xScale(pt.date))
            .attr('x2', xScale(pt.date))
            .style('opacity', 0.8);
        }
      })
      .on('mouseleave', () => {
        setHoveredPoint(null);
        setTooltipPos(null);
        crosshair.style('opacity', 0);
      })
      .on('click', () => {
        if (hoveredPoint?.rawEntry && onSelectEntry) {
          onSelectEntry(hoveredPoint.rawEntry);
        }
      });

  }, [dimensions, chartPoints, metricMode, isDark, hoveredPoint?.rawEntry, onSelectEntry]);

  return (
    <div className={`space-y-4 ${className}`}>
      
      {/* Top Banner Card: Sanctuary Key Insights & Emotion Metrics */}
      <div className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
        isDark 
          ? 'bg-neutral-900/80 border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.5)]' 
          : 'bg-white/85 border-black/[0.06] shadow-[0_10px_25px_rgba(0,0,0,0.03)]'
      }`}>
        
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border flex items-center justify-center ${
              isDark 
                ? 'bg-[#67C3DE]/15 border-[#67C3DE]/40 text-[#67C3DE]' 
                : 'bg-[#67C3DE]/20 border-[#67C3DE]/60 text-[#083847]'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`font-serif text-base sm:text-lg font-bold tracking-tight ${
                  isDark ? 'text-neutral-100' : 'text-neutral-900'
                }`}>
                  Emotional Cadence & Trajectory
                </h3>
                <span className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded-full border font-bold ${
                  isDark 
                    ? 'bg-[#67C3DE]/15 text-[#67C3DE] border-[#67C3DE]/40' 
                    : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/50'
                }`}>
                  D3 Engine
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Continuous sentiment, serenity, and friction analysis over your journal timeline
              </p>
            </div>
          </div>

          {/* Controls: Metric Mode & Time Range */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Metric Mode Select */}
            <div className={`flex items-center p-1 rounded-xl border text-xs font-medium ${
              isDark ? 'bg-neutral-950/60 border-white/[0.08]' : 'bg-neutral-100 border-black/[0.06]'
            }`}>
              <button
                onClick={() => setMetricMode('valence')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'valence'
                    ? isDark 
                      ? 'bg-[#67C3DE]/20 text-[#67C3DE] font-semibold shadow-xs' 
                      : 'bg-white text-[#083847] font-semibold shadow-xs'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Emotional Valence
              </button>
              <button
                onClick={() => setMetricMode('energy')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'energy'
                    ? isDark 
                      ? 'bg-[#67C3DE]/20 text-[#67C3DE] font-semibold shadow-xs' 
                      : 'bg-white text-[#083847] font-semibold shadow-xs'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Vitality / Energy
              </button>
              <button
                onClick={() => setMetricMode('rolling')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'rolling'
                    ? isDark 
                      ? 'bg-[#67C3DE]/20 text-[#67C3DE] font-semibold shadow-xs' 
                      : 'bg-white text-[#083847] font-semibold shadow-xs'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Rolling Trend
              </button>
            </div>

            {/* Time Window Select */}
            <div className={`flex items-center p-1 rounded-xl border text-xs font-medium ${
              isDark ? 'bg-neutral-950/60 border-white/[0.08]' : 'bg-neutral-100 border-black/[0.06]'
            }`}>
              {(['7d', '14d', '30d', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 rounded-lg uppercase text-[10px] font-mono transition-all cursor-pointer ${
                    timeRange === range
                      ? isDark 
                        ? 'bg-[#67C3DE]/20 text-[#67C3DE] font-bold shadow-xs' 
                        : 'bg-white text-[#083847] font-bold shadow-xs'
                      : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* Quick Summary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5">
          
          <div className={`p-2.5 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-950/40 border-white/[0.06]' : 'bg-neutral-50 border-black/[0.04]'
          }`}>
            <span className={`text-[10px] uppercase font-mono tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Valence Index
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-lg font-bold font-mono ${
                stats.avgValence >= 30 
                  ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                  : stats.avgValence >= 0 
                  ? isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                  : isDark ? 'text-rose-400' : 'text-rose-600'
              }`}>
                {stats.avgValence > 0 ? `+${stats.avgValence}` : stats.avgValence}%
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">
                {stats.avgValence >= 40 ? 'Restorative' : stats.avgValence >= 0 ? 'Centered' : 'Tension'}
              </span>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-950/40 border-white/[0.06]' : 'bg-neutral-50 border-black/[0.04]'
          }`}>
            <span className={`text-[10px] uppercase font-mono tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Primary Mood
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-base">{MOOD_METRICS[stats.dominantMood]?.emoji || '💭'}</span>
              <span className={`text-xs font-bold capitalize ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                {MOOD_METRICS[stats.dominantMood]?.label || stats.dominantMood}
              </span>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-950/40 border-white/[0.06]' : 'bg-neutral-50 border-black/[0.04]'
          }`}>
            <span className={`text-[10px] uppercase font-mono tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Serenity Streak
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-lg font-bold font-mono ${isDark ? 'text-[#67C3DE]' : 'text-[#083847]'}`}>
                {stats.streak}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">consecutive entries</span>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border transition-all ${
            isDark ? 'bg-neutral-950/40 border-white/[0.06]' : 'bg-neutral-50 border-black/[0.04]'
          }`}>
            <span className={`text-[10px] uppercase font-mono tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Data Points Plotted
            </span>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <span className={`text-lg font-bold font-mono ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                {chartPoints.length}
              </span>
              {entries.length < 2 && (
                <button
                  onClick={() => setUseSampleData(!useSampleData)}
                  title="Toggle between sample trajectory and actual entries"
                  className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer ${
                    useSampleData 
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                      : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                  }`}
                >
                  <Eye className="w-2.5 h-2.5" />
                  <span>{useSampleData ? 'Demo Mode' : 'Raw Entries'}</span>
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* SVG Canvas Container with D3 rendering */}
      <div 
        ref={containerRef} 
        className={`relative w-full rounded-2xl border transition-all duration-300 overflow-hidden ${
          isDark 
            ? 'bg-neutral-950/70 border-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]' 
            : 'bg-white border-black/[0.06] shadow-2xs'
        }`}
      >
        <svg 
          ref={svgRef} 
          width={dimensions.width} 
          height={dimensions.height}
          className="block w-full overflow-visible select-none"
        />

        {/* Interactive Floating Hover Tooltip */}
        <AnimatePresence>
          {hoveredPoint && tooltipPos && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={{
                left: Math.min(Math.max(16, tooltipPos.x - 120), dimensions.width - 260),
                top: Math.max(12, tooltipPos.y - 125)
              }}
              className={`absolute z-30 pointer-events-none w-64 p-3 rounded-xl border shadow-xl backdrop-blur-xl ${
                isDark 
                  ? 'bg-neutral-900/95 border-white/[0.12] text-neutral-100 shadow-[0_12px_32px_rgba(0,0,0,0.7)]' 
                  : 'bg-white/95 border-black/[0.1] text-neutral-900 shadow-[0_12px_32px_rgba(0,0,0,0.12)]'
              }`}
            >
              {/* Header: Date and Mood pill */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {formatFullDate(hoveredPoint.dateStr)}
                </span>
                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border flex items-center gap-1 ${
                  hoveredPoint.valence >= 40
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : hoveredPoint.valence >= 0
                    ? 'bg-[#67C3DE]/20 text-[#083847] dark:text-[#67C3DE] border-[#67C3DE]/40'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                }`}>
                  <span>{MOOD_METRICS[hoveredPoint.mood]?.emoji || '💭'}</span>
                  <span className="capitalize">{MOOD_METRICS[hoveredPoint.mood]?.label || hoveredPoint.mood}</span>
                </span>
              </div>

              {/* Entry Title */}
              <h4 className="text-xs font-bold font-serif line-clamp-1 mb-1">
                {hoveredPoint.title}
              </h4>

              {/* Snippet */}
              <p className={`text-[11px] leading-snug line-clamp-2 mb-2 ${
                isDark ? 'text-neutral-400' : 'text-neutral-600'
              }`}>
                {hoveredPoint.contentSnippet}
              </p>

              {/* Footer row: Valence and prompt */}
              <div className={`flex items-center justify-between pt-1.5 border-t text-[10px] font-mono ${
                isDark ? 'border-white/[0.08] text-neutral-400' : 'border-black/[0.06] text-neutral-500'
              }`}>
                <span className="flex items-center gap-1">
                  <span>Valence:</span>
                  <strong className={
                    hoveredPoint.valence > 0 
                      ? 'text-emerald-500' 
                      : hoveredPoint.valence === 0 
                      ? 'text-sky-500' 
                      : 'text-rose-500'
                  }>
                    {hoveredPoint.valence > 0 ? `+${hoveredPoint.valence}` : hoveredPoint.valence}
                  </strong>
                </span>

                {hoveredPoint.rawEntry && (
                  <span className="text-[#67C3DE] flex items-center gap-0.5 font-sans font-semibold">
                    <span>Click to open</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend & Guidance Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-400 dark:text-neutral-500 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span>Restorative (+40 to +100)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#67C3DE]" />
            <span>Centered (0 to +40)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span>Friction (-100 to 0)</span>
          </div>
        </div>

        <span className="text-[10px] font-mono">
          Hover over data points to inspect mood • Click any node to read entry
        </span>
      </div>

    </div>
  );
};
