"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getApiUrl, getAuthHeaders } from "./api";

interface DocumentMeta {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  status: string;
  metadata: any;
  created_at: string;
}

interface ConversationMeta {
  id: string;
  updated_at: string;
  preview: string;
}

interface MessageSource {
  filename: string;
  chunk_index: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: MessageSource[];
  timestamp: string;
}

interface AnalysisMeta {
  id: string;
  document_id: string | null;
  query: string;
  status: string;
  duration_ms: number | null;
  created_at: string;
}

interface AgentLog {
  agent_name: string;
  input: any;
  output: any;
  duration_ms: number;
  error: string | null;
  created_at: string;
}

interface ChartConfig {
  method: string;
  history_dates: string[];
  history_values: number[];
  forecast_dates: string[];
  forecast_values: number[];
  lower_bounds: number[];
  upper_bounds: number[];
}

interface AnalysisDetail {
  id: string;
  query: string;
  status: string;
  duration_ms: number | null;
  result_metadata: any;
  created_at: string;
  logs: AgentLog[];
  chart: {
    config: ChartConfig;
  } | null;
}

interface ReportMeta {
  id: string;
  analysis_id: string | null;
  title: string;
  summary: string | null;
  created_at: string;
}

const CHART_EXPLANATIONS: Record<string, string> = {
  // Basic Charts
  "line": "Line Chart: Connects data points with straight lines to show trends over time.",
  "multi_line": "Multi-Line Chart: Compares multiple data series over time using separate lines.",
  "bar": "Bar Chart: Represents values as vertical rectangular bars, useful for comparisons.",
  "horizontal_bar": "Horizontal Bar Chart: Uses horizontal bars to compare values across categories.",
  "grouped_bar": "Grouped Bar Chart: Groups vertical bars side-by-side to compare sub-categories.",
  "stacked_bar": "Stacked Bar Chart: Places bars on top of each other to show cumulative totals.",
  "stacked_bar_100": "100% Stacked Bar Chart: Shows the relative percentage contribution of categories adding up to 100%.",
  "pie": "Pie Chart: Divided into slices to represent numerical proportions of a whole.",
  "donut": "Donut Chart: A pie chart with a blank center, highlighting total value and categories.",
  "area": "Area Chart: A line chart with the space below the line filled, emphasizing volume.",
  "stacked_area": "Stacked Area Chart: Displays multiple area series stacked on top of each other.",
  "step": "Step Chart: Uses horizontal and vertical lines to show changes at discrete intervals.",
  // Distribution Charts
  "histogram": "Histogram: Groups data into bins to show the frequency distribution of values.",
  "kde": "KDE Plot: Estimates the probability density function, creating a smooth distribution curve.",
  "freq_polygon": "Frequency Polygon: Connects the midpoints of histogram bins to visualize distribution shape.",
  "density": "Density Plot: Visualizes the distribution of data over a continuous interval.",
  "ecdf": "ECDF Plot: Shows the empirical cumulative distribution function, tracing data percentiles.",
  "rug": "Rug Plot: Displays individual data points as tiny tick marks along the axis, showing density.",
  "qq_plot": "QQ Plot: Compares the quantiles of two distributions (usually data vs. theoretical normal distribution).",
  "prob_plot": "Probability Plot: Graphically estimates if a dataset follows a specific statistical distribution.",
  // Relationship Charts
  "scatter": "Scatter Plot: Displays individual data points as dots on Cartesian coordinates to check correlation.",
  "bubble": "Bubble Chart: A scatter plot where dot sizes represent an additional third dimension of data.",
  "hexbin": "Hexbin Plot: Groups points into hexagonal bins, using color intensity to show density.",
  "pair": "Pair Plot: Renders a matrix of pairwise scatter plots for all columns in a dataset.",
  "joint": "Joint Plot: Displays a scatter plot along with marginal histograms on the axes.",
  "regression": "Regression Plot: Fits and draws a linear regression trendline on top of scatter data.",
  "lm_plot": "LM Plot: Draws regression fits across subsets of data categories.",
  "connected_scatter": "Connected Scatter Plot: Connects scatter points sequentially, showing paths and trends.",
  // Categorical Charts
  "count_plot": "Count Plot: A bar chart that displays the frequency of occurrences in each category.",
  "box": "Box Plot: Shows the median, quartiles, and outliers of data distributions (whisker plot).",
  "violin": "Violin Plot: Combines a box plot with a KDE density curve to show data distribution shape.",
  "boxen": "Boxen Plot: Displays an enhanced box plot with multiple boxes for large datasets (letter-value plot).",
  "strip": "Strip Plot: Displays a scatter plot for categorical data, where points are aligned on one axis.",
  "swarm": "Swarm Plot: Adjusts categorical scatter points so they do not overlap, showing shape.",
  "beeswarm": "Beeswarm Plot: Spreads data points horizontally along categories to avoid overlap, resembling a swarm.",
  "point_plot": "Point Plot: Represents point estimates and confidence intervals using lines and markers.",
  "cat_plot": "Cat Plot: Combines multiple categorical plots across subplots.",
  // Matrix & Correlation
  "heatmap": "Heatmap: Visualizes 2D matrices using a grid of color-coded cells.",
  "corr_heatmap": "Correlation Matrix Heatmap: Displays correlation coefficients (-1 to 1) between columns.",
  "cluster_map": "Cluster Map: Hierarchically clusters rows and columns of a matrix, showing groupings.",
  "confusion_matrix": "Confusion Matrix: Shows classification model performance, comparing predictions to targets.",
  "covariance_matrix": "Covariance Matrix: Shows the joint variability of variables in a color-coded grid.",
  // Statistical Charts
  "error_bar": "Error Bar Plot: Renders data points along with vertical error lines showing uncertainty.",
  "ci_plot": "Confidence Interval Plot: Visualizes sample means along with their confidence interval boundaries.",
  "residual": "Residual Plot: Shows residuals (differences) on the vertical axis against independent variables.",
  "leverage": "Leverage Plot: Identifies influential outliers that pull the regression line.",
  "influence": "Influence Plot: Combines leverage and residuals to highlight high-influence data points.",
  "bland_altman": "Bland-Altman Plot: Visualizes agreement between two measurement methods using differences vs. averages.",
  // Time Series & Financial
  "time_series_line": "Time Series Line Chart: Plots data chronologically to analyze historical changes and timelines.",
  "rolling_mean": "Rolling Mean Plot: Smooths out short-term fluctuations to show long-term trend directions.",
  "rolling_std": "Rolling Std Plot: Plots the rolling standard deviation to visualize volatility changes.",
  "seasonal": "Seasonal Plot: Groups data by seasonal cycles (like months or quarters) to detect periodic trends.",
  "trend": "Trend Plot: Displays the isolated long-term growth or decline trend from time-series decomposition.",
  "lag": "Lag Plot: Plots data values against lagged values (t vs t-1) to detect autocorrelation.",
  "acf": "Autocorrelation Plot (ACF): Measures the correlation of a time series with its own past values.",
  "pacf": "Partial Autocorrelation Plot (PACF): Measures autocorrelation while controlling for intermediate periods.",
  "candlestick": "Candlestick Chart: Visualizes financial assets showing Open, High, Low, and Close values.",
  "ohlc": "OHLC Chart: Displays Open, High, Low, and Close prices using horizontal ticks and vertical lines.",
  "waterfall": "Waterfall Chart: Displays cumulative effects of sequential positive and negative changes.",
  "volume": "Volume Chart: Renders vertical bars showing transaction volume over a timeline.",
  "moving_average": "Moving Average Chart: Overlays rolling averages to identify support/resistance levels.",
  "bollinger": "Bollinger Bands Chart: Renders a moving average surrounded by upper and lower standard deviation bands.",
  // Hierarchical Charts
  "treemap": "Tree Map: Displays hierarchical data as nested rectangles proportional to value sizes.",
  "sunburst": "Sunburst Chart: Visualizes hierarchies using concentric rings divided into sectors.",
  "icicle": "Icicle Chart: Represents hierarchies using stacked rectangles aligned horizontally or vertically.",
  "dendrogram": "Dendrogram: Draws a tree-like diagram showing hierarchical clustering connections.",
  "circle_packing": "Circle Packing Chart: Represents hierarchical groupings as nested circles.",
  // Flow & Network
  "sankey": "Sankey Diagram: Visualizes resource, cost, or data flows from nodes using weighted curved paths.",
  "alluvial": "Alluvial Diagram: Shows changes in structure or flows across multiple stages.",
  "chord": "Chord Diagram: Shows inter-relationships between entities in a circular flow layout.",
  "flow_map": "Flow Map: Renders data flows from origin to destination across geographical locations.",
  "network": "Network Graph: Represents entities as nodes connected by edges to model relationships.",
  "force_directed": "Force Directed Graph: Positions network nodes using spring-like physical simulations.",
  "node_link": "Node-Link Diagram: Standard graph displaying circles (nodes) connected by straight lines (links).",
  // Geographical Charts
  "choropleth": "Choropleth Map: Colors geographical regions based on variable magnitudes.",
  "bubble_map": "Bubble Map: Overlays variable-sized bubbles on top of geographical locations.",
  "density_map": "Density Map: Shows the density of events or occurrences on top of a map backdrop.",
  "geo_scatter": "Geo Scatter Plot: Plots coordinate points (latitude, longitude) on geographical maps.",
  "heat_map_on_map": "Heat Map on Map: Visualizes spatial density using color heat zones on top of coordinates.",
  "cartogram": "Cartogram: Distorts geographical region shapes to represent their data values.",
  "hexagonal_map": "Hexagonal Map: Represents geographic data using adjacent hexagon cells.",
  // Circular Charts
  "radar": "Radar Chart: Plots variables along radial axes starting from a central point (spider chart).",
  "polar": "Polar Plot: Plots coordinates in polar space using angle and distance coordinates.",
  "radial_bar": "Radial Bar Chart: Renders circular concentric bars starting from a center origin.",
  "circular_heatmap": "Circular Heatmap: Renders matrix grid cells arranged in concentric rings.",
  // 3D Charts
  "3d_scatter": "3D Scatter Plot: Plots points across three dimensions (X, Y, Z) in a projected isometric box.",
  "3d_line": "3D Line Plot: Connects data points chronologically in three-dimensional space.",
  "3d_surface": "3D Surface Plot: Renders a shaded continuous surface grid across three variables.",
  "3d_wireframe": "3D Wireframe Plot: Visualizes 3D functions using connecting grid lines, without solid faces.",
  "3d_contour": "3D Contour Plot: Projects 3D height zones onto a flat 2D elevation grid.",
  "3d_bar": "3D Bar Chart: Renders 3D rectangular columns across a spatial coordinate grid.",
  "3d_mesh": "3D Mesh Plot: Displays coordinates connected by triangular polygons in three dimensions.",
  // Specialized Charts
  "funnel": "Funnel Chart: Visualizes progressive reduction of data stages (like marketing funnels).",
  "gauge": "Gauge Chart: Uses a dial/speedometer needle to show current performance relative to targets.",
  "bullet": "Bullet Chart: Renders a single, primary measure against target markers and qualitative ranges.",
  "pareto": "Pareto Chart: Combines bars (sorted high to low) with a cumulative percentage line (80-20 rule).",
  "mosaic": "Mosaic Plot: Represents two-way frequency tables using proportional tiles.",
  "ridgeline": "Ridgeline Plot: Stacked overlapping distribution curves, ideal for changes over time.",
  "waffle": "Waffle Chart: Visualizes ratios using a grid of 100 square tiles, colored by share.",
  "lollipop": "Lollipop Chart: Renders data points as circles at the end of thin sticks.",
  "dumbbell": "Dumbbell Chart: Compares values between two points (like before/after) using connected markers.",
  "marimekko": "Marimekko Chart: A mosaic plot showing category shares across columns of varying widths.",
  "streamgraph": "Streamgraph: An organic stacked area chart flowing around a central wavy baseline.",
  "horizon": "Horizon Chart: Compresses area charts by slicing and layering height bands.",
  "gantt": "Gantt Chart: Renders horizontal bars along a timeline to track project schedules.",
  "calendar_heatmap": "Calendar Heatmap: Shows activity density color-coded within a calendar grid.",
  "word_cloud": "Word Cloud: Displays tag text words clustered together, sized by frequency.",
  "parallel_coordinates": "Parallel Coordinates Plot: Visualizes multi-dimensional data using parallel vertical axes.",
  "andrews_curve": "Andrews Curve: Plots multivariate data as smooth mathematical waves.",
  "roc_curve": "ROC Curve: Shows binary classifier performance, plotting True Positive Rate vs False Positive Rate.",
  "precision_recall": "Precision-Recall Curve: Compares precision against recall values for classifier metrics.",
  "lift_chart": "Lift Chart: Measures response rate improvements compared to random targeting.",
  "calibration": "Calibration Curve: Compares predicted probabilities against actual outcomes."
};

const THEMES = {
  darkgrid: {
    bg: "#eaebf1",
    grid: "#ffffff",
    gridDash: "0",
    text: "#4a5568",
    title: "#181d26",
    border: "#b0b3bf",
    showGrid: true,
    fontFamily: "inherit",
  },
  whitegrid: {
    bg: "#ffffff",
    grid: "#e2e8f0",
    gridDash: "0",
    text: "#4a5568",
    title: "#181d26",
    border: "#cbd5e1",
    showGrid: true,
    fontFamily: "inherit",
  },
  dark: {
    bg: "#1e293b",
    grid: "#334155",
    gridDash: "0",
    text: "#94a3b8",
    title: "#f8fafc",
    border: "#475569",
    showGrid: true,
    fontFamily: "inherit",
  },
  white: {
    bg: "#ffffff",
    grid: "#f1f5f9",
    gridDash: "0",
    text: "#475569",
    title: "#0f172a",
    border: "transparent",
    showGrid: false,
    fontFamily: "inherit",
  },
  classic: {
    bg: "#ffffff",
    grid: "#cbd5e1",
    gridDash: "4 4",
    text: "#000000",
    title: "#000000",
    border: "#000000",
    showGrid: true,
    fontFamily: "Courier, monospace",
  },
  cyberpunk: {
    bg: "#090d16",
    grid: "#1f2d4d",
    gridDash: "0",
    text: "#00f0ff",
    title: "#ff007f",
    border: "#00f0ff",
    showGrid: true,
    fontFamily: "monospace",
  },
  minimalist: {
    bg: "transparent",
    grid: "#f1f5f9",
    gridDash: "6 6",
    text: "#64748b",
    title: "#0f172a",
    border: "transparent",
    showGrid: true,
    fontFamily: "inherit",
  },
};

const PALETTES = {
  deep: {
    history: "#2563eb",
    forecast: "#dc2626",
    ci: "#ea580c",
    trend: "#16a34a",
    ma: "#9333ea",
  },
  muted: {
    history: "#475569",
    forecast: "#94a3b8",
    ci: "#cbd5e1",
    trend: "#64748b",
    ma: "#b45309",
  },
  bright: {
    history: "#3b82f6",
    forecast: "#ef4444",
    ci: "#f97316",
    trend: "#22c55e",
    ma: "#a855f7",
  },
  colorblind: {
    history: "#0891b2",
    forecast: "#ea580c",
    ci: "#0d9488",
    trend: "#db2777",
    ma: "#ca8a04",
  },
  viridis: {
    history: "#440154",
    forecast: "#21918c",
    ci: "#fde725",
    trend: "#5ec962",
    ma: "#3b528b",
  },
  warm: {
    history: "#ea580c",
    forecast: "#e11d48",
    ci: "#ca8a04",
    trend: "#be185d",
    ma: "#7c3aed",
  },
};

export default function WorkspacePage() {
  // Navigation Tabs: 'profile' | 'forecast' | 'chat' | 'reports'
  const [activeTab, setActiveTab] = useState<"profile" | "forecast" | "chat" | "reports">("profile");

  // Registry & Storage state
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMeta | null>(null);
  
  // Ingestion loading variables
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [ingestionStep, setIngestionStep] = useState(0);
  const ingestionProgressLog = [
    "Uploading data container to local staging node...",
    "Validating spreadsheet layout & sanitizing column indexes...",
    "Computing null rates, duplicates, and column schema types...",
    "Scanning dataset fields for IQR outlier anomalies...",
    "Chunking parsed spreadsheet rows for semantic context search...",
    "Calculating vector embeddings & indexing in ChromaDB store..."
  ];

  // Chat/Memory state
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState("");

  // Analysis/Forecast state
  const [runs, setRuns] = useState<AnalysisMeta[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisDetail | null>(null);
  const [targetColumn, setTargetColumn] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [cleanOutliers, setCleanOutliers] = useState(true);
  const [forecastSteps, setForecastSteps] = useState(12);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  // Visualization / Matplotlib & Seaborn simulation customization state
  const [chartTheme, setChartTheme] = useState<"darkgrid" | "whitegrid" | "dark" | "white" | "classic" | "cyberpunk" | "minimalist">("darkgrid");
  const [chartPalette, setChartPalette] = useState<"deep" | "muted" | "bright" | "colorblind" | "viridis" | "warm">("deep");
  const [chartType, setChartType] = useState<string>("line");
  const [showCI, setShowCI] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [movingAveragePeriod, setMovingAveragePeriod] = useState(3);
  const [showMinMax, setShowMinMax] = useState(false);
  const analysisProgressLog = [
    "Acquiring database lock on target file metadata...",
    "Retrieving row matrices and column data vectors...",
    "Running Outlier Cleaner agent (filtering IQR outliers)...",
    "Running ARIMA & Prophet agent simulation loops...",
    "Compiling future forecasts and confidence boundaries...",
    "Finalizing visual configurations and writing audit logs..."
  ];

  // Reports state
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [reportTitle, setReportTitle] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState("");
  const [reportChartType, setReportChartType] = useState<string>("Time Series Line Chart");
  const [chartExplanation, setChartExplanation] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [includeChart, setIncludeChart] = useState(true);
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    date: string;
    value: number;
    type: string;
  } | null>(null);

  const [statusMsg, setStatusMsg] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const urlChecked = useRef(false);

  // Chat fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Load initial workspace registry logs
  const loadWorkspaceData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      
      // 1. Documents
      const docRes = await fetch(getApiUrl("/api/v1/documents"), { headers });
      if (docRes.ok) {
        const docData = await docRes.json();
        const readyDocs = docData.filter((d: any) => d.status === "ready");
        setDocuments(readyDocs);
        
        // Auto select first document if none selected yet
        if (readyDocs.length > 0 && !selectedDoc) {
          setSelectedDoc(readyDocs[0]);
          setSelectedDocId(readyDocs[0].id);
        }
      }

      // 2. Chat Threads
      const convRes = await fetch(getApiUrl("/api/v1/chat"), { headers });
      if (convRes.ok) {
        const convData = await convRes.json();
        setConversations(convData);
        if (convData.length > 0 && !activeConvId) {
          handleSelectConversation(convData[0].id);
        }
      }

      // 3. Simulations / Analysis runs
      const runRes = await fetch(getApiUrl("/api/v1/analysis"), { headers });
      if (runRes.ok) {
        const runData = await runRes.json();
        setRuns(runData);
      }

      // 4. PDF Reports
      const reportsRes = await fetch(getApiUrl("/api/v1/reports"), { headers });
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }
    } catch (err) {
      console.error("Error loading workspace data:", err);
    }
  }, [activeConvId, selectedDoc]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Check URL parameters for redirect query prefilling
  useEffect(() => {
    if (!urlChecked.current && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get("query");
      const docIdParam = params.get("docId");
      if (queryParam) {
        setInputText(decodeURIComponent(queryParam));
        setActiveTab("chat");
      }
      if (docIdParam) {
        setSelectedDocId(docIdParam);
        const docObj = documents.find((d: DocumentMeta) => d.id === docIdParam);
        if (docObj) {
          setSelectedDoc(docObj);
        }
      }
      urlChecked.current = true;
    }
  }, [documents]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  // Formats bytes count
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Parses markdown text including lists, bold, inline code, and tables
  const renderMessageContent = (content: string): React.ReactNode => {
    if (!content) return null;

    // Helper to copy code to clipboard
    const handleCopyCode = (text: string) => {
      navigator.clipboard.writeText(text);
    };

    // First split by code blocks: ```lang ... ```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    codeBlockRegex.lastIndex = 0;

    const parseInline = (text: string): React.ReactNode[] => {
      const inlineParts: React.ReactNode[] = [];
      let currentText = text;
      
      const boldParts = currentText.split(/\*\*([\s\S]*?)\*\*/g);
      boldParts.forEach((bp, bpIdx) => {
        if (bpIdx % 2 === 1) {
          inlineParts.push(<strong key={`b-${bpIdx}`} className="font-bold text-ink">{bp}</strong>);
        } else {
          const codeParts = bp.split(/`([^`]+)`/g);
          codeParts.forEach((cp, cpIdx) => {
            if (cpIdx % 2 === 1) {
              inlineParts.push(
                <code key={`c-${bpIdx}-${cpIdx}`} className="bg-[#f0f2f5] text-[#d63384] px-1.5 py-0.5 rounded font-mono text-xs border border-[#e0e2e5]">
                  {cp}
                </code>
              );
            } else {
              const linkParts = cp.split(/\[([^\]]+)\]\(([^)]+)\)/g);
              let lIdx = 0;
              while (lIdx < linkParts.length) {
                if (lIdx % 3 === 0) {
                  if (linkParts[lIdx]) {
                    inlineParts.push(<span key={`t-${bpIdx}-${cpIdx}-${lIdx}`}>{linkParts[lIdx]}</span>);
                  }
                  lIdx += 1;
                } else {
                  const label = linkParts[lIdx];
                  const url = linkParts[lIdx + 1];
                  inlineParts.push(
                    <a
                      key={`l-${bpIdx}-${cpIdx}-${lIdx}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1b61c9] hover:underline font-semibold"
                    >
                      {label}
                    </a>
                  );
                  lIdx += 2;
                }
              }
            }
          });
        }
      });

      return inlineParts;
    };

    const parseBlock = (blockText: string, blockKey: string): React.ReactNode => {
      const trimmed = blockText.trim();
      if (!trimmed) return null;

      const lines = blockText.split("\n");
      const isTable = lines.length >= 2 && lines.every(line => {
        const tLine = line.trim();
        return tLine === "" || tLine.includes("|");
      }) && lines.some(line => line.includes("|"));

      if (isTable) {
        const tableLines = lines.filter(l => l.trim() !== "");
        if (tableLines.length >= 1) {
          const rowsData = tableLines.map(line => {
            const cells = line.split("|").map(c => c.trim());
            if (cells[0] === "") cells.shift();
            if (cells[cells.length - 1] === "") cells.pop();
            return cells;
          });

          let hasDivider = false;
          if (rowsData.length > 1) {
            const secondRow = rowsData[1];
            hasDivider = secondRow.every(cell => /^[-: ]+$/.test(cell));
          }

          const headers = rowsData[0];
          const dataRows = hasDivider ? rowsData.slice(2) : rowsData.slice(1);

          return (
            <div key={blockKey} className="overflow-x-auto my-3 rounded-lg border border-hairline bg-canvas shadow-subtle">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f5f6f8] border-b border-hairline">
                    {headers.map((h, idx) => (
                      <th key={idx} className="px-3 py-2 border-r border-hairline last:border-r-0 font-bold text-ink uppercase tracking-wider text-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-hairline last:border-b-0 hover:bg-[#fafbfc] transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 border-r border-hairline last:border-r-0 text-body font-normal font-mono text-[11px]">
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }

      const isList = lines.every(line => {
        const t = line.trim();
        return t === "" || t.startsWith("- ") || t.startsWith("* ") || /^\d+\.\s/.test(t);
      }) && lines.some(line => line.trim().startsWith("- ") || line.trim().startsWith("* ") || /^\d+\.\s/.test(line.trim()));

      if (isList) {
        return (
          <ul key={blockKey} className="list-disc pl-5 my-2 space-y-1 text-caption text-body">
            {lines.map((line, lIdx) => {
              const t = line.trim();
              if (!t) return null;
              const cleanText = t.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
              return (
                <li key={lIdx}>
                  {parseInline(cleanText)}
                </li>
              );
            })}
          </ul>
        );
      }

      if (trimmed.startsWith("#")) {
        const hashCount = (trimmed.match(/^#+/) || [""])[0].length;
        const headerText = trimmed.replace(/^#+\s+/, "");
        const inner = parseInline(headerText);
        if (hashCount === 1) return <h1 key={blockKey} className="text-title-lg text-ink font-cal mt-3 mb-2 font-bold">{inner}</h1>;
        if (hashCount === 2) return <h2 key={blockKey} className="text-title-sm text-ink font-cal mt-3 mb-2 font-semibold">{inner}</h2>;
        return <h3 key={blockKey} className="text-caption text-ink font-cal mt-2 mb-1 font-semibold uppercase tracking-wide">{inner}</h3>;
      }

      return (
        <p key={blockKey} className="my-1.5 text-caption text-body leading-relaxed whitespace-pre-wrap">
          {parseInline(blockText)}
        </p>
      );
    };

    const parseBlocks = (text: string, baseKey: string): React.ReactNode[] => {
      const blockTexts = text.split(/\n\s*\n/);
      return blockTexts.map((bt, idx) => parseBlock(bt, `${baseKey}-block-${idx}`)).filter(b => b !== null);
    };

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const before = content.substring(lastIndex, match.index);
      if (before) {
        parts.push(...parseBlocks(before, `before-${lastIndex}`));
      }

      const language = match[1] || "text";
      const codeText = match[2].trim();
      const codeKey = `code-${match.index}`;

      parts.push(
        <div key={codeKey} className="my-3 rounded-lg overflow-hidden border border-hairline shadow-subtle flex flex-col bg-surface-dark-elevated text-[#f8f9fa]">
          <div className="flex justify-between items-center bg-[#1e222b] px-3 py-1.5 border-b border-[#2d3139]">
            <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-[#abb2bf]">{language}</span>
            <button
              onClick={() => handleCopyCode(codeText)}
              className="text-[10px] bg-transparent hover:bg-[#2d3139] border border-[#3e4451] rounded px-2 py-0.5 font-sans text-[#abb2bf] transition-colors"
            >
              Copy
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed bg-[#1d1f25] text-[#abb2bf] whitespace-pre select-all">
            <code>{codeText}</code>
          </pre>
        </div>
      );

      lastIndex = codeBlockRegex.lastIndex;
    }

    const remaining = content.substring(lastIndex);
    if (remaining) {
      parts.push(...parseBlocks(remaining, `remaining-${lastIndex}`));
    }

    return <div className="space-y-1">{parts}</div>;
  };

  // Switch active document
  const handleSelectDoc = (doc: DocumentMeta) => {
    setSelectedDoc(doc);
    setSelectedDocId(doc.id);
    // Auto populate columns helper if doc is tabular
    if (doc.metadata?.is_tabular && doc.metadata?.columns) {
      const cols = doc.metadata.columns;
      // Try to guess a date column and a numeric target
      const dateCol = cols.find((c: string) => c.toLowerCase().includes("date") || c.toLowerCase().includes("time") || c.toLowerCase().includes("year") || c.toLowerCase().includes("month"));
      const targetCol = cols.find((c: string) => c.toLowerCase().includes("sales") || c.toLowerCase().includes("revenue") || c.toLowerCase().includes("cost") || c.toLowerCase().includes("amount") || c.toLowerCase().includes("value"));
      setDateColumn(dateCol || cols[0] || "");
      setTargetColumn(targetCol || cols[1] || cols[0] || "");
    }
    setActiveTab("profile");
    setStatusMsg("");
  };

  // Drag Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  // Generic upload handler
  const uploadFile = async (selectedFile: File) => {
    if (!selectedFile) return;

    setIsUploading(true);
    setIngestionStep(0);
    setStatusMsg("");

    // Simulate progress log changes
    const progressTimer = setInterval(() => {
      setIngestionStep((prev: number) => (prev < ingestionProgressLog.length - 1 ? prev + 1 : prev));
    }, 1800);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(getApiUrl("/api/v1/documents/upload"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to parse document pipeline.");
      }

      setStatusMsg("SUCCESS: File parsed, chunks computed, and indexes generated inside ChromaDB store!");
      await loadWorkspaceData();
    } catch (err: any) {
      clearInterval(progressTimer);
      setStatusMsg(`ERROR: ${err.message || "Upload and ingestion failed."}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Ingest Document upload with progress simulation
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    await uploadFile(file);
    setFile(null);
  };

  // Delete Document
  const handleDeleteDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document and clear its vector embeddings?")) return;

    try {
      const response = await fetch(getApiUrl(`/api/v1/documents/${docId}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setStatusMsg("SUCCESS: Document deleted and index cleared.");
        if (selectedDoc?.id === docId) {
          setSelectedDoc(null);
        }
        await loadWorkspaceData();
      } else {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to delete.");
      }
    } catch (err: any) {
      setStatusMsg(`ERROR: ${err.message || "Delete failed."}`);
    }
  };

  // Forecasting Execution with progress logs
  const handleRunForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) {
      setStatusMsg("ERROR: Select a dataset before triggering analysis.");
      return;
    }
    if (!targetColumn.trim() || !dateColumn.trim()) {
      setStatusMsg("ERROR: Columns config cannot be blank.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep(0);
    setSelectedRun(null);
    setStatusMsg("");

    // Simulate backend steps log
    const progressTimer = setInterval(() => {
      setAnalysisStep((prev: number) => (prev < analysisProgressLog.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      const response = await fetch(getApiUrl("/api/v1/analysis/run"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          document_id: selectedDoc.id,
          target_column: targetColumn.trim(),
          date_column: dateColumn.trim(),
          clean_outliers: cleanOutliers,
          forecast_steps: forecastSteps,
        }),
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Pipeline simulation failed.");
      }

      const data = await response.json();
      setStatusMsg("SUCCESS: Agent completed predictions & regression successfully.");
      
      // Reload history
      await loadWorkspaceData();
      // Load details of this run
      await handleSelectRun(data.analysis_id);
    } catch (err: any) {
      clearInterval(progressTimer);
      setStatusMsg(`ERROR: ${err.message || "Failed to complete model forecast."}`);
      setIsAnalyzing(false);
    }
  };

  // Fetch forecast run details
  const handleSelectRun = async (runId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/v1/analysis/${runId}`), {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedRun(data);
      }
    } catch (err) {
      console.error("Error loading run logs:", err);
    }
  };

  // Select Chat thread
  const handleSelectConversation = async (convId: string) => {
    setActiveConvId(convId);
    setStatusMsg("");
    try {
      const response = await fetch(getApiUrl(`/api/v1/chat/${convId}`), {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Error loading conversation:", err);
    }
  };

  // Start a new thread
  const handleCreateConversation = async () => {
    try {
      const response = await fetch(getApiUrl("/api/v1/chat"), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setActiveConvId(data.id);
        setMessages([]);
        await loadWorkspaceData();
      }
    } catch (err) {
      console.error("Error creating chat thread:", err);
    }
  };

  // Transmit chat message to agent
  const handleSendMessage = async (e: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    
    const textToSend = customMsg ? customMsg.trim() : inputText.trim();
    if (!textToSend || isSending) return;

    if (!activeConvId) {
      // Auto create conversation if none exists
      try {
        const response = await fetch(getApiUrl("/api/v1/chat"), {
          method: "POST",
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          await sendChatMessageOnThread(data.id, textToSend);
        }
      } catch (err) {
        console.error("Error auto-creating conversation:", err);
      }
    } else {
      await sendChatMessageOnThread(activeConvId, textToSend);
    }
  };

  const sendChatMessageOnThread = async (threadId: string, text: string) => {
    setInputText("");
    setIsSending(true);
    setStatusMsg("");

    const userTurn: Message = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev: Message[]) => [...prev, userTurn]);

    try {
      const response = await fetch(getApiUrl(`/api/v1/chat/${threadId}/message`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: text,
          document_id: selectedDocId || null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to communicate with RAG agent.");
      }

      const data = await response.json();
      setMessages(data.conversation.messages);
      await loadWorkspaceData();
    } catch (err: any) {
      setStatusMsg(`ERROR: ${err.message || "Message send failed."}`);
    } finally {
      setIsSending(false);
    }
  };

  // Pre-fills a suggested question from profile and executes search immediately
  const handleSuggestedQuestionClick = (q: string) => {
    setActiveTab("chat");
    setInputText(q);
    handleSendMessage(null as any, q);
  };

  // Compile Executive PDF Report
  const handleGenerateExplanation = async () => {
    if (!selectedAnalysisId) {
      setStatusMsg("ERROR: Select a completed forecast run first.");
      return;
    }
    setIsExplaining(true);
    setStatusMsg("");
    try {
      const response = await fetch(getApiUrl("/api/v1/reports/explain-chart"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          analysis_id: selectedAnalysisId,
          chart_type: reportChartType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate AI explanation.");
      }
      const data = await response.json();
      setChartExplanation(data.explanation);
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`ERROR: ${err.message || "Failed to generate explanation."}`);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleCompileReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnalysisId) {
      setStatusMsg("ERROR: Select a completed forecast run first.");
      return;
    }
    if (!reportTitle.trim()) {
      setStatusMsg("ERROR: Title is required.");
      return;
    }

    setIsCompiling(true);
    setStatusMsg("");

    try {
      const response = await fetch(getApiUrl("/api/v1/reports/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          analysis_id: selectedAnalysisId,
          title: reportTitle.trim(),
          include_chart: includeChart,
          include_metrics: includeMetrics,
          include_logs: includeLogs,
          chart_explanation: chartExplanation || null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Report compiler crash.");
      }

      setReportTitle("");
      setSelectedAnalysisId("");
      setChartExplanation("");
      setStatusMsg("SUCCESS: Executive PDF compiled and registered.");
      await loadWorkspaceData();
    } catch (err: any) {
      setStatusMsg(`ERROR: ${err.message || "Failed to compile report."}`);
    } finally {
      setIsCompiling(false);
    }
  };

  // Delete Report
  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Remove this PDF report permanently from storage?")) return;

    try {
      const response = await fetch(getApiUrl(`/api/v1/reports/${reportId}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setStatusMsg("SUCCESS: Report deleted.");
        await loadWorkspaceData();
      } else {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to delete PDF.");
      }
    } catch (err: any) {
      setStatusMsg(`ERROR: ${err.message || "Delete report failed."}`);
    }
  };

  // Ultimate full workspace reset
  const handleUltimateReset = async () => {
    if (!confirm("WARNING: Are you sure you want to trigger the ultimate workspace reset? This will delete all uploaded datasets, purge all semantic indices from ChromaDB, remove compiled PDF briefs, and reset all workstation configuration controls!")) {
      return;
    }

    setStatusMsg("RESETTING WORKSPACE... PURGING DATA STAGINGS AND INDICES...");

    try {
      const headers = getAuthHeaders();

      // 1. Delete all documents from DB & filesystem & ChromaDB
      for (const doc of documents) {
        await fetch(getApiUrl(`/api/v1/documents/${doc.id}`), {
          method: "DELETE",
          headers,
        });
      }

      // 2. Delete all reports from DB & filesystem
      for (const report of reports) {
        await fetch(getApiUrl(`/api/v1/reports/${report.id}`), {
          method: "DELETE",
          headers,
        });
      }

      // 3. Clear all react state
      setSelectedDoc(null);
      setSelectedDocId("");
      setTargetColumn("");
      setDateColumn("");
      setForecastSteps(12);
      setCleanOutliers(true);
      setChartTheme("darkgrid");
      setChartPalette("deep");
      setChartType("line");
      setShowCI(true);
      setShowMarkers(true);
      setShowTrendLine(false);
      setShowMovingAverage(false);
      setMovingAveragePeriod(3);
      setShowMinMax(false);
      setMessages([]);
      setConversations([]);
      setRuns([]);
      setReports([]);
      setSelectedRun(null);
      setReportTitle("");
      setSelectedAnalysisId("");
      
      // Reload workspace
      await loadWorkspaceData();
      
      setStatusMsg("SUCCESS: Ultimate Workspace Reset Completed successfully. All stagings, indices, brief records, and settings have been cleared!");
    } catch (err: any) {
      setStatusMsg(`ERROR: Reset failed partially: ${err.message || err}`);
    }
  };

  // Export simulation data to CSV
  const handleExportCSV = (config: ChartConfig) => {
    try {
      const { history_dates, history_values, forecast_dates, forecast_values, lower_bounds, upper_bounds } = config;
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Type,Date,Value,Lower Bound (95% CI),Upper Bound (95% CI)\n";
      
      history_dates.forEach((date, i) => {
        csvContent += `Historical,${date},${history_values[i]},,\n`;
      });
      
      forecast_dates.forEach((date, i) => {
        csvContent += `Forecast,${date},${forecast_values[i]},${lower_bounds[i] || ""},${upper_bounds[i] || ""}\n`;
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `forecast_simulation_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMsg("SUCCESS: Simulation data downloaded as CSV.");
    } catch (err: any) {
      setStatusMsg(`ERROR: Failed to export CSV: ${err.message}`);
    }
  };

  // Export simulation chart as SVG
  const handleExportSVG = () => {
    try {
      const svgElement = document.querySelector("#simulation-svg-chart");
      if (!svgElement) {
        setStatusMsg("ERROR: Simulation chart element not found.");
        return;
      }
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = svgUrl;
      downloadLink.download = `forecast_simulation_${new Date().toISOString().slice(0, 10)}.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setStatusMsg("SUCCESS: Simulation chart exported as SVG.");
    } catch (err: any) {
      setStatusMsg(`ERROR: Failed to export SVG: ${err.message}`);
    }
  };

  // Renders Seaborn/Matplotlib style SVG chart with customization options
  const renderSVGChart = (config: ChartConfig) => {
    const { history_values, forecast_values, lower_bounds, upper_bounds } = config;
    if (!history_values || history_values.length === 0) {
      return (
        <div className="p-4 text-center text-muted text-caption">No simulation data available to render.</div>
      );
    }
    
    const allValues = [...history_values, ...forecast_values];
    
    // Build array of values for calculating range
    let rangeValues = [...allValues];
    if (showCI && ["line", "area", "step", "time_series_line", "moving_average", "bollinger", "error_bar", "ci_plot", "rolling_mean", "rolling_std", "seasonal", "trend", "waterfall"].includes(chartType)) {
      rangeValues = [...rangeValues, ...lower_bounds, ...upper_bounds];
    }
    
    const minVal = Math.min(...rangeValues);
    const maxVal = Math.max(...rangeValues);
    const valRange = maxVal - minVal || 1.0;
    
    const padding = valRange * 0.08;
    const yMin = minVal - padding;
    const yMax = maxVal + padding;
    const yRange = yMax - yMin;

    const width = 800;
    const height = 480;
    const leftMargin = 75;
    const rightMargin = 40;
    const topMargin = 60;
    const bottomMargin = 65;

    const chartWidth = width - leftMargin - rightMargin;
    const chartHeight = height - topMargin - bottomMargin;
    const totalPoints = history_values.length + forecast_values.length;
    
    const getX = (index: number) => leftMargin + (index / (totalPoints - 1)) * chartWidth;
    const getY = (value: number) => height - bottomMargin - ((value - yMin) / yRange) * chartHeight;

    const theme = THEMES[chartTheme as keyof typeof THEMES] || THEMES.darkgrid;
    const colors = PALETTES[chartPalette as keyof typeof PALETTES] || PALETTES.deep;

    const cx = width / 2;
    const cy = height / 2 + 10;
    const rMax = 130;

    const isCyber = chartTheme === "cyberpunk";
    const isClassic = chartTheme === "classic";
    const isDark = chartTheme === "dark";

    const histMin = Math.min(...history_values);
    const histMax = Math.max(...history_values);

    const gridTicksY = 5;
    const ticksY = [];
    for (let i = 0; i <= gridTicksY; i++) {
      ticksY.push(yMin + (yRange * i) / gridTicksY);
    }

    const transitionIndex = history_values.length - 1;
    const ticksX = [
      { idx: 0, date: config.history_dates[0] || "Start" },
      { idx: Math.floor(transitionIndex / 2), date: config.history_dates[Math.floor(transitionIndex / 2)] || "Mid History" },
      { idx: transitionIndex, date: config.history_dates[transitionIndex] || "Transition" },
      { idx: transitionIndex + Math.floor(forecast_values.length / 2), date: config.forecast_dates[Math.floor(forecast_values.length / 2)] || "Mid Forecast" },
      { idx: totalPoints - 1, date: config.forecast_dates[config.forecast_dates.length - 1] || "End" }
    ];

    // ----------------------------------------------------
    // FAMILY 1: PIE, DONUT, SUNBURST, CHORD, ICICLE
    // ----------------------------------------------------
    if (["pie", "donut", "sunburst", "chord", "icicle"].includes(chartType)) {
      const sum = history_values.slice(0, 5).reduce((a, b) => a + Math.abs(b), 0) || 1.0;
      let startAngle = -Math.PI / 2;
      const slices = history_values.slice(0, 5).map((val, idx) => {
        const share = Math.abs(val) / sum;
        const angle = share * 2 * Math.PI;
        const endAngle = startAngle + angle;
        
        const x1 = cx + rMax * Math.cos(startAngle);
        const y1 = cy + rMax * Math.sin(startAngle);
        const x2 = cx + rMax * Math.cos(endAngle);
        const y2 = cy + rMax * Math.sin(endAngle);
        
        const largeArc = share > 0.5 ? 1 : 0;
        const slicePath = `M ${cx} ${cy} L ${x1} ${y1} A ${rMax} ${rMax} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        
        const currentStart = startAngle;
        startAngle = endAngle;
        
        const colorList = [colors.history, colors.forecast, colors.trend, colors.ma, colors.ci];
        return {
          path: slicePath,
          color: colorList[idx % colorList.length],
          label: config.history_dates[idx] || `Period ${idx + 1}`,
          value: val,
          start: currentStart,
          end: endAngle
        };
      });

      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            Proportions &amp; Hierarchical Dial ({targetColumn})
          </text>
          
          {isCyber && (
            <defs>
              <filter id="cyber-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          )}

          {chartType === "sunburst" && (
            <g>
              {slices.map((slice, i) => (
                <path key={`inner-${i}`} d={slice.path} fill={slice.color} fillOpacity="0.85" stroke={theme.bg === "#ffffff" ? "#ffffff" : theme.bg} strokeWidth="1.5">
                  <title>{slice.label}&#10;Value: {slice.value.toLocaleString()}</title>
                </path>
              ))}
              {slices.map((slice, i) => {
                const subRMax = rMax + 30;
                const midAngle = (slice.start + slice.end) / 2;
                const x1_1 = cx + subRMax * Math.cos(slice.start);
                const y1_1 = cy + subRMax * Math.sin(slice.start);
                const x2_1 = cx + subRMax * Math.cos(midAngle);
                const y2_1 = cy + subRMax * Math.sin(midAngle);
                
                const x1_2 = cx + subRMax * Math.cos(midAngle);
                const y1_2 = cy + subRMax * Math.sin(midAngle);
                const x2_2 = cx + subRMax * Math.cos(slice.end);
                const y2_2 = cy + subRMax * Math.sin(slice.end);

                const arc1 = `M ${cx + rMax * Math.cos(slice.start)} ${cy + rMax * Math.sin(slice.start)} L ${x1_1} ${y1_1} A ${subRMax} ${subRMax} 0 0 1 ${x2_1} ${y2_1} L ${cx + rMax * Math.cos(midAngle)} ${cy + rMax * Math.sin(midAngle)} Z`;
                const arc2 = `M ${cx + rMax * Math.cos(midAngle)} ${cy + rMax * Math.sin(midAngle)} L ${x1_2} ${y1_2} A ${subRMax} ${subRMax} 0 0 1 ${x2_2} ${y2_2} L ${cx + rMax * Math.cos(slice.end)} ${cy + rMax * Math.sin(slice.end)} Z`;
                
                return (
                  <g key={`outer-group-${i}`}>
                    <path d={arc1} fill={slice.color} fillOpacity="0.6" stroke={theme.bg} strokeWidth="1" />
                    <path d={arc2} fill={slice.color} fillOpacity="0.45" stroke={theme.bg} strokeWidth="1" />
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r="40" fill={theme.bg === "transparent" ? "#ffffff" : theme.bg} stroke="none" />
            </g>
          )}

          {chartType === "chord" && (
            <g>
              {slices.map((slice, i) => (
                <path key={`chord-arc-${i}`} d={`M ${cx + rMax * Math.cos(slice.start)} ${cy + rMax * Math.sin(slice.start)} A ${rMax} ${rMax} 0 0 1 ${cx + rMax * Math.cos(slice.end)} ${cy + rMax * Math.sin(slice.end)}`} fill="none" stroke={slice.color} strokeWidth="12" strokeLinecap="round">
                  <title>{slice.label}</title>
                </path>
              ))}
              {slices.map((slice, i) => {
                if (i >= slices.length - 1) return null;
                const nextSlice = slices[i + 1];
                const x1 = cx + (rMax - 6) * Math.cos((slice.start + slice.end) / 2);
                const y1 = cy + (rMax - 6) * Math.sin((slice.start + slice.end) / 2);
                const x2 = cx + (rMax - 6) * Math.cos((nextSlice.start + nextSlice.end) / 2);
                const y2 = cy + (rMax - 6) * Math.sin((nextSlice.start + nextSlice.end) / 2);
                
                return (
                  <path key={`ribbon-${i}`} d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} fill="none" stroke={slice.color} strokeWidth="4" strokeOpacity="0.45" />
                );
              })}
              {slices.length > 2 && (
                <path d={`M ${cx + (rMax - 6) * Math.cos((slices[0].start + slices[0].end) / 2)} ${cy + (rMax - 6) * Math.sin((slices[0].start + slices[0].end) / 2)} Q ${cx} ${cy} ${cx + (rMax - 6) * Math.cos((slices[slices.length - 1].start + slices[slices.length - 1].end) / 2)} ${cy + (rMax - 6) * Math.sin((slices[slices.length - 1].start + slices[slices.length - 1].end) / 2)}`} fill="none" stroke={slices[0].color} strokeWidth="4" strokeOpacity="0.45" />
              )}
            </g>
          )}

          {chartType === "icicle" && (
            <g>
              <rect x={leftMargin} y={topMargin + 40} width={chartWidth} height="35" fill={colors.history} fillOpacity="0.8" stroke={theme.bg} strokeWidth="2" rx="2" />
              <text x={leftMargin + chartWidth / 2} y={topMargin + 62} fontSize="10" fill="#ffffff" textAnchor="middle" className="font-sans font-bold">Total Root Context</text>

              <rect x={leftMargin} y={topMargin + 80} width={chartWidth * 0.6} height="35" fill={colors.trend} fillOpacity="0.8" stroke={theme.bg} strokeWidth="2" rx="2" />
              <text x={leftMargin + (chartWidth * 0.6) / 2} y={topMargin + 102} fontSize="10" fill="#ffffff" textAnchor="middle" className="font-sans font-bold">Historical (60%)</text>
              <rect x={leftMargin + chartWidth * 0.6} y={topMargin + 80} width={chartWidth * 0.4} height="35" fill={colors.forecast} fillOpacity="0.8" stroke={theme.bg} strokeWidth="2" rx="2" />
              <text x={leftMargin + chartWidth * 0.6 + (chartWidth * 0.4) / 2} y={topMargin + 102} fontSize="10" fill="#ffffff" textAnchor="middle" className="font-sans font-bold">Forecast (40%)</text>

              <rect x={leftMargin} y={topMargin + 120} width={chartWidth * 0.3} height="35" fill={colors.history} fillOpacity="0.65" stroke={theme.bg} strokeWidth="2" rx="2" />
              <text x={leftMargin + (chartWidth * 0.3) / 2} y={topMargin + 142} fontSize="8" fill="#ffffff" textAnchor="middle" className="font-sans">Hist A</text>
              <rect x={leftMargin + chartWidth * 0.3} y={topMargin + 120} width={chartWidth * 0.3} height="35" fill={colors.trend} fillOpacity="0.65" stroke={theme.bg} strokeWidth="2" rx="2" />
              <text x={leftMargin + chartWidth * 0.3 + (chartWidth * 0.3) / 2} y={topMargin + 142} fontSize="8" fill="#ffffff" textAnchor="middle" className="font-sans">Hist B</text>
              <rect x={leftMargin + chartWidth * 0.6} y={topMargin + 120} width={chartWidth * 0.2} height="35" fill={colors.ma} fillOpacity="0.65" stroke={theme.bg} strokeWidth="2" rx="2" />
              <text x={leftMargin + chartWidth * 0.6 + (chartWidth * 0.2) / 2} y={topMargin + 142} fontSize="8" fill="#ffffff" textAnchor="middle" className="font-sans">Fore A</text>
              <rect x={leftMargin + chartWidth * 0.8} y={topMargin + 120} width={chartWidth * 0.2} height="35" fill={colors.ci} fillOpacity="0.65" stroke={theme.bg} strokeWidth="2" rx="2" />
              <text x={leftMargin + chartWidth * 0.8 + (chartWidth * 0.2) / 2} y={topMargin + 142} fontSize="8" fill="#ffffff" textAnchor="middle" className="font-sans">Fore B</text>
            </g>
          )}

          {["pie", "donut"].includes(chartType) && (
            <g>
              {slices.map((slice, i) => (
                <path key={i} d={slice.path} fill={slice.color} fillOpacity="0.85" stroke={theme.bg === "#ffffff" ? "#ffffff" : theme.bg} strokeWidth="1.5">
                  <title>{slice.label}&#10;Share Value: {slice.value.toLocaleString()}</title>
                </path>
              ))}
              {/* Pie/Donut slice value + % labels inside each slice */}
              {slices.map((slice, i) => {
                const midAngle = (slice.start + slice.end) / 2;
                const labelR = chartType === "donut" ? rMax * 0.82 : rMax * 0.62;
                const lx = cx + labelR * Math.cos(midAngle);
                const ly = cy + labelR * Math.sin(midAngle);
                const totalSum = history_values.slice(0, 5).reduce((a, b) => a + Math.abs(b), 0) || 1;
                const pct = Math.round((Math.abs(slice.value) / totalSum) * 100);
                if ((slice.end - slice.start) < 0.25) return null;
                return (
                  <g key={`pie-lbl-${i}`}>
                    <text x={lx} y={ly - 5} fontSize="10" fill="#ffffff" textAnchor="middle" className="font-sans font-bold">
                      {pct}%
                    </text>
                    <text x={lx} y={ly + 9} fontSize="8.5" fill="#ffffff" textAnchor="middle" className="font-mono">
                      {slice.value.toLocaleString([], {maximumFractionDigits: 0})}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          
          {chartType === "donut" && (
            <g>
              <circle cx={cx} cy={cy} r="70" fill={theme.bg === "transparent" ? "#ffffff" : theme.bg} stroke="none" />
              <text x={cx} y={cy - 6} fontSize="11" fill={theme.text} textAnchor="middle" className="font-sans font-bold">Total</text>
              <text x={cx} y={cy + 10} fontSize="10" fill={theme.text} textAnchor="middle" className="font-mono">
                {history_values.slice(0, 5).reduce((a, b) => a + Math.abs(b), 0).toLocaleString([], {maximumFractionDigits: 0})}
              </text>
            </g>
          )}

          {/* Sunburst value labels at inner ring mid-angle */}
          {chartType === "sunburst" && slices.map((slice, i) => {
            const midAngle = (slice.start + slice.end) / 2;
            const lx = cx + rMax * 0.58 * Math.cos(midAngle);
            const ly = cy + rMax * 0.58 * Math.sin(midAngle);
            const totalSum = history_values.slice(0, 5).reduce((a, b) => a + Math.abs(b), 0) || 1;
            const pct = Math.round((Math.abs(slice.value) / totalSum) * 100);
            if ((slice.end - slice.start) < 0.3) return null;
            return (
              <text key={`sun-lbl-${i}`} x={lx} y={ly + 4} fontSize="9" fill="#ffffff" textAnchor="middle" className="font-sans font-bold">
                {pct}%
              </text>
            );
          })}

          {/* Chord value labels at arc mid-point */}
          {chartType === "chord" && slices.map((slice, i) => {
            const midAngle = (slice.start + slice.end) / 2;
            const lx = cx + (rMax + 22) * Math.cos(midAngle);
            const ly = cy + (rMax + 22) * Math.sin(midAngle);
            return (
              <text key={`chord-lbl-${i}`} x={lx} y={ly + 4} fontSize="9" fill={theme.text} textAnchor="middle" className="font-mono">
                {slice.value.toLocaleString([], {maximumFractionDigits: 0})}
              </text>
            );
          })}

          {/* Icicle value labels inside each cell */}
          {chartType === "icicle" && (
            <g>
              <text x={leftMargin + chartWidth / 2} y={topMargin + 54} fontSize="9" fill="rgba(255,255,255,0.7)" textAnchor="middle" className="font-mono">
                {history_values[0]?.toLocaleString([], {maximumFractionDigits: 0}) ?? ""}
              </text>
              <text x={leftMargin + (chartWidth * 0.6) / 2} y={topMargin + 115} fontSize="8" fill="rgba(255,255,255,0.7)" textAnchor="middle" className="font-mono">
                {history_values[0]?.toLocaleString([], {maximumFractionDigits: 0}) ?? ""}
              </text>
              <text x={leftMargin + chartWidth * 0.6 + (chartWidth * 0.4) / 2} y={topMargin + 115} fontSize="8" fill="rgba(255,255,255,0.7)" textAnchor="middle" className="font-mono">
                {history_values[1]?.toLocaleString([], {maximumFractionDigits: 0}) ?? ""}
              </text>
            </g>
          )}

          {/* Pie Legend with % */}
          <g transform={`translate(${width - 155}, ${topMargin})`}>
            {slices.map((slice, i) => {
              const totalSum = history_values.slice(0, 5).reduce((a, b) => a + Math.abs(b), 0) || 1;
              const pct = Math.round((Math.abs(slice.value) / totalSum) * 100);
              return (
                <g key={i} transform={`translate(0, ${i * 22})`}>
                  <rect x="0" y="0" width="12" height="12" fill={slice.color} rx="2" />
                  <text x="18" y="10" fontSize="9" fill={theme.text} className="font-sans font-medium">{slice.label} ({pct}%)</text>
                </g>
              );
            })}
          </g>
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 2: RADAR, POLAR, RADIAL BAR, CIRCULAR HEATMAP
    // ----------------------------------------------------
    if (["radar", "polar", "radial_bar", "circular_heatmap"].includes(chartType)) {
      const radarPoints = history_values.slice(0, 6);
      const angleStep = (2 * Math.PI) / radarPoints.length;
      
      const gridCircles = [0.2, 0.4, 0.6, 0.8, 1.0];
      const maxPointVal = Math.max(...radarPoints) || 1.0;
      
      const polygonPoints: string[] = [];
      const dataNodes = radarPoints.map((val, idx) => {
        const angle = idx * angleStep - Math.PI / 2;
        const dist = (Math.max(0, val) / maxPointVal) * rMax;
        const rx = cx + dist * Math.cos(angle);
        const ry = cy + dist * Math.sin(angle);
        polygonPoints.push(`${rx},${ry}`);
        
        return {
          x: rx, y: ry,
          label: config.history_dates[idx] || `P${idx}`,
          val: val,
          angle: angle,
          dist: dist
        };
      });
      
      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            Radial Web Profile Map
          </text>
          
          {gridCircles.map((scale, i) => {
            const rad = scale * rMax;
            if (chartType === "polar" || chartType === "radial_bar" || chartType === "circular_heatmap") {
              return (
                <circle key={i} cx={cx} cy={cy} r={rad} fill="none" stroke={theme.grid} strokeWidth="1" strokeDasharray={theme.gridDash === "0" ? "2 2" : theme.gridDash} />
              );
            } else {
              const points: string[] = [];
              for (let idx = 0; idx < radarPoints.length; idx++) {
                const angle = idx * angleStep - Math.PI / 2;
                points.push(`${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`);
              }
              return (
                <polygon key={i} points={points.join(" ")} fill="none" stroke={theme.grid} strokeWidth="1" strokeDasharray={theme.gridDash === "0" ? "2 2" : theme.gridDash} />
              );
            }
          })}
          
          {dataNodes.map((node, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const sx = cx + rMax * Math.cos(angle);
            const sy = cy + rMax * Math.sin(angle);
            return (
              <g key={i}>
                <line x1={cx} y1={cy} x2={sx} y2={sy} stroke={theme.grid} strokeWidth="1" />
                <text x={cx + (rMax + 15) * Math.cos(angle)} y={cy + (rMax + 15) * Math.sin(angle) + 4} fontSize="8.5" fill={theme.text} textAnchor="middle" className="font-mono">
                  {node.label}
                </text>
              </g>
            );
          })}

          {chartType === "radial_bar" && (
            <g>
              {dataNodes.map((node, i) => {
                const trackR = 30 + i * 18;
                const endAngle = node.angle;
                const startAngle = -Math.PI / 2;
                const pathX1 = cx + trackR * Math.cos(startAngle);
                const pathY1 = cy + trackR * Math.sin(startAngle);
                const pathX2 = cx + trackR * Math.cos(endAngle);
                const pathY2 = cy + trackR * Math.sin(endAngle);
                const angleDiff = endAngle - startAngle;
                const largeArc = angleDiff > Math.PI ? 1 : 0;
                
                return (
                  <g key={`radbar-${i}`}>
                    <circle cx={cx} cy={cy} r={trackR} fill="none" stroke={theme.grid} strokeWidth="10" strokeOpacity="0.25" />
                    <path d={`M ${pathX1} ${pathY1} A ${trackR} ${trackR} 0 ${largeArc} 1 ${pathX2} ${pathY2}`} fill="none" stroke={colors.history} strokeWidth="10" strokeLinecap="round" />
                  </g>
                );
              })}
            </g>
          )}

          {chartType === "circular_heatmap" && (
            <g>
              {dataNodes.map((node, i) => {
                const ringRad = 40 + i * 25;
                const nextRingRad = ringRad + 22;
                
                return dataNodes.map((subNode, j) => {
                  const sAngle = j * angleStep - Math.PI / 2;
                  const eAngle = (j + 1) * angleStep - Math.PI / 2;
                  const opacity = 0.2 + 0.15 * ((i + j) % 5);
                  
                  const x1 = cx + ringRad * Math.cos(sAngle);
                  const y1 = cy + ringRad * Math.sin(sAngle);
                  const x2 = cx + ringRad * Math.cos(eAngle);
                  const y2 = cy + ringRad * Math.sin(eAngle);
                  const x3 = cx + nextRingRad * Math.cos(eAngle);
                  const y3 = cy + nextRingRad * Math.sin(eAngle);
                  const x4 = cx + nextRingRad * Math.cos(sAngle);
                  const y4 = cy + nextRingRad * Math.sin(sAngle);
                  
                  const cellPath = `M ${x1} ${y1} A ${ringRad} ${ringRad} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${nextRingRad} ${nextRingRad} 0 0 0 ${x4} ${y4} Z`;
                  
                  return (
                    <path key={`chm-${i}-${j}`} d={cellPath} fill={colors.forecast} fillOpacity={opacity} stroke={theme.bg} strokeWidth="1" />
                  );
                });
              })}
            </g>
          )}

          {["radar", "polar"].includes(chartType) && polygonPoints.length > 0 && (
            <polygon points={polygonPoints.join(" ")} fill={colors.history} fillOpacity="0.25" stroke={colors.history} strokeWidth="2.5" />
          )}
          
          {["radar", "polar"].includes(chartType) && dataNodes.map((node, i) => (
            <circle key={i} cx={node.x} cy={node.y} r="4.5" fill={colors.history} stroke="#ffffff" strokeWidth="1">
              <title>{node.label}&#10;Value: {node.val.toLocaleString()}</title>
            </circle>
          ))}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 3: HEATMAPS, CELLS, WAFFLES
    // ----------------------------------------------------
    if (["heatmap", "corr_heatmap", "confusion_matrix", "covariance_matrix", "hexbin", "waffle", "calendar_heatmap", "cluster_map"].includes(chartType)) {
      const gridW = chartType === "waffle" ? 10 : (chartType === "calendar_heatmap" ? 15 : 6);
      const gridH = chartType === "waffle" ? 10 : (chartType === "calendar_heatmap" ? 7 : 5);
      const cellWidth = chartWidth / gridW;
      const cellHeight = chartHeight / gridH;
      
      const cells = [];
      const labelsX = chartType === "calendar_heatmap" 
        ? Array.from({ length: 15 }, (_, i) => `W${i + 1}`) 
        : ["Q1", "Q2", "Q3", "Q4", "Year Start", "Year End"];
      const labelsY = chartType === "calendar_heatmap"
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : ["Category A", "Category B", "Category C", "Category D", "Category E"];
      
      for (let r = 0; r < gridH; r++) {
        for (let c = 0; c < gridW; c++) {
          let val = 0.3 + 0.14 * ((r + c) % 5) - 0.08 * (r % 3);
          if (chartType === "waffle") {
            const index = r * 10 + c;
            const historyRatio = history_values.length / totalPoints;
            val = index < Math.floor(historyRatio * 100) ? 1.0 : -1.0;
          }
          const coeff = Math.min(1.0, Math.max(-1.0, val));
          
          cells.push({
            r, c,
            x: leftMargin + c * cellWidth,
            y: topMargin + r * cellHeight,
            val: coeff
          });
        }
      }
      
      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            {chartType === "waffle" ? "Waffle Proportion Matrix" : `Projections Density Grid Matrix (${chartType === "corr_heatmap" ? "Correlation" : "Distribution Density"})`}
          </text>
          
          {cells.map((cell, i) => {
            let fill = cell.val >= 0 ? colors.history : colors.forecast;
            let opacity = Math.abs(cell.val);
            
            if (chartType === "waffle") {
              fill = cell.val >= 0 ? colors.history : colors.forecast;
              opacity = 0.85;
            }
            
            return (
              <g key={i}>
                <rect x={cell.x + 1} y={cell.y + 1} width={cellWidth - 2} height={cellHeight - 2} fill={fill} fillOpacity={opacity} rx={chartType === "waffle" ? "1.5" : "3"} stroke={theme.grid} strokeWidth="0.5" />
                {chartType !== "waffle" && chartType !== "calendar_heatmap" && (
                  <text x={cell.x + cellWidth / 2} y={cell.y + cellHeight / 2 + 3} fontSize="9" fill={opacity > 0.45 ? "#ffffff" : theme.text} textAnchor="middle" className="font-mono font-bold">
                    {cell.val >= 0 ? "+" : ""}{cell.val.toFixed(2)}
                  </text>
                )}
              </g>
            );
          })}
          
          {chartType === "cluster_map" && (
            <g stroke={theme.text} strokeWidth="1.2" fill="none">
              {labelsY.map((_, r) => {
                const y = topMargin + r * cellHeight + cellHeight / 2;
                return (
                  <path key={`left-dend-${r}`} d={`M ${leftMargin - 20} ${y} L ${leftMargin - 10} ${y}`} />
                );
              })}
              <path d={`M ${leftMargin - 20} ${topMargin + cellHeight / 2} L ${leftMargin - 20} ${topMargin + 4.5 * cellHeight}`} />
              <path d={`M ${leftMargin - 30} ${topMargin + 2.5 * cellHeight} L ${leftMargin - 20} ${topMargin + 2.5 * cellHeight}`} />
              
              {labelsX.map((_, c) => {
                const x = leftMargin + c * cellWidth + cellWidth / 2;
                return (
                  <path key={`top-dend-${c}`} d={`M ${x} ${topMargin - 15} L ${x} ${topMargin - 5}`} />
                );
              })}
              <path d={`M ${leftMargin + cellWidth / 2} ${topMargin - 15} L ${leftMargin + 5.5 * cellWidth} ${topMargin - 15}`} />
              <path d={`M ${leftMargin + 3 * cellWidth} ${topMargin - 20} L ${leftMargin + 3 * cellWidth} ${topMargin - 15}`} />
            </g>
          )}

          {chartType !== "waffle" && labelsY.slice(0, gridH).map((lbl, r) => (
            <text key={r} x={leftMargin - (chartType === "cluster_map" ? 35 : 8)} y={topMargin + r * cellHeight + cellHeight / 2 + 3} fontSize="8" fill={theme.text} textAnchor="end" className="font-mono">
              {lbl}
            </text>
          ))}
          
          {chartType !== "waffle" && labelsX.slice(0, gridW).map((lbl, c) => (
            <text key={c} x={leftMargin + c * cellWidth + cellWidth / 2} y={height - bottomMargin + 15} fontSize="8" fill={theme.text} textAnchor="middle" className="font-mono">
              {lbl}
            </text>
          ))}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 4: DISTRIBUTIONS, DENSITIES, BOXES
    // ----------------------------------------------------
    if (["box", "violin", "boxen", "ridgeline", "histogram", "kde", "freq_polygon", "density", "ecdf", "rug", "qq_plot", "prob_plot"].includes(chartType)) {
      const boxData = [
        { label: "History (Start)", min: yMin + yRange * 0.15, q1: yMin + yRange * 0.3, med: yMin + yRange * 0.45, q3: yMin + yRange * 0.65, max: yMin + yRange * 0.82 },
        { label: "History (Latest)", min: yMin + yRange * 0.22, q1: yMin + yRange * 0.42, med: yMin + yRange * 0.58, q3: yMin + yRange * 0.72, max: yMin + yRange * 0.9 },
        { label: "Forecast (12p)", min: yMin + yRange * 0.1, q1: yMin + yRange * 0.25, med: yMin + yRange * 0.52, q3: yMin + yRange * 0.8, max: yMin + yRange * 0.98 }
      ];
      
      const colWidth = chartWidth / 4;
      const getBoxX = (idx: number) => leftMargin + (idx + 1) * colWidth;
      const isCurve = ["kde", "density", "freq_polygon", "histogram"].includes(chartType);
      
      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            {chartType.toUpperCase()} Projections Distribution &amp; Profiles
          </text>
          
          {ticksY.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={`box-y-${i}`}>
                {theme.showGrid && (
                  <line x1={leftMargin} y1={y} x2={width - rightMargin} y2={y} stroke={theme.grid} strokeWidth="1" strokeDasharray={theme.gridDash === "0" ? undefined : theme.gridDash} />
                )}
                <text x={leftMargin - 10} y={y + 3} fontSize="9" fill={theme.text} textAnchor="end" className="font-mono">
                  {tick.toLocaleString([], { maximumFractionDigits: 1 })}
                </text>
              </g>
            );
          })}

          {["box", "violin", "boxen"].includes(chartType) && boxData.map((box, i) => {
            const x = getBoxX(i);
            const yMinBox = getY(box.min);
            const yQ1 = getY(box.q1);
            const yMed = getY(box.med);
            const yQ3 = getY(box.q3);
            const yMaxBox = getY(box.max);
            
            const boxW = 50;
            const isFore = i === 2;
            const color = isFore ? colors.forecast : colors.history;
            
            return (
              <g key={i}>
                {chartType === "violin" && (
                  <path d={`M ${x} ${yMinBox} C ${x - 35} ${yQ1} ${x - 35} ${yQ3} ${x} ${yMaxBox} C ${x + 35} ${yQ3} ${x + 35} ${yQ1} ${x} ${yMinBox} Z`} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" />
                )}
                
                <line x1={x} y1={yMinBox} x2={x} y2={yMaxBox} stroke={theme.text} strokeWidth="1.5" />
                <line x1={x - 12} y1={yMinBox} x2={x + 12} y2={yMinBox} stroke={theme.text} strokeWidth="1.5" />
                <line x1={x - 12} y1={yMaxBox} x2={x + 12} y2={yMaxBox} stroke={theme.text} strokeWidth="1.5" />
                
                {chartType === "boxen" ? (
                  <g>
                    <rect x={x - 28} y={yQ3} width={56} height={Math.abs(yQ3 - yQ1)} fill={color} fillOpacity="0.5" stroke={theme.text} strokeWidth="1" />
                    <rect x={x - 20} y={yQ3 + 5} width={40} height={Math.abs(yQ3 - yQ1) - 10} fill={color} fillOpacity="0.75" stroke={theme.text} strokeWidth="1" />
                    <rect x={x - 12} y={yQ3 + 10} width={24} height={Math.abs(yQ3 - yQ1) - 20} fill={color} fillOpacity="0.9" stroke={theme.text} strokeWidth="1" />
                  </g>
                ) : (
                  <rect x={x - boxW / 2} y={yQ3} width={boxW} height={Math.abs(yQ3 - yQ1)} fill={color} fillOpacity="0.8" stroke={theme.text} strokeWidth="1.5" rx="2" />
                )}
                
                <line x1={x - boxW / 2} y1={yMed} x2={x + boxW / 2} y2={yMed} stroke="#ffffff" strokeWidth="2.5" />
                <text x={x} y={height - bottomMargin + 18} fontSize="9" fill={theme.text} textAnchor="middle" className="font-sans font-bold">
                  {box.label}
                </text>
                {/* Five-number summary value labels */}
                <text x={x + boxW / 2 + 6} y={yMaxBox + 4} fontSize="8" fill={color} textAnchor="start" className="font-mono">Max: {box.max.toLocaleString([], { maximumFractionDigits: 1 })}</text>
                <text x={x + boxW / 2 + 6} y={yQ3 + 4} fontSize="8" fill={color} textAnchor="start" className="font-mono">Q3: {box.q3.toLocaleString([], { maximumFractionDigits: 1 })}</text>
                <text x={x + boxW / 2 + 6} y={yMed + 4} fontSize="8" fill="#ffffff" textAnchor="start" className="font-mono font-bold">Md: {box.med.toLocaleString([], { maximumFractionDigits: 1 })}</text>
                <text x={x + boxW / 2 + 6} y={yQ1 + 4} fontSize="8" fill={color} textAnchor="start" className="font-mono">Q1: {box.q1.toLocaleString([], { maximumFractionDigits: 1 })}</text>
                <text x={x + boxW / 2 + 6} y={yMinBox + 4} fontSize="8" fill={color} textAnchor="start" className="font-mono">Min: {box.min.toLocaleString([], { maximumFractionDigits: 1 })}</text>
              </g>
            );
          })}

          {chartType === "ridgeline" && (
            <g>
              {[0, 1, 2].map((idx) => {
                const yOffset = topMargin + 40 + idx * 80;
                const baseLineY = yOffset + 60;
                const curveColor = idx === 2 ? colors.forecast : colors.history;
                
                const pts = [];
                for (let xPos = leftMargin; xPos <= width - rightMargin; xPos += 10) {
                  const xNorm = (xPos - leftMargin) / chartWidth;
                  const exponent = -0.5 * Math.pow((xNorm - (0.3 + idx * 0.2)) / 0.15, 2);
                  const yVal = baseLineY - Math.exp(exponent) * 50;
                  pts.push(`${xPos},${yVal}`);
                }
                
                const fillPath = `M ${leftMargin} ${baseLineY} L ${pts.join(" L ")} L ${width - rightMargin} ${baseLineY} Z`;
                const linePath = `M ${pts.join(" L ")}`;
                
                return (
                  <g key={`ridge-${idx}`}>
                    <polygon points={fillPath} fill={curveColor} fillOpacity="0.3" stroke="none" />
                    <path d={linePath} fill="none" stroke={curveColor} strokeWidth="2" />
                    <line x1={leftMargin} y1={baseLineY} x2={width - rightMargin} y2={baseLineY} stroke={theme.text} strokeWidth="1" />
                    <text x={leftMargin - 10} y={baseLineY - 5} fontSize="8.5" fill={theme.text} textAnchor="end" className="font-mono">Ridge {idx + 1}</text>
                  </g>
                );
              })}
            </g>
          )}

          {isCurve && (
            <g>
              {["kde", "density"].includes(chartType) && (() => {
                const pts = [];
                for (let i = 0; i <= totalPoints; i++) {
                  const x = getX(i);
                  const xNorm = i / totalPoints;
                  const exponent = -0.5 * Math.pow((xNorm - 0.45) / 0.2, 2);
                  const y = height - bottomMargin - Math.exp(exponent) * chartHeight * 0.75;
                  pts.push(`${x},${y}`);
                }
                const fillPath = `M ${leftMargin} ${height - bottomMargin} L ${pts.join(" L ")} L ${width - rightMargin} ${height - bottomMargin} Z`;
                return <polygon points={fillPath} fill={colors.history} fillOpacity="0.25" stroke={colors.history} strokeWidth="2.5" />;
              })()}

              {chartType === "freq_polygon" && (() => {
                const pts = [];
                for (let i = 0; i < 12; i++) {
                  const x = leftMargin + (i / 11) * chartWidth;
                  const val = yMin + yRange * (0.2 + 0.5 * Math.sin((i / 11) * Math.PI) + 0.1 * ((i * 3) % 4));
                  pts.push(`${x},${getY(val)}`);
                }
                return <path d={`M ${pts.join(" L ")}`} fill="none" stroke={colors.trend} strokeWidth="2.5" />;
              })()}

              {chartType === "histogram" && (
                <g>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const w = chartWidth / 12;
                    const x = leftMargin + i * w;
                    const exponent = -0.5 * Math.pow((i - 5.5) / 3.0, 2);
                    const binHeight = Math.exp(exponent) * chartHeight * 0.8;
                    const y = height - bottomMargin - binHeight;
                    const binCount = Math.round(Math.exp(exponent) * 40);
                    return (
                      <g key={i}>
                        <rect x={x + 1} y={y} width={w - 2} height={binHeight} fill={colors.history} fillOpacity="0.75" stroke={theme.bg} strokeWidth="0.5" />
                        {binHeight > 20 && (
                          <text x={x + w / 2} y={y - 4} fontSize="8" fill={theme.text} textAnchor="middle" className="font-mono">
                            {binCount}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          )}

          {chartType === "ecdf" && (() => {
            const steps: string[] = [];
            for (let i = 0; i < totalPoints; i++) {
              const x = getX(i);
              const val = yMin + yRange * (i / (totalPoints - 1));
              steps.push(`${x},${getY(val)}`);
            }
            return (
              <path d={`M ${steps.join(" L ")}`} fill="none" stroke={colors.forecast} strokeWidth="3" strokeLinecap="round" />
            );
          })()}

          {chartType === "rug" && (
            <g stroke={colors.history} strokeWidth="1.5">
              {history_values.map((val, idx) => {
                const x = getX(idx);
                return (
                  <line key={`rug-hist-${idx}`} x1={x} y1={height - bottomMargin} x2={x} y2={height - bottomMargin - 12} />
                );
              })}
              {forecast_values.map((val, idx) => {
                const x = getX(history_values.length + idx);
                return (
                  <line key={`rug-fore-${idx}`} x1={x} y1={height - bottomMargin} x2={x} y2={height - bottomMargin - 12} stroke={colors.forecast} />
                );
              })}
            </g>
          )}

          {["qq_plot", "prob_plot"].includes(chartType) && (
            <g>
              <line x1={leftMargin} y1={height - bottomMargin} x2={width - rightMargin} y2={topMargin} stroke={colors.trend} strokeWidth="2" strokeDasharray="5 3" />
              {Array.from({ length: 24 }).map((_, idx) => {
                const pct = idx / 23;
                const jitter = (Math.sin(idx * 2) * 0.04) * chartHeight;
                const cxVal = leftMargin + pct * chartWidth;
                const cyVal = height - bottomMargin - pct * chartHeight + jitter;
                return (
                  <circle key={idx} cx={cxVal} cy={cyVal} r="4.5" fill={colors.history} stroke={theme.text} strokeWidth="0.8" />
                );
              })}
            </g>
          )}

          {theme.border !== "transparent" && (
            <rect x={leftMargin} y={topMargin} width={chartWidth} height={chartHeight} fill="none" stroke={theme.border} strokeWidth="1.2" />
          )}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 5: HIERARCHIES, FLOWS, NETWORKS, WAVEFORMS
    // ----------------------------------------------------
    if (["treemap", "sankey", "alluvial", "dendrogram", "circle_packing", "network", "force_directed", "node_link", "parallel_coordinates", "andrews_curve", "pair", "joint"].includes(chartType)) {
      
      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            Projections Flow Nodes Network Map
          </text>
          
          {isCyber && (
            <defs>
              <filter id="cyber-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          )}

          {chartType === "treemap" && (
            <g stroke={theme.bg} strokeWidth="2">
              <rect x={leftMargin} y={topMargin} width={chartWidth * 0.6} height={chartHeight} fill={colors.history} fillOpacity="0.85" rx="3" />
              <text x={leftMargin + 10} y={topMargin + 25} fontSize="11" fill="#ffffff" className="font-sans font-bold">History Base (60%)</text>
              
              <rect x={leftMargin + chartWidth * 0.6} y={topMargin} width={chartWidth * 0.4} height={chartHeight * 0.5} fill={colors.forecast} fillOpacity="0.85" rx="3" />
              <text x={leftMargin + chartWidth * 0.6 + 10} y={topMargin + 25} fontSize="11" fill="#ffffff" className="font-sans font-bold">Forecast (20%)</text>
              
              <rect x={leftMargin + chartWidth * 0.6} y={topMargin + chartHeight * 0.5} width={chartWidth * 0.2} height={chartHeight * 0.5} fill={colors.trend} fillOpacity="0.85" rx="3" />
              <text x={leftMargin + chartWidth * 0.6 + 10} y={topMargin + chartHeight * 0.5 + 25} fontSize="9" fill="#ffffff" className="font-sans font-bold">Trend (10%)</text>
              
              <rect x={leftMargin + chartWidth * 0.8} y={topMargin + chartHeight * 0.5} width={chartWidth * 0.2} height={chartHeight * 0.5} fill={colors.ma} fillOpacity="0.85" rx="3" />
              <text x={leftMargin + chartWidth * 0.8 + 10} y={topMargin + chartHeight * 0.5 + 25} fontSize="9" fill="#ffffff" className="font-sans font-bold">SMA (10%)</text>
            </g>
          )}

          {["sankey", "alluvial"].includes(chartType) && (() => {
            const bands = [
              { fromY: topMargin + 40, toY: topMargin + 120, h: 45, col: colors.history },
              { fromY: topMargin + 110, toY: topMargin + 60, h: 30, col: colors.trend },
              { fromY: topMargin + 170, toY: topMargin + 210, h: 55, col: colors.forecast },
              { fromY: topMargin + 250, toY: topMargin + 180, h: 40, col: colors.ma }
            ];
            const nodeW = 18;
            return (
              <g>
                {bands.map((band, idx) => {
                  const xStart = leftMargin + 80;
                  const xEnd = width - rightMargin - 80;
                  const cx1 = xStart + chartWidth * 0.35;
                  const cx2 = xStart + chartWidth * 0.45;
                  
                  const p1 = `M ${xStart} ${band.fromY} C ${cx1} ${band.fromY}, ${cx2} ${band.toY}, ${xEnd} ${band.toY}`;
                  const p2 = `L ${xEnd} ${band.toY + band.h} C ${cx2} ${band.toY + band.h}, ${cx1} ${band.fromY + band.h}, ${xStart} ${band.fromY + band.h} Z`;
                  
                  return (
                    <path key={idx} d={`${p1} ${p2}`} fill={band.col} fillOpacity="0.32" stroke={band.col} strokeOpacity="0.6" strokeWidth="0.8" />
                  );
                })}
                <rect x={leftMargin + 80 - nodeW} y={topMargin + 30} width={nodeW} height={80} fill={colors.history} rx="1" />
                <rect x={leftMargin + 80 - nodeW} y={topMargin + 150} width={nodeW} height={130} fill={colors.trend} rx="1" />
                
                <rect x={width - rightMargin - 80} y={topMargin + 40} width={nodeW} height={110} fill={colors.forecast} rx="1" />
                <rect x={width - rightMargin - 80} y={topMargin + 170} width={nodeW} height={90} fill={colors.ma} rx="1" />
              </g>
            );
          })()}

          {chartType === "dendrogram" && (
            <g stroke={colors.history} strokeWidth="2.0" fill="none">
              <path d={`M ${leftMargin + 100} ${topMargin + 60} L ${leftMargin + 100} ${topMargin + 180}`} />
              <path d={`M ${leftMargin + 220} ${topMargin + 120} L ${leftMargin + 220} ${topMargin + 240}`} />
              <path d={`M ${leftMargin + 100} ${topMargin + 120} L ${leftMargin + 220} ${topMargin + 120}`} />
              <path d={`M ${leftMargin + 160} ${topMargin + 120} L ${leftMargin + 160} ${topMargin + 60}`} />
              
              <path d={`M ${leftMargin + 160} ${topMargin + 60} L ${leftMargin + 340} ${topMargin + 60}`} />
              <path d={`M ${leftMargin + 340} ${topMargin + 60} L ${leftMargin + 340} ${topMargin + 300}`} />
              
              <line x1={leftMargin + 100} y1={topMargin + 180} x2={leftMargin + 100} y2={height - bottomMargin} strokeDasharray="3 3" />
              <line x1={leftMargin + 220} y1={topMargin + 240} x2={leftMargin + 220} y2={height - bottomMargin} strokeDasharray="3 3" />
              <line x1={leftMargin + 340} y1={topMargin + 300} x2={leftMargin + 340} y2={height - bottomMargin} strokeDasharray="3 3" />
            </g>
          )}

          {chartType === "circle_packing" && (
            <g stroke={colors.history} strokeWidth="1.5" fill="none">
              <circle cx={cx} cy={cy} r="140" fill={colors.history} fillOpacity="0.05" />
              
              <circle cx={cx - 50} cy={cy - 40} r="50" fill={colors.trend} fillOpacity="0.15" />
              <circle cx={cx - 65} cy={cy - 50} r="18" fill={colors.history} fillOpacity="0.3" />
              <circle cx={cx - 30} cy={cy - 30} r="15" fill={colors.history} fillOpacity="0.3" />
              
              <circle cx={cx + 60} cy={cy + 20} r="60" fill={colors.forecast} fillOpacity="0.15" />
              <circle cx={cx + 35} cy={cy + 10} r="22" fill={colors.ma} fillOpacity="0.3" />
              <circle cx={cx + 75} cy={cy + 40} r="25" fill={colors.ci} fillOpacity="0.3" />
            </g>
          )}

          {["network", "force_directed", "node_link"].includes(chartType) && (() => {
            const nodes = [
              { label: "Data Source", x: leftMargin + 60, y: height / 2 - 80, color: colors.history },
              { label: "Scrubber Node", x: leftMargin + 190, y: height / 2 + 50, color: colors.trend },
              { label: "ARIMA Engine", x: leftMargin + 320, y: height / 2 - 90, color: colors.ma },
              { label: "Prophet Simulator", x: leftMargin + 450, y: height / 2 + 60, color: colors.ci },
              { label: "RAG Context Link", x: leftMargin + 580, y: height / 2 - 80, color: colors.forecast }
            ];
            return (
              <g>
                {nodes.map((node, i) => {
                  if (i === nodes.length - 1) return null;
                  const next = nodes[i + 1];
                  const cx1 = (node.x + next.x) / 2;
                  const cy1 = node.y;
                  const cx2 = (node.x + next.x) / 2;
                  const cy2 = next.y;
                  const path = `M ${node.x} ${node.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${next.x} ${next.y}`;
                  
                  return (
                    <g key={i}>
                      <path d={path} fill="none" stroke={node.color} strokeWidth="3.5" strokeOpacity="0.4" />
                      <path d={path} fill="none" stroke={node.color} strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.8" />
                    </g>
                  );
                })}
                {nodes.map((node, i) => (
                  <g key={i}>
                    <circle cx={node.x} cy={node.y} r="25" fill={node.color} stroke="#ffffff" strokeWidth="2" filter={isCyber ? "url(#cyber-glow)" : undefined} />
                    <text x={node.x} y={node.y + 4} fontSize="8" fill="#ffffff" textAnchor="middle" className="font-mono font-bold">
                      N-{i + 1}
                    </text>
                    <text x={node.x} y={node.y + 36} fontSize="9" fill={theme.text} textAnchor="middle" className="font-sans font-bold">
                      {node.label}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          {chartType === "parallel_coordinates" && (() => {
            const numAxes = 4;
            const axesX = Array.from({ length: numAxes }, (_, i) => leftMargin + (i / (numAxes - 1)) * chartWidth);
            return (
              <g>
                {axesX.map((x, i) => (
                  <g key={`ax-${i}`}>
                    <line x1={x} y1={topMargin} x2={x} y2={height - bottomMargin} stroke={theme.text} strokeWidth="1.5" />
                    <text x={x} y={topMargin - 8} fontSize="9" fill={theme.text} textAnchor="middle" className="font-mono">Axis {i + 1}</text>
                  </g>
                ))}
                {[0.2, 0.45, 0.6, 0.75, 0.9].map((val, idx) => {
                  const points = axesX.map((x, i) => {
                    const factor = Math.sin(val * (i + 1) * 3) * 0.35 + 0.5;
                    const y = topMargin + factor * chartHeight;
                    return `${x},${y}`;
                  });
                  return (
                    <path key={`line-${idx}`} d={`M ${points.join(" L ")}`} fill="none" stroke={idx % 2 === 0 ? colors.history : colors.forecast} strokeWidth="2" strokeOpacity="0.75" />
                  );
                })}
              </g>
            );
          })()}

          {chartType === "andrews_curve" && (() => {
            const waves = [
              { t1: 0.2, t2: 0.8 },
              { t1: -0.4, t2: 0.5 },
              { t1: 0.6, t2: -0.3 },
              { t1: 0.1, t2: 0.9 }
            ];
            return (
              <g fill="none" strokeWidth="2">
                {waves.map((w, idx) => {
                  const pts = [];
                  for (let xPos = leftMargin; xPos <= width - rightMargin; xPos += 5) {
                    const t = -Math.PI + ((xPos - leftMargin) / chartWidth) * 2 * Math.PI;
                    const val = w.t1 / 1.414 + w.t2 * Math.sin(t) + 0.3 * Math.cos(2 * t);
                    const y = cy + val * 70;
                    pts.push(`${xPos},${y}`);
                  }
                  return (
                    <path key={idx} d={`M ${pts.join(" L ")}`} stroke={idx % 2 === 0 ? colors.history : colors.forecast} strokeOpacity="0.8" />
                  );
                })}
              </g>
            );
          })()}

          {/* 8. Pair Plot & Joint Plot Panels */}
          {["pair", "joint"].includes(chartType) && (() => {
            if (chartType === "pair") {
              const panelW = chartWidth / 2 - 10;
              const panelH = chartHeight / 2 - 10;
              const subPanels = [
                { x: leftMargin, y: topMargin },
                { x: leftMargin + panelW + 15, y: topMargin },
                { x: leftMargin, y: topMargin + panelH + 15 },
                { x: leftMargin + panelW + 15, y: topMargin + panelH + 15 }
              ];
              return (
                <g>
                  {subPanels.map((p, i) => (
                    <g key={i}>
                      <rect x={p.x} y={p.y} width={panelW} height={panelH} fill={theme.bg} stroke={theme.border} strokeWidth="1" />
                      {history_values.slice(0, 10).map((v, idx) => {
                        const cxVal = p.x + 10 + (idx / 9) * (panelW - 20);
                        const cyVal = p.y + panelH - 10 - ((v - yMin) / yRange) * (panelH - 20);
                        return <circle key={idx} cx={cxVal} cy={cyVal} r="3" fill={i % 2 === 0 ? colors.history : colors.forecast} />;
                      })}
                    </g>
                  ))}
                </g>
              );
            } else {
              // Joint Plot (central scatter + top & right bars)
              const mainW = chartWidth * 0.75;
              const mainH = chartHeight * 0.75;
              const topBarH = chartHeight * 0.18;
              const rightBarW = chartWidth * 0.18;
              
              return (
                <g>
                  <rect x={leftMargin} y={topMargin + topBarH + 5} width={mainW} height={mainH} fill="none" stroke={theme.border} strokeWidth="1" />
                  {history_values.map((v, idx) => {
                    const cxVal = leftMargin + (idx / (history_values.length - 1)) * mainW;
                    const cyVal = topMargin + topBarH + 5 + mainH - ((v - yMin) / yRange) * mainH;
                    return <circle key={idx} cx={cxVal} cy={cyVal} r="4" fill={colors.history} />;
                  })}
                  {/* Top Histograms */}
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const w = mainW / 10;
                    const x = leftMargin + idx * w;
                    const hVal = 10 + (idx % 4) * 8;
                    return (
                      <rect key={`th-${idx}`} x={x + 1} y={topMargin + topBarH - hVal} width={w - 2} height={hVal} fill={colors.ma} fillOpacity="0.6" />
                    );
                  })}
                  {/* Right Histograms */}
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const h = mainH / 8;
                    const y = topMargin + topBarH + 5 + idx * h;
                    const wVal = 10 + (idx % 3) * 12;
                    return (
                      <rect key={`rh-${idx}`} x={leftMargin + mainW + 5} y={y + 1} width={wVal} height={h - 2} fill={colors.ci} fillOpacity="0.6" />
                    );
                  })}
                </g>
              );
            }
          })()}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 6: ISOMETRIC 3D GRID SPACE
    // ----------------------------------------------------
    if (chartType.startsWith("3d_") || ["3d_scatter", "3d_line", "3d_surface", "3d_wireframe", "3d_contour", "3d_bar", "3d_mesh"].includes(chartType)) {
      const scale = 0.65;
      const project3D = (x: number, y: number, z: number) => {
        const cx3 = width / 2;
        const cy3 = height / 2 + 10;
        const thetaX = -30 * Math.PI / 180;
        const thetaY = 150 * Math.PI / 180;
        const thetaZ = 90 * Math.PI / 180;
        
        const px = cx3 + x * Math.cos(thetaX) + y * Math.cos(thetaY);
        const py = cy3 - (x * Math.sin(thetaX) + y * Math.sin(thetaY) + z * Math.sin(thetaZ));
        return { x: px, y: py };
      };
      
      const originBox = project3D(0, 0, 0);
      const xAxis = project3D(180 * scale, 0, 0);
      const yAxis = project3D(0, 180 * scale, 0);
      const zAxis = project3D(0, 0, 180 * scale);
      
      const points3D = history_values.slice(0, 12).map((val, idx) => {
        const xCoord = (idx / 11) * 160 * scale;
        const yCoord = ((val - yMin) / yRange) * 160 * scale;
        const zCoord = (idx * 8) * scale;
        
        return {
          proj: project3D(xCoord, yCoord, zCoord),
          val: val
        };
      });
      
      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            Isometric 3-Dimensional Projections Grid
          </text>
          
          <line x1={originBox.x} y1={originBox.y} x2={xAxis.x} y2={xAxis.y} stroke={theme.grid} strokeWidth="1.5" />
          <line x1={originBox.x} y1={originBox.y} x2={yAxis.x} y2={yAxis.y} stroke={theme.grid} strokeWidth="1.5" />
          <line x1={originBox.x} y1={originBox.y} x2={zAxis.x} y2={zAxis.y} stroke={theme.grid} strokeWidth="1.5" />
          
          <text x={xAxis.x + 10} y={xAxis.y + 4} fontSize="9" fill={theme.text} className="font-mono">Timeline (X)</text>
          <text x={yAxis.x - 40} y={yAxis.y + 4} fontSize="9" fill={theme.text} className="font-mono">Magnitude (Y)</text>
          <text x={zAxis.x} y={zAxis.y - 10} fontSize="9" fill={theme.text} textAnchor="middle" className="font-mono">Periods (Z)</text>
          
          <line x1={xAxis.x} y1={xAxis.y} x2={project3D(180 * scale, 180 * scale, 0).x} y2={project3D(180 * scale, 180 * scale, 0).y} stroke={theme.grid} strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1={yAxis.x} y1={yAxis.y} x2={project3D(180 * scale, 180 * scale, 0).x} y2={project3D(180 * scale, 180 * scale, 0).y} stroke={theme.grid} strokeWidth="0.8" strokeDasharray="3 3" />
          
          {["3d_line", "3d_wireframe", "3d_surface", "3d_mesh"].includes(chartType) && points3D.length > 1 && (
            <path d={`M ${points3D.map(p => `${p.proj.x},${p.proj.y}`).join(" L ")}`} fill="none" stroke={colors.history} strokeWidth="2.5" />
          )}

          {chartType === "3d_surface" && points3D.length > 1 && (
            <polygon points={`${points3D.map(p => `${p.proj.x},${p.proj.y}`).join(" ")}`} fill={colors.history} fillOpacity="0.2" stroke="none" />
          )}
          
          {chartType === "3d_bar" && points3D.map((p, i) => {
            const base = project3D((i / 11) * 160 * scale, 0, (i * 8) * scale);
            return (
              <line key={i} x1={base.x} y1={base.y} x2={p.proj.x} y2={p.proj.y} stroke={colors.history} strokeWidth="6" strokeLinecap="round" strokeOpacity="0.8" />
            );
          })}
          
          {["3d_scatter", "3d_contour"].includes(chartType) && points3D.map((p, i) => {
            if (chartType === "3d_contour") {
              const base = project3D((i / 11) * 160 * scale, 0, (i * 8) * scale);
              return (
                <circle key={i} cx={base.x} cy={base.y} r={10 + i * 2} fill="none" stroke={colors.trend} strokeOpacity="0.5" strokeWidth="1" />
              );
            }
            return (
              <circle key={i} cx={p.proj.x} cy={p.proj.y} r="5" fill={i % 2 === 0 ? colors.history : colors.forecast} stroke="#ffffff" strokeWidth="1">
                <title>3D Point {i + 1}&#10;Value: {p.val.toLocaleString()}</title>
              </circle>
            );
          })}

          {points3D.map((p, i) => (
            <circle key={i} cx={p.proj.x} cy={p.proj.y} r="3" fill={colors.history} stroke="none" />
          ))}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 7: GEOGRAPHICAL MAPS, FLOW MAPS
    // ----------------------------------------------------
    if (["choropleth", "bubble_map", "density_map", "geo_scatter", "heat_map_on_map", "cartogram", "hexagonal_map", "flow_map"].includes(chartType)) {
      const worldPath = "M 150 180 Q 200 130 250 150 T 350 160 T 450 140 T 550 180 T 650 200 Q 550 280 450 320 T 300 340 T 150 280 Z" + 
                        " M 220 220 C 260 200, 280 280, 240 260 Z" +
                        " M 500 240 C 530 220, 550 270, 520 260 Z";
      
      const pinCoords = [
        { name: "Node US East", x: 230, y: 190, val: history_values[0] },
        { name: "Node EU West", x: 420, y: 170, val: history_values[1] || history_values[0] },
        { name: "Node Asia Pacific", x: 580, y: 200, val: history_values[2] || history_values[0] },
        { name: "Node AU South", x: 620, y: 300, val: history_values[3] || history_values[0] }
      ];
      
      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            Geographical Density Target Map
          </text>
          
          <path d={worldPath} fill={theme.bg === "#ffffff" ? "#f1f5f9" : "#334155"} stroke={theme.grid} strokeWidth="1.5" fillOpacity="0.8" />
          
          {pinCoords.map((pin, i) => {
            const rad = 6 + 12 * (pin.val / Math.max(...history_values));
            return (
              <g key={i}>
                {chartType === "choropleth" ? (
                  <circle cx={pin.x} cy={pin.y} r={rad + 6} fill={colors.history} fillOpacity="0.3" stroke="none" />
                ) : (
                  <circle cx={pin.x} cy={pin.y} r={rad} fill={colors.forecast} fillOpacity="0.85" stroke="#ffffff" strokeWidth="1.2" filter={isCyber ? "url(#cyber-glow)" : undefined} />
                )}
                <circle cx={pin.x} cy={pin.y} r="3" fill="#ffffff" />
                <text x={pin.x} y={pin.y - rad - 5} fontSize="8" fill={theme.text} textAnchor="middle" className="font-mono font-bold">
                  {pin.name}
                </text>
              </g>
            );
          })}

          {chartType === "flow_map" && (
            <g stroke={colors.trend} strokeWidth="1.8" fill="none">
              <path d="M 230 190 Q 325 180 420 170" markerEnd="url(#arrow)" strokeDasharray="3 3" />
              <path d="M 420 170 Q 500 185 580 200" markerEnd="url(#arrow)" />
            </g>
          )}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 8: SPECIALIZED SPEED DIALS, METERS, DIAGNOSTICS
    // ----------------------------------------------------
    if (["gauge", "bullet", "funnel", "word_cloud", "pareto", "mosaic", "marimekko", "streamgraph", "horizon", "gantt", "roc_curve", "precision_recall", "lift_chart", "calibration"].includes(chartType)) {
      const avg = forecast_values.reduce((a, b) => a + b, 0) / (forecast_values.length || 1);
      const ratio = Math.min(1.0, Math.max(0.0, (avg - yMin) / yRange));

      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            Projections Visualization Profile ({chartType.toUpperCase()})
          </text>
          
          {chartType === "gauge" && (() => {
            const angleDeg = 180 + ratio * 180;
            const angleRad = angleDeg * Math.PI / 180;
            const needleX = cx + 110 * Math.cos(angleRad);
            const needleY = cy + 110 * Math.sin(angleRad);
            return (
              <g>
                <path d={`M ${cx - 130} ${cy} A 130 130 0 0 1 ${cx + 130} ${cy}`} fill="none" stroke={theme.grid} strokeWidth="25" strokeLinecap="round" />
                <path d={`M ${cx - 130} ${cy} A 130 130 0 0 1 ${cx - 40} ${cy - 100}`} fill="none" stroke={colors.history} strokeWidth="25" />
                <path d={`M ${cx - 40} ${cy - 100} A 130 130 0 0 1 ${cx + 60} ${cy - 90}`} fill="none" stroke={colors.trend} strokeWidth="25" />
                <path d={`M ${cx + 60} ${cy - 90} A 130 130 0 0 1 ${cx + 130} ${cy}`} fill="none" stroke={colors.forecast} strokeWidth="25" />
                
                <text x={cx - 145} y={cy + 4} fontSize="9.5" fill={theme.text} textAnchor="middle" className="font-mono">Min</text>
                <text x={cx + 145} y={cy + 4} fontSize="9.5" fill={theme.text} textAnchor="middle" className="font-mono">Max</text>
                
                <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={theme.text} strokeWidth="4.5" strokeLinecap="round" filter={isCyber ? "url(#cyber-glow)" : undefined} />
                <circle cx={cx} cy={cy} r="10" fill={theme.text} />
                
                <text x={cx} y={cy + 45} fontSize="12" fill={theme.text} textAnchor="middle" className="font-sans font-bold">
                  Average Projection: {avg.toLocaleString([], { maximumFractionDigits: 1 })}
                </text>
              </g>
            );
          })()}

          {chartType === "word_cloud" && (() => {
            const keywords = [
              { text: targetColumn || "target", size: 28, x: cx, y: cy - 25, color: colors.history },
              { text: dateColumn || "period", size: 22, x: cx - 110, y: cy + 10, color: colors.trend },
              { text: "Forecast Projections", size: 20, x: cx + 130, y: cy - 40, color: colors.forecast },
              { text: config.method, size: 19, x: cx - 50, y: cy - 80, color: colors.ma },
              { text: "Outliers scrubbed", size: 16, x: cx + 90, y: cy + 30, color: colors.ci },
              { text: "95% Confidence", size: 15, x: cx + 20, y: cy + 60, color: colors.history },
              { text: `${forecast_values.length} Periods`, size: 14, x: cx - 140, y: cy - 40, color: colors.trend }
            ];
            return (
              <g>
                {keywords.map((word, i) => (
                  <text key={i} x={word.x} y={word.y} fontSize={word.size} fill={word.color} textAnchor="middle" className={isClassic ? "" : "font-sans font-semibold"} filter={isCyber ? "url(#cyber-glow)" : undefined}>
                    {word.text}
                  </text>
                ))}
              </g>
            );
          })()}

          {chartType === "bullet" && (
            <g transform={`translate(${leftMargin}, ${topMargin + 60})`}>
              <rect x="0" y="0" width={chartWidth} height="40" fill={theme.grid} fillOpacity="0.6" />
              <rect x="0" y="0" width={chartWidth * 0.7} height="40" fill={theme.grid} />
              <rect x="0" y="0" width={chartWidth * 0.4} height="40" fill={theme.grid} fillOpacity="1.4" stroke="#cccccc" strokeWidth="0.5" />
              
              <rect x="0" y="12" width={chartWidth * ratio} height="16" fill={colors.history} />
              <line x1={chartWidth * 0.8} y1="4" x2={chartWidth * 0.8} y2="36" stroke="#ef4444" strokeWidth="4" />
              
              <text x="0" y="55" fontSize="9" fill={theme.text}>Poor</text>
              <text x={chartWidth * 0.4} y="55" fontSize="9" fill={theme.text} textAnchor="middle">Satisfactory</text>
              <text x={chartWidth * 0.7} y="55" fontSize="9" fill={theme.text} textAnchor="middle">Good</text>
              <text x={chartWidth * 0.8} y="55" fontSize="9" fill="#ef4444" textAnchor="middle" className="font-bold">Target</text>
            </g>
          )}

          {chartType === "funnel" && (
            <g>
              {[1.0, 0.75, 0.5, 0.3].map((wRatio, idx) => {
                const wTop = chartWidth * wRatio;
                const wBot = chartWidth * (idx === 3 ? 0.2 : [1.0, 0.75, 0.5, 0.3][idx + 1]);
                const y1 = topMargin + 40 + idx * 75;
                const y2 = y1 + 55;
                
                const x1 = cx - wTop / 2;
                const x2 = cx + wTop / 2;
                const x3 = cx + wBot / 2;
                const x4 = cx - wBot / 2;
                
                const colorList = [colors.history, colors.trend, colors.ma, colors.forecast];
                const stageName = ["Inflow", "Filtered", "Simulated", "Final Target"];
                
                return (
                  <g key={idx}>
                    <polygon points={`${x1},${y1} ${x2},${y1} ${x3},${y2} ${x4},${y2}`} fill={colorList[idx]} fillOpacity="0.8" stroke={theme.bg} strokeWidth="1.5" />
                    <text x={cx} y={y1 + 32} fontSize="10" fill="#ffffff" textAnchor="middle" className="font-sans font-bold">
                      {stageName[idx]} ({Math.round(wRatio * 100)}%)
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {chartType === "pareto" && (() => {
            const data = [100, 75, 50, 35, 20, 10];
            const sum = data.reduce((a, b) => a + b, 0);
            const colW = chartWidth / data.length;
            
            let accum = 0;
            const linePoints: string[] = [];
            
            return (
              <g>
                {data.map((val, idx) => {
                  const x = leftMargin + idx * colW + 4;
                  const barH = (val / 100) * chartHeight * 0.8;
                  const y = height - bottomMargin - barH;
                  
                  accum += val;
                  const cumPct = accum / sum;
                  const lineY = height - bottomMargin - cumPct * chartHeight * 0.8;
                  linePoints.push(`${x + colW / 2},${lineY}`);
                  
                  return (
                    <rect key={idx} x={x} y={y} width={colW - 8} height={barH} fill={colors.history} fillOpacity="0.8" />
                  );
                })}
                <path d={`M ${linePoints.join(" L ")}`} fill="none" stroke={colors.forecast} strokeWidth="2.5" />
                {linePoints.map((pt, i) => {
                  const [px, py] = pt.split(",");
                  return <circle key={i} cx={px} cy={py} r="4" fill={colors.forecast} stroke="#ffffff" strokeWidth="1" />;
                })}
              </g>
            );
          })()}

          {["mosaic", "marimekko"].includes(chartType) && (
            <g stroke={theme.bg} strokeWidth="1.5">
              <rect x={leftMargin} y={topMargin} width={chartWidth * 0.65} height={chartHeight * 0.7} fill={colors.history} fillOpacity="0.8" />
              <rect x={leftMargin} y={topMargin + chartHeight * 0.7} width={chartWidth * 0.65} height={chartHeight * 0.3} fill={colors.trend} fillOpacity="0.8" />
              
              <rect x={leftMargin + chartWidth * 0.65} y={topMargin} width={chartWidth * 0.35} height={chartHeight * 0.4} fill={colors.forecast} fillOpacity="0.8" />
              <rect x={leftMargin + chartWidth * 0.65} y={topMargin + chartHeight * 0.4} width={chartWidth * 0.35} height={chartHeight * 0.6} fill={colors.ma} fillOpacity="0.8" />
            </g>
          )}

          {chartType === "streamgraph" && (() => {
            const paths = [colors.history, colors.trend, colors.forecast];
            return (
              <g>
                {paths.map((col, idx) => {
                  const pts1 = [];
                  const pts2 = [];
                  for (let i = 0; i <= 10; i++) {
                    const x = leftMargin + (i / 10) * chartWidth;
                    const base = cy + Math.sin((i / 10) * Math.PI * 2) * 30;
                    const thickness = 20 + 35 * Math.sin((i / 10) * Math.PI + idx);
                    
                    pts1.push(`${x},${base - thickness / 2 + idx * 25}`);
                    pts2.unshift(`${x},${base + thickness / 2 + idx * 25}`);
                  }
                  const streamPath = `M ${pts1.join(" L ")} L ${pts2.join(" L ")} Z`;
                  return (
                    <path key={idx} d={streamPath} fill={col} fillOpacity="0.65" stroke={col} strokeWidth="0.5" />
                  );
                })}
              </g>
            );
          })()}

          {chartType === "horizon" && (() => {
            const pts = [];
            for (let i = 0; i <= totalPoints; i++) {
              const x = getX(i);
              const factor = 0.2 + 0.6 * Math.sin((i / totalPoints) * Math.PI * 3);
              const y = height - bottomMargin - factor * chartHeight;
              pts.push(`${x},${y}`);
            }
            return (
              <g>
                <polygon points={`M ${leftMargin} ${height - bottomMargin} L ${pts.map(p => p).join(" L ")} L ${width - rightMargin} ${height - bottomMargin} Z`} fill={colors.history} fillOpacity="0.2" />
                <polygon points={`M ${leftMargin} ${height - bottomMargin} L ${pts.map(p => {
                  const [px, py] = p.split(",");
                  const dy = height - bottomMargin - parseFloat(py);
                  const newPy = height - bottomMargin - (dy % (chartHeight * 0.4));
                  return `${px},${newPy}`;
                }).join(" L ")} L ${width - rightMargin} ${height - bottomMargin} Z`} fill={colors.history} fillOpacity="0.45" />
              </g>
            );
          })()}

          {chartType === "gantt" && (() => {
            const tasks = [
              { label: "Data Scrubbing", startPct: 0.0, endPct: 0.35, col: colors.history },
              { label: "Parameter Tuning", startPct: 0.25, endPct: 0.6, col: colors.trend },
              { label: "Prophet Simulation", startPct: 0.5, endPct: 0.85, col: colors.ma },
              { label: "Executive Reporting", startPct: 0.75, endPct: 1.0, col: colors.forecast }
            ];
            return (
              <g>
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={i} x1={leftMargin + i * chartWidth / 4} y1={topMargin} x2={leftMargin + i * chartWidth / 4} y2={height - bottomMargin} stroke={theme.grid} strokeWidth="1" strokeDasharray="3 3" />
                ))}
                {tasks.map((task, idx) => {
                  const y = topMargin + 40 + idx * 60;
                  const x = leftMargin + task.startPct * chartWidth;
                  const w = (task.endPct - task.startPct) * chartWidth;
                  return (
                    <g key={idx}>
                      <rect x={x} y={y} width={w} height={25} fill={task.col} fillOpacity="0.85" rx="3" />
                      <text x={x + 10} y={y + 16} fontSize="9.5" fill="#ffffff" className="font-sans font-bold">{task.label}</text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {["roc_curve", "precision_recall", "lift_chart", "calibration"].includes(chartType) && (
            <g>
              <line x1={leftMargin} y1={height - bottomMargin} x2={width - rightMargin} y2={topMargin} stroke={theme.text} strokeWidth="1.5" strokeDasharray="4 4" />
              {(() => {
                const pts = [];
                for (let i = 0; i <= 10; i++) {
                  const xNorm = i / 10;
                  let yNorm = xNorm;
                  if (chartType === "roc_curve") {
                    yNorm = Math.pow(xNorm, 0.3);
                  } else if (chartType === "precision_recall") {
                    yNorm = 1.0 - Math.pow(xNorm, 2) * 0.6;
                  } else if (chartType === "lift_chart") {
                    yNorm = Math.min(1.0, xNorm * 2.2);
                  } else if (chartType === "calibration") {
                    yNorm = xNorm + Math.sin(xNorm * Math.PI * 2) * 0.06;
                  }
                  
                  const x = leftMargin + xNorm * chartWidth;
                  const y = height - bottomMargin - yNorm * chartHeight;
                  pts.push(`${x},${y}`);
                }
                return (
                  <path d={`M ${pts.join(" L ")}`} fill="none" stroke={colors.history} strokeWidth="3.5" filter={isCyber ? "url(#cyber-glow)" : undefined} />
                );
              })()}
            </g>
          )}

          {theme.border !== "transparent" && (
            <rect x={leftMargin} y={topMargin} width={chartWidth} height={chartHeight} fill="none" stroke={theme.border} strokeWidth="1.2" />
          )}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 9: TIME SERIES, FINANCIAL, VOLATILITIES
    // ----------------------------------------------------
    if (["time_series_line", "rolling_mean", "rolling_std", "seasonal", "trend", "lag", "acf", "pacf", "candlestick", "ohlc", "waterfall", "volume", "moving_average", "bollinger"].includes(chartType)) {
      
      return (
        <svg id="simulation-svg-chart" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded-sm overflow-hidden" style={{ backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg, fontFamily: theme.fontFamily }}>
          <text x={width / 2} y={topMargin - 22} fontSize="14" textAnchor="middle" fill={theme.text} className={isClassic ? "" : "font-sans font-semibold"}>
            Time-Series / Financial Analysis ({chartType.toUpperCase()})
          </text>
          
          {theme.showGrid && ticksY.map((tick, i) => {
            const y = getY(tick);
            return (
              <line key={`ts-y-${i}`} x1={leftMargin} y1={y} x2={width - rightMargin} y2={y} stroke={theme.grid} strokeWidth="1.2" strokeDasharray={theme.gridDash === "0" ? undefined : theme.gridDash} />
            );
          })}
          {ticksY.map((tick, i) => {
            const y = getY(tick);
            return (
              <text key={`ts-y-lbl-${i}`} x={leftMargin - 10} y={y + 3} fontSize="9.5" textAnchor="end" fill={theme.text} className="font-mono">
                {tick.toLocaleString([], { maximumFractionDigits: 1 })}
              </text>
            );
          })}

          {ticksX.map((tick, i) => {
            const x = getX(tick.idx);
            return (
              <g key={`ts-x-${i}`}>
                <line x1={x} y1={height - bottomMargin} x2={x} y2={height - bottomMargin + 4} stroke={theme.border} strokeWidth="1" />
                <text x={x} y={height - bottomMargin + 18} fontSize="9" textAnchor="middle" fill={theme.text} className="font-sans">
                  {tick.date}
                </text>
              </g>
            );
          })}

          {chartType === "candlestick" && (
            <g>
              {history_values.map((val, idx) => {
                const x = getX(idx);
                const isUp = idx % 2 === 0;
                const open = val * (isUp ? 0.96 : 1.04);
                const close = val * (isUp ? 1.04 : 0.96);
                const high = val * 1.08;
                const low = val * 0.92;
                
                const yOpen = getY(open);
                const yClose = getY(close);
                const yHigh = getY(high);
                const yLow = getY(low);
                
                const rectW = 8;
                const fill = isUp ? "#22c55e" : "#ef4444";
                
                return (
                  <g key={`candle-${idx}`}>
                    <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={fill} strokeWidth="1.5" />
                    <rect x={x - rectW / 2} y={Math.min(yOpen, yClose)} width={rectW} height={Math.max(2, Math.abs(yOpen - yClose))} fill={fill} rx="1" />
                    {idx % 3 === 0 && (
                      <text x={x} y={yHigh - 6} fontSize="7.5" fill={fill} textAnchor="middle" className="font-mono">
                        {close.toLocaleString([], { maximumFractionDigits: 1 })}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {chartType === "ohlc" && (
            <g strokeWidth="1.8">
              {history_values.map((val, idx) => {
                const x = getX(idx);
                const isUp = idx % 2 === 0;
                const open = val * (isUp ? 0.97 : 1.03);
                const close = val * (isUp ? 1.03 : 0.97);
                const high = val * 1.07;
                const low = val * 0.93;
                
                const yOpen = getY(open);
                const yClose = getY(close);
                const yHigh = getY(high);
                const yLow = getY(low);
                const strokeCol = isUp ? "#22c55e" : "#ef4444";
                
                return (
                  <g key={`ohlc-${idx}`} stroke={strokeCol}>
                    <line x1={x} y1={yHigh} x2={x} y2={yLow} />
                    <line x1={x - 4} y1={yOpen} x2={x} y2={yOpen} />
                    <line x1={x} y1={yClose} x2={x + 4} y2={yClose} />
                    {idx % 3 === 0 && (
                      <text x={x + 8} y={yHigh - 4} fontSize="7.5" fill={strokeCol} textAnchor="start" className="font-mono" stroke="none">
                        C:{close.toLocaleString([], { maximumFractionDigits: 1 })}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {["acf", "pacf"].includes(chartType) && (
            <g>
              <rect x={leftMargin} y={cy - 25} width={chartWidth} height="50" fill={colors.ci} fillOpacity="0.22" stroke="none" />
              <line x1={leftMargin} y1={cy} x2={width - rightMargin} y2={cy} stroke={theme.text} strokeWidth="1.5" />
              
              {Array.from({ length: 15 }).map((_, idx) => {
                const x = leftMargin + (idx / 14) * chartWidth;
                const coeff = idx === 0 ? 1.0 : (Math.sin(idx) / (idx * 0.7));
                const py = cy - coeff * 80;
                const isAbove = coeff >= 0;
                return (
                  <g key={`pin-${idx}`}>
                    <line x1={x} y1={cy} x2={x} y2={py} stroke={colors.history} strokeWidth="2" />
                    <circle cx={x} cy={py} r="4" fill={colors.forecast} />
                    {/* Correlation coefficient label */}
                    <text x={x} y={isAbove ? py - 8 : py + 16} fontSize="7.5" fill={theme.text} textAnchor="middle" className="font-mono">
                      {coeff.toFixed(2)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {chartType === "waterfall" && (() => {
            let runningSum = history_values[0] || 100;
            return (
              <g>
                {history_values.slice(0, 8).map((val, idx) => {
                  const x = leftMargin + idx * (chartWidth / 8) + 5;
                  const w = (chartWidth / 8) - 10;
                  
                  const isFirst = idx === 0;
                  const increment = isFirst ? 0 : (idx % 2 === 0 ? val * 0.22 : -val * 0.15);
                  
                  const startY = getY(runningSum);
                  runningSum += increment;
                  const endY = getY(runningSum);
                  
                  const barH = isFirst ? (height - bottomMargin - startY) : Math.abs(startY - endY);
                  const barY = isFirst ? startY : Math.min(startY, endY);
                  const fill = isFirst ? colors.history : (increment >= 0 ? "#22c55e" : "#ef4444");
                  const labelY = barY - 6;
                  
                  return (
                    <g key={`wf-${idx}`}>
                      <rect x={x} y={barY} width={w} height={Math.max(2, barH)} fill={fill} fillOpacity="0.8" />
                      {idx > 0 && (
                        <line x1={x - 10} y1={startY} x2={x} y2={startY} stroke={theme.text} strokeWidth="1" strokeDasharray="3 3" />
                      )}
                      {/* Waterfall increment value label */}
                      <text x={x + w / 2} y={labelY} fontSize="8.5" fill={fill} textAnchor="middle" className="font-mono font-bold">
                        {isFirst
                          ? val.toLocaleString([], { maximumFractionDigits: 0 })
                          : (increment >= 0 ? "+" : "") + increment.toLocaleString([], { maximumFractionDigits: 0 })}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {chartType === "lag" && (
            <g>
              {history_values.map((val, idx) => {
                if (idx === 0) return null;
                const prevVal = history_values[idx - 1];
                const cxVal = leftMargin + ((prevVal - yMin) / yRange) * chartWidth;
                const cyVal = getY(val);
                return (
                  <circle key={`lag-${idx}`} cx={cxVal} cy={cyVal} r="5" fill={colors.history} stroke="#ffffff" strokeWidth="1" />
                );
              })}
            </g>
          )}

          {chartType === "seasonal" && (() => {
            const cycles = 3;
            const ptsPerCycle = Math.floor(history_values.length / cycles) || 4;
            
            return (
              <g fill="none" strokeWidth="2.5">
                {Array.from({ length: cycles }).map((cIdx) => {
                  const pts = [];
                  for (let i = 0; i < ptsPerCycle; i++) {
                    const idx = cIdx * ptsPerCycle + i;
                    if (idx < history_values.length) {
                      const x = leftMargin + (i / (ptsPerCycle - 1)) * chartWidth;
                      const y = getY(history_values[idx]);
                      pts.push(`${x},${y}`);
                    }
                  }
                  const cycleColors = [colors.history, colors.trend, colors.ma];
                  return (
                    <path key={cIdx} d={`M ${pts.join(" L ")}`} stroke={cycleColors[cIdx % cycleColors.length]} />
                  );
                })}
              </g>
            );
          })()}

          {chartType === "bollinger" && (() => {
            const ptsUpper: string[] = [];
            const ptsLower: string[] = [];
            const ptsMA: string[] = [];
            
            history_values.forEach((val, idx) => {
              const x = getX(idx);
              const dev = valRange * 0.12 * (1.0 + 0.5 * Math.sin(idx / 2));
              const ma = val * 0.98 + (Math.sin(idx) * valRange * 0.05);
              
              ptsUpper.push(`${x},${getY(ma + dev)}`);
              ptsLower.unshift(`${x},${getY(ma - dev)}`);
              ptsMA.push(`${x},${getY(ma)}`);
            });
            
            const envelopePath = `M ${ptsUpper.join(" L ")} L ${ptsLower.join(" L ")} Z`;
            
            return (
              <g>
                <path d={envelopePath} fill={colors.ci} fillOpacity="0.18" stroke="none" />
                <path d={`M ${ptsUpper.join(" L ")}`} fill="none" stroke={colors.ci} strokeWidth="1" strokeDasharray="3 3" />
                <path d={`M ${ptsLower.reverse().join(" L ")}`} fill="none" stroke={colors.ci} strokeWidth="1" strokeDasharray="3 3" />
                <path d={`M ${ptsMA.join(" L ")}`} fill="none" stroke={colors.ma} strokeWidth="2.2" />
                <path d={`M ${history_values.map((v, i) => `${getX(i)},${getY(v)}`).join(" L ")}`} fill="none" stroke={colors.history} strokeWidth="2" />
              </g>
            );
          })()}

          {["rolling_mean", "moving_average", "rolling_std", "trend", "time_series_line", "volume"].includes(chartType) && (() => {
            const ptsRaw = history_values.map((v, i) => `${getX(i)},${getY(v)}`).join(" L ");
            const ptsFore = forecast_values.map((v, i) => `${getX(history_values.length + i)},${getY(v)}`).join(" L ");
            
            const maList1: string[] = [];
            const maList2: string[] = [];
            
            history_values.forEach((val, idx) => {
              const x = getX(idx);
              const avg1 = val * 0.96 + Math.sin(idx / 3) * valRange * 0.04;
              const avg2 = val * 0.94 - Math.cos(idx / 2) * valRange * 0.06;
              maList1.push(`${x},${getY(avg1)}`);
              maList2.push(`${x},${getY(avg2)}`);
            });
            
            return (
              <g>
                <path d={`M ${ptsRaw}`} fill="none" stroke={colors.history} strokeWidth="2.5" />
                <path d={`M ${getX(history_values.length - 1)},${getY(history_values[history_values.length - 1])} L ${ptsFore}`} fill="none" stroke={colors.forecast} strokeWidth="2.5" strokeDasharray="5 3" />
                
                {chartType === "rolling_mean" && (
                  <path d={`M ${maList1.join(" L ")}`} fill="none" stroke={colors.trend} strokeWidth="3.2" />
                )}
                
                {chartType === "moving_average" && (
                  <g>
                    <path d={`M ${maList1.join(" L ")}`} fill="none" stroke={colors.trend} strokeWidth="2" />
                    <path d={`M ${maList2.join(" L ")}`} fill="none" stroke={colors.ma} strokeWidth="2" />
                  </g>
                )}
                
                {chartType === "rolling_std" && (
                  <path d={`M ${maList2.join(" L ")}`} fill="none" stroke={colors.ci} strokeWidth="2" strokeDasharray="4 4" />
                )}
                
                {chartType === "trend" && (
                  <line x1={leftMargin} y1={getY(history_values[0])} x2={width - rightMargin} y2={getY(forecast_values[forecast_values.length - 1] || history_values[history_values.length - 1])} stroke={colors.trend} strokeWidth="3" />
                )}

                {chartType === "volume" && (
                  <g>
                    {history_values.map((val, idx) => {
                      const x = getX(idx) - 2;
                      const hVal = 10 + 30 * (val / Math.max(...history_values));
                      return (
                        <rect key={`vol-${idx}`} x={x} y={height - bottomMargin - hVal} width="4" height={hVal} fill={colors.history} fillOpacity="0.45" />
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })()}

          {theme.border !== "transparent" && (
            <rect x={leftMargin} y={topMargin} width={chartWidth} height={chartHeight} fill="none" stroke={theme.border} strokeWidth="1.2" />
          )}
        </svg>
      );
    }

    // ----------------------------------------------------
    // FAMILY 10: DEFAULT CARTESIAN PLOTS (LINE, BAR, SCATTER, STEP, AREA, ETC.)
    // ----------------------------------------------------
    const polygonPath = (showCI && forecast_values.length > 0)
      ? (() => {
          const polygonPoints: string[] = [];
          forecast_values.forEach((_, idx) => {
            const x = getX(history_values.length + idx);
            const y = getY(upper_bounds[idx]);
            polygonPoints.push(`${x},${y}`);
          });
          for (let idx = forecast_values.length - 1; idx >= 0; idx--) {
            const x = getX(history_values.length + idx);
            const y = getY(lower_bounds[idx]);
            polygonPoints.push(`${x},${y}`);
          }
          return polygonPoints.join(" ");
        })()
      : "";

    const historyPoints: string[] = [];
    history_values.forEach((val, idx) => {
      historyPoints.push(`${getX(idx)},${getY(val)}`);
    });
    const historyPath = `M ${historyPoints.join(" L ")}`;

    const forecastPoints: string[] = [];
    if (history_values.length > 0) {
      forecastPoints.push(`${getX(history_values.length - 1)},${getY(history_values[history_values.length - 1])}`);
    }
    forecast_values.forEach((val, idx) => {
      forecastPoints.push(`${getX(history_values.length + idx)},${getY(val)}`);
    });
    const forecastPath = `M ${forecastPoints.join(" L ")}`;

    let trendPath = "";
    if (showTrendLine && history_values.length > 1) {
      const n = history_values.length;
      const xMean = (n - 1) / 2;
      const yMean = history_values.reduce((sum, v) => sum + v, 0) / n;
      
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (history_values[i] - yMean);
        den += (i - xMean) * (i - xMean);
      }
      
      const slope = den !== 0 ? num / den : 0;
      const intercept = yMean - slope * xMean;
      
      const trendPoints: string[] = [];
      for (let i = 0; i < totalPoints; i++) {
        const val = slope * i + intercept;
        trendPoints.push(`${getX(i)},${getY(val)}`);
      }
      trendPath = `M ${trendPoints.join(" L ")}`;
    }

    let maPath = "";
    if (showMovingAverage && history_values.length > 0) {
      const k = movingAveragePeriod;
      const maPoints: string[] = [];
      for (let i = 0; i < history_values.length; i++) {
        let sum = 0;
        let count = 0;
        const start = Math.max(0, i - k + 1);
        for (let j = start; j <= i; j++) {
          sum += history_values[j];
          count++;
        }
        const avg = sum / count;
        maPoints.push(`${getX(i)},${getY(avg)}`);
      }
      maPath = `M ${maPoints.join(" L ")}`;
    }

    const barWidth = Math.max(1.5, (chartWidth / totalPoints) * 0.55);

    return (
      <svg 
        id="simulation-svg-chart"
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto rounded-sm overflow-hidden" 
        style={{ 
          backgroundColor: theme.bg === "transparent" ? "transparent" : theme.bg,
          fontFamily: theme.fontFamily,
        }}
      >
        {isCyber && (
          <defs>
            <filter id="cyber-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        
        <text 
          x={width / 2} 
          y={topMargin - 22} 
          className={isClassic ? "" : "font-sans font-semibold"} 
          fontSize="14" 
          textAnchor="middle" 
          stroke="none" 
          fill={theme.text}
        >
          {config.method} Projections Simulation ({targetColumn} over Time)
        </text>

        {theme.bg !== "transparent" && (
          <rect x={leftMargin} y={topMargin} width={chartWidth} height={chartHeight} fill={theme.bg} stroke="none" />
        )}

        {theme.showGrid && ticksY.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={`y-grid-${i}`}>
              <line 
                x1={leftMargin} 
                y1={y} 
                x2={width - rightMargin} 
                y2={y} 
                stroke={theme.grid} 
                strokeWidth="1.2" 
                strokeDasharray={theme.gridDash === "0" ? undefined : theme.gridDash}
              />
              <text 
                x={leftMargin - 10} 
                y={y + 3} 
                className={isClassic ? "" : "font-sans font-medium"} 
                fontSize="9.5" 
                textAnchor="end" 
                fill={theme.text} 
                stroke="none"
              >
                {tick.toLocaleString([], { maximumFractionDigits: 1 })}
              </text>
            </g>
          );
        })}

        {!theme.showGrid && ticksY.map((tick, i) => {
          const y = getY(tick);
          return (
            <text 
              key={`y-tick-only-${i}`}
              x={leftMargin - 10} 
              y={y + 3} 
              className={isClassic ? "" : "font-sans font-medium"} 
              fontSize="9.5" 
              textAnchor="end" 
              fill={theme.text} 
              stroke="none"
            >
              {tick.toLocaleString([], { maximumFractionDigits: 1 })}
            </text>
          );
        })}

        {ticksX.map((tick, i) => {
          const x = getX(tick.idx);
          return (
            <g key={`x-grid-${i}`}>
              {theme.showGrid && (
                <line 
                  x1={x} 
                  y1={topMargin} 
                  x2={x} 
                  y2={height - bottomMargin} 
                  stroke={theme.grid} 
                  strokeWidth="1.2" 
                  strokeDasharray={theme.gridDash === "0" ? undefined : theme.gridDash}
                />
              )}
              {isClassic && (
                <line x1={x} y1={height - bottomMargin} x2={x} y2={height - bottomMargin + 4} stroke={theme.border} strokeWidth="1" />
              )}
              <text 
                x={x} 
                y={height - bottomMargin + 18} 
                className={isClassic ? "" : "font-sans"} 
                fontSize="9" 
                textAnchor="middle" 
                fill={theme.text} 
                stroke="none"
              >
                {tick.date}
              </text>
            </g>
          );
        })}

        {showMinMax && history_values.length > 0 && (
          <g>
            <line 
              x1={leftMargin} 
              y1={getY(histMax)} 
              x2={width - rightMargin} 
              y2={getY(histMax)} 
              stroke="#e11d48" 
              strokeWidth="1.2" 
              strokeDasharray="4 4" 
            />
            <text 
              x={width - rightMargin - 6} 
              y={getY(histMax) - 6} 
              fontSize="8.5" 
              fill="#e11d48" 
              className="font-mono" 
              textAnchor="end" 
              stroke="none"
            >
              Max Bound: {histMax.toLocaleString([], { maximumFractionDigits: 1 })}
            </text>

            <line 
              x1={leftMargin} 
              y1={getY(histMin)} 
              x2={width - rightMargin} 
              y2={getY(histMin)} 
              stroke="#0891b2" 
              strokeWidth="1.2" 
              strokeDasharray="4 4" 
            />
            <text 
              x={width - rightMargin - 6} 
              y={getY(histMin) + 12} 
              fontSize="8.5" 
              fill="#0891b2" 
              className="font-mono" 
              textAnchor="end" 
              stroke="none"
            >
              Min Bound: {histMin.toLocaleString([], { maximumFractionDigits: 1 })}
            </text>
          </g>
        )}

        {["line", "multi_line", "area", "stacked_area", "step"].includes(chartType) && (
          <>
            {showCI && polygonPath && ["line", "step", "area"].includes(chartType) && (
              <polygon points={polygonPath} fill={colors.ci} fillOpacity={isDark || isCyber ? "0.14" : "0.18"} stroke="none" />
            )}

            {chartType === "line" && (
              <>
                <path d={historyPath} stroke={colors.history} strokeWidth="2.5" fill="none" filter={isCyber ? "url(#cyber-glow)" : undefined} />
                <path d={forecastPath} stroke={colors.forecast} strokeWidth="2.5" strokeDasharray="5 3" fill="none" filter={isCyber ? "url(#cyber-glow)" : undefined} />
              </>
            )}

            {chartType === "step" && (() => {
              const buildStepPath = (vals: number[], startIdx: number) => {
                const pts: string[] = [];
                vals.forEach((v, i) => {
                  const currX = getX(startIdx + i);
                  const currY = getY(v);
                  if (i === 0) {
                    pts.push(`${currX},${currY}`);
                  } else {
                    pts.push(`${currX},${getY(vals[i - 1])}`);
                    pts.push(`${currX},${currY}`);
                  }
                });
                return `M ${pts.join(" L ")}`;
              };
              return (
                <>
                  <path d={buildStepPath(history_values, 0)} stroke={colors.history} strokeWidth="2.5" fill="none" />
                  <path d={buildStepPath([history_values[history_values.length - 1], ...forecast_values], history_values.length - 1)} stroke={colors.forecast} strokeWidth="2.5" strokeDasharray="5 3" fill="none" />
                </>
              );
            })()}

            {chartType === "multi_line" && (
              <>
                <path d={historyPath} stroke={colors.history} strokeWidth="2.5" fill="none" />
                <path d={forecastPath} stroke={colors.forecast} strokeWidth="2.5" strokeDasharray="5 3" fill="none" />
                <path d={`M ${history_values.map((v, i) => `${getX(i)},${getY(v + valRange * 0.15)}`).join(" L ")}`} stroke={colors.trend} strokeWidth="1.8" fill="none" />
                <path d={`M ${history_values.map((v, i) => `${getX(i)},${getY(v - valRange * 0.15)}`).join(" L ")}`} stroke={colors.ma} strokeWidth="1.8" fill="none" />
              </>
            )}

            {chartType === "area" && (
              <polygon points={`${leftMargin},${height - bottomMargin} ${historyPoints.join(" ")} ${width - rightMargin},${height - bottomMargin}`} fill={colors.history} fillOpacity="0.25" stroke={colors.history} strokeWidth="2.5" />
            )}

            {chartType === "stacked_area" && (
              <g>
                <polygon points={`${leftMargin},${height - bottomMargin} ${history_values.map((v, i) => `${getX(i)},${getY(v * 0.5)}`).join(" ")} ${width - rightMargin},${height - bottomMargin}`} fill={colors.trend} fillOpacity="0.45" stroke={colors.trend} strokeWidth="1.5" />
                <polygon points={`${leftMargin},${height - bottomMargin} ${history_values.map((v, i) => `${getX(i)},${getY(v * 1.2)}`).join(" ")} ${width - rightMargin},${height - bottomMargin}`} fill={colors.history} fillOpacity="0.3" stroke={colors.history} strokeWidth="2" />
              </g>
            )}
          </>
        )}

        {["bar", "horizontal_bar", "grouped_bar", "stacked_bar", "stacked_bar_100", "count_plot"].includes(chartType) && (
          <g>
            {chartType === "horizontal_bar" ? (
              history_values.slice(0, 10).map((val, idx) => {
                const barH = 15;
                const barY = topMargin + idx * (chartHeight / 10) + (chartHeight / 20) - barH / 2;
                const barW = Math.max(2, ((val - yMin) / yRange) * chartWidth);
                return (
                  <rect 
                    key={`hbar-${idx}`}
                    x={leftMargin}
                    y={barY}
                    width={barW}
                    height={barH}
                    fill={colors.history}
                    fillOpacity="0.8"
                    rx="2"
                  >
                    <title>Value: {val.toLocaleString()}</title>
                  </rect>
                );
              })
            ) : chartType === "grouped_bar" ? (
              history_values.map((val, idx) => {
                const x1 = getX(idx) - barWidth / 2;
                const x2 = getX(idx);
                const y1 = getY(val);
                const y2 = getY(val * 0.8 + valRange * 0.05);
                return (
                  <g key={`grouped-${idx}`}>
                    <rect x={x1} y={y1} width={barWidth / 2 - 1} height={Math.max(1, height - bottomMargin - y1)} fill={colors.history} />
                    <rect x={x2} y={y2} width={barWidth / 2 - 1} height={Math.max(1, height - bottomMargin - y2)} fill={colors.trend} />
                  </g>
                );
              })
            ) : chartType === "stacked_bar" || chartType === "stacked_bar_100" ? (
              history_values.map((val, idx) => {
                const x = getX(idx) - barWidth / 2;
                const factor = chartType === "stacked_bar_100" ? (val / (val * 1.5)) : 1;
                const yBottom = getY(val * 0.7 * factor);
                const yTop = getY(val * factor);
                
                return (
                  <g key={`stacked-${idx}`}>
                    <rect x={x} y={yBottom} width={barWidth} height={Math.max(1, height - bottomMargin - yBottom)} fill={colors.history} />
                    <rect x={x} y={yTop} width={barWidth} height={Math.max(1, yBottom - yTop)} fill={colors.forecast} fillOpacity="0.7" />
                  </g>
                );
              })
            ) : (
              <>
                {history_values.map((val, idx) => {
                  const x = getX(idx) - barWidth / 2;
                  const y = getY(val);
                  const barHeight = Math.max(1, Math.abs(height - bottomMargin - y));
                  const topY = Math.min(height - bottomMargin, y);
                  return (
                    <rect 
                      key={`hist-bar-${idx}`}
                      x={x}
                      y={topY}
                      width={barWidth}
                      height={barHeight}
                      fill={colors.history}
                      fillOpacity={isCyber ? "0.7" : "0.8"}
                      stroke={isCyber ? colors.history : "none"}
                      strokeWidth={isCyber ? "1" : "0"}
                      className="cursor-pointer transition-all duration-150 hover:fill-opacity-100 hover:stroke-black hover:stroke-1"
                      onMouseEnter={() => setHoveredPoint({ x: x + barWidth / 2, y: topY, date: config.history_dates[idx] || "", value: val, type: "Historical" })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <title>Date: {config.history_dates[idx]}&#10;Value: {val.toLocaleString()}&#10;Type: Historical</title>
                    </rect>
                  );
                })}

                {forecast_values.map((val, idx) => {
                  const x = getX(history_values.length + idx) - barWidth / 2;
                  const y = getY(val);
                  const barHeight = Math.max(1, Math.abs(height - bottomMargin - y));
                  const topY = Math.min(height - bottomMargin, y);
                  return (
                    <rect 
                      key={`forecast-bar-${idx}`}
                      x={x}
                      y={topY}
                      width={barWidth}
                      height={barHeight}
                      fill={colors.forecast}
                      fillOpacity="0.4"
                      stroke={colors.forecast}
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      className="cursor-pointer transition-all duration-150 hover:fill-opacity-80 hover:stroke-black hover:stroke-1"
                      onMouseEnter={() => setHoveredPoint({ x: x + barWidth / 2, y: topY, date: config.forecast_dates[idx] || "", value: val, type: "Forecast Projection" })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <title>Date: {config.forecast_dates[idx]}&#10;Value: {val.toLocaleString()}&#10;Type: Forecast Projection</title>
                    </rect>
                  );
                })}
              </>
            )}

            {chartType === "horizontal_bar" && history_values.slice(0, 10).map((val, idx) => {
              const barH = 15;
              const barY = topMargin + idx * (chartHeight / 10) + (chartHeight / 20) - barH / 2;
              const barW = Math.max(2, ((val - yMin) / yRange) * chartWidth);
              return (
                <g key={`hbar-lbl-${idx}`}>
                  <text x={leftMargin + barW + 7} y={barY + barH / 2 + 4} fontSize="9" fill={theme.text} textAnchor="start" className="font-mono font-bold">
                    {val.toLocaleString([], { maximumFractionDigits: 1 })}
                  </text>
                  <text x={leftMargin - 6} y={barY + barH / 2 + 4} fontSize="8.5" fill={theme.text} textAnchor="end" className="font-sans">
                    {config.history_dates[idx] || `#${idx + 1}`}
                  </text>
                </g>
              );
            })}

            {chartType === "grouped_bar" && history_values.map((val, idx) => {
              const x1 = getX(idx) - barWidth / 2;
              const x2 = getX(idx);
              const y1 = getY(val);
              const y2 = getY(val * 0.8 + valRange * 0.05);
              return barWidth > 10 ? (
                <g key={`grouped-lbl-${idx}`}>
                  <text x={x1 + barWidth / 4 - 1} y={y1 - 5} fontSize="8" fill={colors.history} textAnchor="middle" className="font-mono">
                    {val.toLocaleString([], { maximumFractionDigits: 0 })}
                  </text>
                  <text x={x2 + barWidth / 4 - 1} y={y2 - 5} fontSize="8" fill={colors.trend} textAnchor="middle" className="font-mono">
                    {(val * 0.8 + valRange * 0.05).toLocaleString([], { maximumFractionDigits: 0 })}
                  </text>
                </g>
              ) : null;
            })}

            {(chartType === "stacked_bar" || chartType === "stacked_bar_100") && history_values.map((val, idx) => {
              const x = getX(idx) - barWidth / 2;
              const factor = chartType === "stacked_bar_100" ? (val / (val * 1.5)) : 1;
              const yBottom = getY(val * 0.7 * factor);
              const yTop = getY(val * factor);
              const seg1H = Math.max(1, height - bottomMargin - yBottom);
              const seg2H = Math.max(1, yBottom - yTop);
              return barWidth > 12 ? (
                <g key={`stacked-lbl-${idx}`}>
                  {seg1H > 16 && (
                    <text x={x + barWidth / 2} y={yBottom + seg1H / 2 + 4} fontSize="7.5" fill="#ffffff" textAnchor="middle" className="font-mono">
                      {chartType === "stacked_bar_100" ? "47%" : val.toLocaleString([], { maximumFractionDigits: 0 })}
                    </text>
                  )}
                  {seg2H > 16 && (
                    <text x={x + barWidth / 2} y={yTop + seg2H / 2 + 4} fontSize="7.5" fill="#ffffff" textAnchor="middle" className="font-mono">
                      {chartType === "stacked_bar_100" ? "53%" : (val * 0.3 * factor).toLocaleString([], { maximumFractionDigits: 0 })}
                    </text>
                  )}
                  <text x={x + barWidth / 2} y={yTop - 5} fontSize="8.5" fill={theme.text} textAnchor="middle" className="font-mono font-bold">
                    {(val * factor).toLocaleString([], { maximumFractionDigits: 0 })}
                  </text>
                </g>
              ) : null;
            })}

            {!["horizontal_bar", "grouped_bar", "stacked_bar", "stacked_bar_100"].includes(chartType) && (
              <>
                {history_values.map((val, idx) => {
                  const x = getX(idx) - barWidth / 2;
                  const y = getY(val);
                  const topY = Math.min(height - bottomMargin, y);
                  return barWidth > 8 ? (
                    <text key={`hist-bar-lbl-${idx}`} x={x + barWidth / 2} y={topY - 5} fontSize="8.5" fill={theme.text} textAnchor="middle" className="font-mono font-bold">
                      {val.toLocaleString([], { maximumFractionDigits: 0 })}
                    </text>
                  ) : null;
                })}
                {forecast_values.map((val, idx) => {
                  const x = getX(history_values.length + idx) - barWidth / 2;
                  const y = getY(val);
                  const topY = Math.min(height - bottomMargin, y);
                  return barWidth > 8 ? (
                    <text key={`fore-bar-lbl-${idx}`} x={x + barWidth / 2} y={topY - 5} fontSize="8.5" fill={colors.forecast} textAnchor="middle" className="font-mono font-bold">
                      {val.toLocaleString([], { maximumFractionDigits: 0 })}
                    </text>
                  ) : null;
                })}
              </>
            )}
          </g>
        )}

        {["scatter", "bubble", "connected_scatter", "strip", "swarm", "beeswarm", "lollipop", "dumbbell", "regression", "lm_plot"].includes(chartType) && (
          <g>
            {["regression", "lm_plot"].includes(chartType) && trendPath && (
              <polygon points={polygonPath || undefined} fill={colors.ci} fillOpacity="0.14" stroke="none" />
            )}
            
            {chartType === "connected_scatter" && (
              <path d={historyPath} stroke={colors.history} strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
            )}

            {history_values.map((val, idx) => {
              const baseCx = getX(idx);
              const jitter = ["strip", "swarm", "beeswarm"].includes(chartType) ? Math.sin(idx * 4) * 8 : 0;
              const cx5 = baseCx + jitter;
              const cy5 = getY(val);
              const rad = chartType === "bubble" ? 4 + 10 * (val / maxVal) : 5;
              const showLabel = ["lollipop", "dumbbell", "bubble"].includes(chartType) || idx % 4 === 0;
              
              return (
                <g key={`hist-scat-${idx}`}>
                  {chartType === "lollipop" && (
                    <line x1={cx5} y1={height - bottomMargin} x2={cx5} y2={cy5} stroke={colors.history} strokeWidth="1" />
                  )}
                  {chartType === "dumbbell" && forecast_values[idx] && (
                    <line x1={cx5} y1={cy5} x2={getX(history_values.length + idx)} y2={getY(forecast_values[idx])} stroke={theme.text} strokeWidth="1.2" />
                  )}
                  
                  <circle 
                    cx={cx5} 
                    cy={cy5} 
                    r={rad} 
                    fill={colors.history} 
                    stroke={isCyber || isDark ? "#ffffff" : "#1e293b"} 
                    strokeWidth="1.2"
                    filter={isCyber ? "url(#cyber-glow)" : undefined} 
                    className="cursor-pointer transition-all duration-150 hover:r-[7px] hover:stroke-black"
                    onMouseEnter={() => setHoveredPoint({ x: cx5, y: cy5, date: config.history_dates[idx] || "", value: val, type: "Historical" })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <title>Date: {config.history_dates[idx]}&#10;Value: {val.toLocaleString()}</title>
                  </circle>
                  {showLabel && (
                    <text x={cx5} y={cy5 - rad - 5} fontSize="8" fill={theme.text} textAnchor="middle" className="font-mono">
                      {val.toLocaleString([], { maximumFractionDigits: 1 })}
                    </text>
                  )}
                </g>
              );
            })}

            {forecast_values.map((val, idx) => {
              const cx5 = getX(history_values.length + idx);
              const cy5 = getY(val);
              const rad = chartType === "bubble" ? 4 + 10 * (val / maxVal) : 5;
              const showLabel = ["lollipop", "dumbbell", "bubble"].includes(chartType) || idx % 4 === 0;
              
              return (
                <g key={`fore-scat-${idx}`}>
                  {chartType === "lollipop" && (
                    <line x1={cx5} y1={height - bottomMargin} x2={cx5} y2={cy5} stroke={colors.forecast} strokeWidth="1" strokeDasharray="2 2" />
                  )}
                  <circle 
                    cx={cx5} 
                    cy={cy5} 
                    r={rad} 
                    fill={colors.forecast} 
                    stroke={isCyber || isDark ? "#ffffff" : "#1e293b"} 
                    strokeWidth="1.2"
                    filter={isCyber ? "url(#cyber-glow)" : undefined} 
                    className="cursor-pointer transition-all duration-150 hover:r-[7px] hover:stroke-black"
                    onMouseEnter={() => setHoveredPoint({ x: cx5, y: cy5, date: config.forecast_dates[idx] || "", value: val, type: "Forecast Projection" })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <title>Date: {config.forecast_dates[idx]}&#10;Value: {val.toLocaleString()}</title>
                  </circle>
                  {showLabel && (
                    <text x={cx5} y={cy5 - rad - 5} fontSize="8" fill={colors.forecast} textAnchor="middle" className="font-mono">
                      {val.toLocaleString([], { maximumFractionDigits: 1 })}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {["point_plot", "error_bar", "ci_plot"].includes(chartType) && (
          <g>
            {chartType === "point_plot" && (
              <>
                <path d={historyPath} stroke={colors.history} strokeWidth="2" fill="none" />
                <path d={forecastPath} stroke={colors.forecast} strokeWidth="2" strokeDasharray="3 3" fill="none" />
              </>
            )}
            
            {forecast_values.map((val, idx) => {
              const x = getX(history_values.length + idx);
              const yLow = getY(lower_bounds[idx]);
              const yHigh = getY(upper_bounds[idx]);
              return (
                <g key={`err-tick-${idx}`}>
                  <line x1={x} y1={yLow} x2={x} y2={yHigh} stroke={colors.ci} strokeWidth="2" />
                  <line x1={x - 5} y1={yHigh} x2={x + 5} y2={yHigh} stroke={colors.ci} strokeWidth="2" />
                  <line x1={x - 5} y1={yLow} x2={x + 5} y2={yLow} stroke={colors.ci} strokeWidth="2" />
                  {idx % 3 === 0 && upper_bounds[idx] !== undefined && (
                    <>
                      <text x={x + 8} y={yHigh - 3} fontSize="7.5" fill={colors.ci} textAnchor="start" className="font-mono">
                        ↑{upper_bounds[idx]?.toLocaleString([], { maximumFractionDigits: 1 })}
                      </text>
                      <text x={x + 8} y={yLow + 11} fontSize="7.5" fill={colors.ci} textAnchor="start" className="font-mono">
                        ↓{lower_bounds[idx]?.toLocaleString([], { maximumFractionDigits: 1 })}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {history_values.map((val, idx) => (
              <g key={`pt-hist-${idx}`}>
                <circle cx={getX(idx)} cy={getY(val)} r="5" fill={colors.history} stroke="#ffffff" strokeWidth="1.5" />
                {idx % 3 === 0 && (
                  <text x={getX(idx)} y={getY(val) - 9} fontSize="8" fill={theme.text} textAnchor="middle" className="font-mono">
                    {val.toLocaleString([], { maximumFractionDigits: 1 })}
                  </text>
                )}
              </g>
            ))}
            {forecast_values.map((val, idx) => (
              <g key={`pt-fore-${idx}`}>
                <circle cx={getX(history_values.length + idx)} cy={getY(val)} r="5" fill={colors.forecast} stroke="#ffffff" strokeWidth="1.5" />
                {idx % 3 === 0 && (
                  <text x={getX(history_values.length + idx)} y={getY(val) - 9} fontSize="8" fill={colors.forecast} textAnchor="middle" className="font-mono">
                    {val.toLocaleString([], { maximumFractionDigits: 1 })}
                  </text>
                )}
              </g>
            ))}
          </g>
        )}

        {["residual", "leverage", "influence", "bland_altman"].includes(chartType) && (
          <g>
            {chartType === "residual" ? (
              <line x1={leftMargin} y1={cy} x2={width - rightMargin} y2={cy} stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
            ) : chartType === "bland_altman" ? (
              <>
                <line x1={leftMargin} y1={cy} x2={width - rightMargin} y2={cy} stroke={colors.trend} strokeWidth="1.5" />
                <line x1={leftMargin} y1={cy - 60} x2={width - rightMargin} y2={cy - 60} stroke={colors.ci} strokeWidth="1.2" strokeDasharray="3 3" />
                <line x1={leftMargin} y1={cy + 60} x2={width - rightMargin} y2={cy + 60} stroke={colors.ci} strokeWidth="1.2" strokeDasharray="3 3" />
                <text x={width - rightMargin - 5} y={cy - 65} fontSize="8" fill={colors.ci} textAnchor="end">Upper Limit (+1.96 SD)</text>
                <text x={width - rightMargin - 5} y={cy + 55} fontSize="8" fill={colors.ci} textAnchor="end">Lower Limit (-1.96 SD)</text>
              </>
            ) : (
              <path d={`M ${leftMargin} ${topMargin + 40} Q ${cx} ${cy + 60} ${width - rightMargin} ${topMargin + 40}`} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
            )}

            {history_values.map((val, idx) => {
              const x = getX(idx);
              const y = chartType === "residual" 
                ? cy + (Math.sin(idx) * valRange * 0.15) 
                : (chartType === "bland_altman" ? cy + (Math.cos(idx) * 40) : topMargin + 80 + (idx * 15) % 180);
              return (
                <circle key={`resid-${idx}`} cx={x} cy={y} r="5.5" fill={colors.history} stroke="#ffffff" strokeWidth="1" />
              );
            })}
          </g>
        )}

        {showTrendLine && trendPath && !["residual", "leverage", "influence", "bland_altman"].includes(chartType) && (
          <path 
            d={trendPath} 
            stroke={colors.trend} 
            strokeWidth="2" 
            strokeDasharray="6 4" 
            fill="none" 
          />
        )}

        {showMovingAverage && maPath && !["residual", "leverage", "influence", "bland_altman"].includes(chartType) && (
          <path 
            d={maPath} 
            stroke={colors.ma} 
            strokeWidth="2.2" 
            fill="none" 
          />
        )}

        {showCI && (chartType === "bar" || chartType === "scatter") && (
          <g>
            {forecast_values.map((val, idx) => {
              const x = getX(history_values.length + idx);
              const yLow = getY(lower_bounds[idx]);
              const yHigh = getY(upper_bounds[idx]);
              return (
                <g key={`err-bar-${idx}`}>
                  <line x1={x} y1={yLow} x2={x} y2={yHigh} stroke={colors.ci} strokeWidth="1.5" />
                  <line x1={x - 4} y1={yHigh} x2={x + 4} y2={yHigh} stroke={colors.ci} strokeWidth="1.5" />
                  <line x1={x - 4} y1={yLow} x2={x + 4} y2={yLow} stroke={colors.ci} strokeWidth="1.5" />
                </g>
              );
            })}
          </g>
        )}

        {showMarkers && ["line", "step", "multi_line"].includes(chartType) && (
          <g>
            {history_values.map((val, idx) => {
              const cx5 = getX(idx);
              const cy5 = getY(val);
              return (
                <circle 
                  key={`hist-marker-${idx}`} 
                  cx={cx5} 
                  cy={cy5} 
                  r="3.5" 
                  fill={colors.history} 
                  stroke="#ffffff" 
                  strokeWidth="1"
                  className="cursor-pointer transition-all duration-150 hover:r-[6px] hover:stroke-black"
                  onMouseEnter={() => setHoveredPoint({ x: cx5, y: cy5, date: config.history_dates[idx] || "", value: val, type: "Historical" })}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <title>Date: {config.history_dates[idx]}&#10;Value: {val.toLocaleString()}&#10;Type: Historical</title>
                </circle>
              );
            })}
            {forecast_values.map((val, idx) => {
              const cx5 = getX(history_values.length + idx);
              const cy5 = getY(val);
              return (
                <circle 
                  key={`forecast-marker-${idx}`} 
                  cx={cx5} 
                  cy={cy5} 
                  r="3.5" 
                  fill={colors.forecast} 
                  stroke="#ffffff" 
                  strokeWidth="1"
                  className="cursor-pointer transition-all duration-150 hover:r-[6px] hover:stroke-black"
                  onMouseEnter={() => setHoveredPoint({ x: cx5, y: cy5, date: config.forecast_dates[idx] || "", value: val, type: "Forecast Projection" })}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <title>Date: {config.forecast_dates[idx]}&#10;Value: {val.toLocaleString()}&#10;Type: Forecast</title>
                </circle>
              );
            })}
          </g>
        )}

        {theme.border !== "transparent" && (
          <rect x={leftMargin} y={topMargin} width={chartWidth} height={chartHeight} fill="none" stroke={theme.border} strokeWidth="1.2" />
        )}

        <text 
          x={width / 2} 
          y={height - 15} 
          className={isClassic ? "" : "font-sans font-medium"} 
          fontSize="10" 
          textAnchor="middle" 
          fill={theme.text} 
          stroke="none"
        >
          Timeline Periods
        </text>
        <text 
          x="18" 
          y={(height - bottomMargin + topMargin) / 2} 
          className={isClassic ? "" : "font-sans font-medium"} 
          fontSize="10" 
          textAnchor="middle" 
          fill={theme.text} 
          stroke="none" 
          transform={`rotate(-90 18 ${(height - bottomMargin + topMargin) / 2})`}
        >
          Value Magnitude
        </text>

        <g transform={`translate(${width - rightMargin - 175}, ${topMargin + 12})`}>
          <rect 
            x="0" 
            y="0" 
            width="165" 
            height={showTrendLine || showMovingAverage ? "105" : "75"} 
            fill={theme.bg === "#ffffff" || theme.bg === "transparent" ? "#ffffff" : theme.bg} 
            fillOpacity="0.95" 
            stroke={theme.border === "transparent" ? "#cccccc" : theme.border} 
            strokeWidth="1.2" 
            rx={isClassic ? "0" : "4"} 
          />
          
          {chartType === "bar" ? (
            <rect x="10" y="10" width="18" height="10" fill={colors.history} fillOpacity="0.85" stroke="none" />
          ) : (
            <line x1="10" y1="15" x2="28" y2="15" stroke={colors.history} strokeWidth="2.5" />
          )}
          {chartType === "scatter" && (
            <circle cx="19" cy="15" r="3" fill={colors.history} stroke="none" />
          )}
          <text x="36" y="18" className={isClassic ? "" : "font-sans"} fontSize="9.5" fill={isCyber ? "#ffffff" : theme.text} stroke="none">
            Historical Data
          </text>

          {chartType === "bar" ? (
            <rect x="10" y="30" width="18" height="10" fill={colors.forecast} fillOpacity="0.4" stroke={colors.forecast} strokeDasharray="2 1" strokeWidth="0.5" />
          ) : (
            <line x1="10" y1="35" x2="28" y2="35" stroke={colors.forecast} strokeWidth="2.5" strokeDasharray="3 2" />
          )}
          {chartType !== "bar" && (
            <circle cx="19" cy="35" r="3" fill={colors.forecast} stroke="none" />
          )}
          <text x="36" y="38" className={isClassic ? "" : "font-sans"} fontSize="9.5" fill={isCyber ? "#ffffff" : theme.text} stroke="none">
            Forecast Projections
          </text>

          {showCI && (
            <>
              {chartType === "bar" || chartType === "scatter" ? (
                <line x1="10" y1="52" x2="28" y2="52" stroke={colors.ci} strokeWidth="1.5" />
              ) : (
                <rect x="10" y="47" width="18" height="10" fill={colors.ci} fillOpacity="0.22" stroke="none" />
              )}
              {showCI && (chartType === "bar" || chartType === "scatter") && (
                <>
                  <line x1="14" y1="52" x2="24" y2="52" stroke={colors.ci} strokeWidth="1.5" />
                  <line x1="14" y1="49" x2="14" y2="55" stroke={colors.ci} strokeWidth="1.5" />
                  <line x1="24" y1="49" x2="24" y2="55" stroke={colors.ci} strokeWidth="1.5" />
                </>
              )}
              <text x="36" y="55" className={isClassic ? "" : "font-sans"} fontSize="9.5" fill={isCyber ? "#ffffff" : theme.text} stroke="none">
                {chartType === "bar" || chartType === "scatter" ? "95% Error Bounds" : "95% Conf. Interval"}
              </text>
            </>
          )}

          {showTrendLine && (
            <g transform={`translate(0, ${showCI ? 20 : 0})`}>
              <line x1="10" y1="55" x2="28" y2="55" stroke={colors.trend} strokeWidth="2" strokeDasharray="4 3" />
              <text x="36" y="58" className={isClassic ? "" : "font-sans"} fontSize="9.5" fill={isCyber ? "#ffffff" : theme.text} stroke="none">
                Regression Trend
              </text>
            </g>
          )}

          {showMovingAverage && (
            <g transform={`translate(0, ${showCI && showTrendLine ? 38 : (showCI || showTrendLine ? 18 : 0)})`}>
              <line x1="10" y1="55" x2="28" y2="55" stroke={colors.ma} strokeWidth="2" />
              <text x="36" y="58" className={isClassic ? "" : "font-sans"} fontSize="9.5" fill={isCyber ? "#ffffff" : theme.text} stroke="none">
                Moving Average ({movingAveragePeriod}p)
              </text>
            </g>
          )}
        </g>
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-lg bg-canvas text-ink">
      
      {/* 1. Quietly Editorial Main Header Section */}
      <div className="border-b border-hairline pb-xl flex flex-col md:flex-row md:justify-between md:items-end gap-md">
        <div>
          <span className="text-caption text-brand-accent uppercase font-bold tracking-widest block mb-1">
            Unified Analytics Workspace
          </span>
          <h1 className="text-display-lg md:text-display-xl text-ink font-cal m-0 leading-tight">
            Data Analyst Workstation
          </h1>
          <p className="text-body-md text-muted max-w-3xl mt-sm leading-relaxed m-0">
            Scrub spreadsheet datasets, query RAG vector knowledge bases, simulate projections, and download executive briefs in one synchronized, local interface.
          </p>
        </div>
        <button
          type="button"
          onClick={handleUltimateReset}
          className="btn-secondary text-[#aa2d00] hover:text-white hover:bg-error hover:border-error py-2.5 px-4 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 self-start md:self-end cursor-pointer border border-[#f5d0c0] bg-[#fff9f6] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2.5">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Ultimate Reset
        </button>
      </div>

      {statusMsg && (
        <div className={`p-md border text-caption rounded-md ${
          statusMsg.includes("ERROR") 
            ? "bg-red-50 border-error text-error" 
            : "bg-green-50 border-success text-success"
        }`}>
          <span className="font-bold uppercase tracking-wider block mb-1">
            {statusMsg.includes("ERROR") ? "System Error" : "System Log"}
          </span>
          <p className="m-0 leading-relaxed font-semibold">{statusMsg}</p>
        </div>
      )}

      {/* 2. Grid Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        
        {/* Left Sidebar: Document Library Console (4/12 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-md">
          
          {/* File uploader (Warm pastel mustard theme) */}
          <div className="border border-hairline p-card-lg bg-[#fcf8f2] rounded-md shadow-subtle flex flex-col gap-md">
            <span className="text-caption text-ink font-bold border-b border-hairline pb-1.5 block uppercase tracking-wider">
              Dataset Ingestion
            </span>

            {isUploading ? (
              <div className="p-md bg-canvas border border-hairline rounded-md flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Indexing Status</span>
                  <span className="text-xs font-bold text-ink">{Math.round(((ingestionStep + 1) / ingestionProgressLog.length) * 100)}%</span>
                </div>
                {/* Visual loading bar */}
                <div className="w-full bg-[#f1f3f5] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-ink h-full transition-all duration-500"
                    style={{ width: `${((ingestionStep + 1) / ingestionProgressLog.length) * 100}%` }}
                  ></div>
                </div>
                <div className="p-2 bg-[#f8fafc] border border-hairline rounded-md">
                  <span className="text-[10px] text-muted uppercase tracking-wider block font-bold">Active Backend Agent Phase</span>
                  <p className="text-caption text-ink font-mono m-0 leading-relaxed mt-0.5 animate-pulse">
                    &bull; {ingestionProgressLog[ingestionStep]}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpload} className="flex flex-col gap-sm">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`w-full min-h-[140px] border-2 border-dashed flex flex-col justify-center items-center p-md text-center transition-colors select-none cursor-pointer rounded-md ${
                    dragActive ? "border-ink bg-[#f5ebd4]" : "border-hairline bg-canvas hover:border-ink"
                  }`}
                  onClick={() => document.getElementById("file-upload-input")?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                      }
                    }}
                    accept=".txt,.pdf,.docx,.doc,.csv,.xlsx,.xls"
                    className="hidden"
                  />
                  <svg viewBox="0 0 24 24" className="w-8 h-8 stroke-ink fill-none mb-2" strokeWidth="1.5">
                    <path d="M12 15V3m0 0L8 7m4-4l4 4M2 17v2a2 2 0 002 2h16a2 2 0 002-2v-2" />
                  </svg>
                  {file ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink font-bold truncate max-w-[220px]">{file.name}</span>
                      <span className="text-caption text-muted">{formatSize(file.size)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-caption text-ink font-bold">Drag spreadsheet / PDF here</span>
                      <span className="text-[11px] text-muted">Supports CSV, Excel, Word, Text, PDF</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!file}
                  className="btn-primary w-full"
                >
                  Parse &amp; Ingest
                </button>
              </form>
            )}
          </div>

          {/* Active Library List (Cream background list card) */}
          <div className="border border-hairline p-card-lg bg-canvas rounded-md shadow-subtle flex flex-col gap-md">
            <span className="text-caption text-ink font-bold border-b border-hairline pb-1.5 block uppercase tracking-wider">
              Datasets Ingested ({documents.length})
            </span>

            {documents.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-hairline rounded-md bg-[#fdfdfd]">
                <span className="text-caption text-muted font-bold uppercase tracking-wider block mb-1">
                  Storage Empty
                </span>
                <p className="text-[12px] text-muted m-0">
                  Ingest files to index context nodes.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                {documents.map((doc: DocumentMeta) => {
                  const isSelected = selectedDoc?.id === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoc(doc)}
                      className={`p-3 border text-left cursor-pointer rounded-md transition-colors flex justify-between items-center gap-2 ${
                        isSelected 
                          ? "bg-[#f5e9d4] border-ink" 
                          : "bg-canvas border-hairline hover:bg-surface-soft"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 truncate">
                        <strong className="text-caption text-ink font-semibold truncate block">
                          {doc.filename}
                        </strong>
                        <span className="text-[11px] text-muted uppercase font-semibold">
                          {doc.file_type} &bull; {formatSize(doc.size_bytes)}
                        </span>
                      </div>
                      <button
                        onClick={(e: React.MouseEvent) => handleDeleteDoc(doc.id, e)}
                        className="p-1.5 text-muted hover:text-error hover:bg-red-50 border border-transparent hover:border-error/20 rounded-md transition-colors"
                        title="Delete document"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Pane: Unified Workstation Dashboard (8/12 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-md">
          
          {/* Tab Switcher Headers (Airtable Tabbed feature look) */}
          <div className="border border-hairline bg-surface-soft p-1 rounded-lg flex items-center gap-1">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-grow py-2.5 text-caption font-semibold rounded-md transition-all text-center ${
                activeTab === "profile" 
                  ? "bg-canvas text-ink shadow-sm border border-hairline-soft" 
                  : "text-muted hover:text-ink"
              }`}
            >
              [1] Dataset Profile
            </button>
            <button
              onClick={() => setActiveTab("forecast")}
              className={`flex-grow py-2.5 text-caption font-semibold rounded-md transition-all text-center ${
                activeTab === "forecast" 
                  ? "bg-canvas text-ink shadow-sm border border-hairline-soft" 
                  : "text-muted hover:text-ink"
              }`}
            >
              [2] Forecasting simulation
            </button>
            <button
              onClick={() => {
                setActiveTab("chat");
                if (conversations.length > 0 && !activeConvId) {
                  handleSelectConversation(conversations[0].id);
                }
              }}
              className={`flex-grow py-2.5 text-caption font-semibold rounded-md transition-all text-center ${
                activeTab === "chat" 
                  ? "bg-canvas text-ink shadow-sm border border-hairline-soft" 
                  : "text-muted hover:text-ink"
              }`}
            >
              [3] Interactive Chat
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex-grow py-2.5 text-caption font-semibold rounded-md transition-all text-center ${
                activeTab === "reports" 
                  ? "bg-canvas text-ink shadow-sm border border-hairline-soft" 
                  : "text-muted hover:text-ink"
              }`}
            >
              [4] Compiled Briefs
            </button>
          </div>

          {/* Active Workstation tab panels */}
          <div className="border border-hairline bg-canvas rounded-lg shadow-card p-card-xl min-h-[500px]">
            
            {selectedDoc ? (
              <>
                
                {/* 1. DATASET PROFILE TAB */}
                {activeTab === "profile" && (
                  <div className="flex flex-col gap-lg">
                    
                    {/* Eyebrow Ingestion Stats */}
                    <div className="border-b border-hairline pb-md flex justify-between items-center">
                      <div>
                        <h2 className="text-title-lg text-ink font-cal m-0">{selectedDoc.filename}</h2>
                        <span className="text-caption text-muted font-mono block mt-0.5">
                          Size: {formatSize(selectedDoc.size_bytes)} &bull; Chunks Indexed: {selectedDoc.metadata?.chunks_count ?? "-"}
                        </span>
                      </div>
                      <span className="px-3 py-1 bg-badge-violet/10 border border-badge-violet/20 text-badge-violet font-semibold rounded-md text-caption uppercase tracking-wider">
                        {selectedDoc.file_type} File
                      </span>
                    </div>

                    {/* Tabular Dataset view */}
                    {selectedDoc.metadata?.is_tabular ? (
                      <div className="flex flex-col gap-lg">
                        
                        {/* Tabular metadata badges */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
                          <div className="bg-[#fcfbf9] border border-hairline p-md rounded-md">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Rows count</span>
                            <strong className="text-ink text-title-sm font-semibold block mt-0.5">{selectedDoc.metadata.row_count}</strong>
                          </div>
                          <div className="bg-[#fcfbf9] border border-hairline p-md rounded-md">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Columns count</span>
                            <strong className="text-ink text-title-sm font-semibold block mt-0.5">{selectedDoc.metadata.col_count}</strong>
                          </div>
                          <div className="bg-[#fcfbf9] border border-hairline p-md rounded-md">
                            <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Duplicate Rows</span>
                            <strong className="text-ink text-title-sm font-semibold block mt-0.5">{selectedDoc.metadata.duplicate_count}</strong>
                          </div>
                          <div className="bg-[#fcfbf9] border border-hairline p-md rounded-md">
                            <span className="text-[10px] text-muted uppercase tracking-wider text-muted font-bold block">Status</span>
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-green-50 border border-success/30 rounded-md text-[10px] text-success font-bold">
                              Index Ready
                            </span>
                          </div>
                        </div>

                        {/* Warnings and outlier notifications */}
                        {selectedDoc.metadata.anomalies && selectedDoc.metadata.anomalies.length > 0 && (
                          <div className="border border-error bg-red-50 text-error p-card-lg rounded-md text-caption">
                            <span className="font-bold uppercase tracking-wider block mb-1">
                              Outliers &amp; Ingestion Warnings Detected
                            </span>
                            <ul className="list-disc pl-4 m-0 flex flex-col gap-1 font-semibold">
                              {selectedDoc.metadata.anomalies.map((anom: string, idx: number) => (
                                <li key={idx}>{anom}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Summary statistics */}
                        {selectedDoc.metadata.summary_stats && Object.keys(selectedDoc.metadata.summary_stats).length > 0 && (
                          <div className="flex flex-col gap-2">
                            <span className="text-caption text-ink font-bold uppercase tracking-wider block">
                              Summary Statistics (Numeric Fields)
                            </span>
                            <div className="overflow-x-auto border border-hairline rounded-md">
                              <table className="w-full text-left text-caption border-collapse">
                                <thead>
                                  <tr className="border-b border-hairline bg-surface-soft text-muted uppercase text-[10px] tracking-wider font-bold">
                                    <th className="py-2.5 px-3">Column</th>
                                    <th className="py-2.5 px-3 text-right">Mean</th>
                                    <th className="py-2.5 px-3 text-right">Median</th>
                                    <th className="py-2.5 px-3 text-right">Min</th>
                                    <th className="py-2.5 px-3 text-right">Max</th>
                                    <th className="py-2.5 px-3 text-right">Std Dev</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(selectedDoc.metadata.summary_stats).map(([col, stats]: any) => (
                                    <tr key={col} className="border-b border-hairline-soft font-mono hover:bg-surface-soft">
                                      <td className="py-2 px-3 font-semibold text-ink font-sans">{col}</td>
                                      <td className="py-2 px-3 text-right text-ink">{stats.mean?.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right text-ink">{stats.median?.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right text-ink">{stats.min?.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right text-ink">{stats.max?.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right text-ink">{stats.std?.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Column Schema mappings */}
                        <div className="flex flex-col gap-2">
                          <span className="text-caption text-ink font-bold uppercase tracking-wider block">
                            Column Schema &amp; Types mapping
                          </span>
                          <div className="flex flex-wrap gap-xs">
                            {Object.entries(selectedDoc.metadata.column_types || {}).map(([col, colType]: any) => (
                              <div key={col} className="p-sm bg-surface-soft border border-hairline rounded-md flex items-center gap-md">
                                <span className="text-caption font-semibold text-ink">{col}</span>
                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm tracking-wider ${
                                  colType === "numeric" ? "bg-badge-pink/15 text-badge-pink" :
                                  colType === "datetime" ? "bg-badge-violet/15 text-badge-violet" :
                                  colType === "boolean" ? "bg-badge-emerald/15 text-badge-emerald" :
                                  "bg-[#fcab79]/15 text-[#aa2d00]"
                                }`}>
                                  {colType}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* First 5 rows preview */}
                        {selectedDoc.metadata.preview && selectedDoc.metadata.preview.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <span className="text-caption text-ink font-bold uppercase tracking-wider block">
                              First 5 Rows Preview
                            </span>
                            <div className="overflow-x-auto border border-hairline rounded-md max-h-[280px]">
                              <table className="w-full text-left text-[11px] font-mono border-collapse whitespace-nowrap">
                                <thead>
                                  <tr className="border-b border-hairline bg-surface-soft text-muted uppercase text-[9px] tracking-wider font-bold">
                                    {Object.keys(selectedDoc.metadata.preview[0]).map((col) => (
                                      <th key={col} className="py-2.5 px-3">{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedDoc.metadata.preview.map((row: any, rIdx: number) => (
                                    <tr key={rIdx} className="border-b border-hairline-soft hover:bg-surface-soft">
                                      {Object.values(row).map((val: any, vIdx: number) => (
                                        <td key={vIdx} className="py-2 px-3 text-ink">
                                          {String(val)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      </div>
                    ) : (
                      /* Unstructured Document View */
                      <div className="flex flex-col gap-lg">
                        
                        {/* Summary Block (Airtable Signature peach card) */}
                        <div className="bg-[#fff9f6] border border-[#f5d0c0] rounded-md p-card-lg">
                          <span className="text-[10px] text-[#aa2d00] font-bold uppercase tracking-wider block mb-1">
                            Document Overview Summary
                          </span>
                          <p className="text-caption text-ink leading-relaxed m-0">
                            {selectedDoc.metadata?.summary || "No automated summary extracted."}
                          </p>
                        </div>

                        {/* Key topics list */}
                        <div className="flex flex-col gap-2">
                          <span className="text-caption text-ink font-bold uppercase tracking-wider block">
                            Extracted Topics &amp; Context Keys
                          </span>
                          <div className="flex flex-wrap gap-xs">
                            {(selectedDoc.metadata?.key_topics || ["General Ingestion"]).map((topic: string, idx: number) => (
                              <span key={idx} className="text-caption font-semibold bg-surface-soft border border-hairline px-3 py-1 rounded-pill">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}

                    {/* Interactive Suggested Questions (Airtable pastel cream card) */}
                    {selectedDoc.metadata?.suggested_questions && selectedDoc.metadata.suggested_questions.length > 0 && (
                      <div className="border border-hairline bg-[#fbf9f5] p-card-lg rounded-md flex flex-col gap-3">
                        <span className="text-caption text-ink font-bold uppercase tracking-wider block">
                          Suggested Analysis Questions
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                          {selectedDoc.metadata.suggested_questions.map((q: string, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => handleSuggestedQuestionClick(q)}
                              className="p-3 bg-canvas border border-hairline hover:border-ink rounded-md transition-all text-left text-caption text-ink font-medium leading-normal flex items-start justify-between group cursor-pointer"
                            >
                              <span>&rarr; {q}</span>
                              <span className="text-[10px] text-[#aa2d00] font-bold uppercase tracking-wider shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                Ask &raquo;
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* 2. FORECASTING & SIMULATION TAB */}
                {activeTab === "forecast" && (
                  <div className="flex flex-col gap-lg">
                    
                    <div className="border-b border-hairline pb-md">
                      <h2 className="text-title-lg text-ink font-cal m-0">Time-Series Simulations &amp; Predictions</h2>
                      <span className="text-caption text-muted">
                        Execute Prophet / ARIMA regression models on selected tabular dimensions.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-lg items-start">
                      
                      {/* Configuration panel (4 Cols) */}
                      <div className="md:col-span-4 flex flex-col gap-md">
                        {/* Model Settings Card */}
                        <div className="border border-hairline p-card-lg bg-surface-soft rounded-md flex flex-col gap-md">
                          <span className="text-caption text-ink font-bold uppercase tracking-wider block border-b border-hairline pb-1.5">
                            Model Settings
                          </span>

                          {isAnalyzing ? (
                            <div className="flex flex-col gap-3 p-2 bg-canvas border border-hairline rounded-md">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Processing...</span>
                                <span className="text-xs font-bold text-ink">{Math.round(((analysisStep + 1) / analysisProgressLog.length) * 100)}%</span>
                              </div>
                              <div className="w-full bg-[#f1f3f5] h-1 rounded-full overflow-hidden">
                                <div 
                                  className="bg-ink h-full transition-all duration-300"
                                  style={{ width: `${((analysisStep + 1) / analysisProgressLog.length) * 100}%` }}
                                ></div>
                              </div>
                              <p className="text-[11px] font-mono text-ink m-0 leading-relaxed animate-pulse">
                                &bull; {analysisProgressLog[analysisStep]}
                              </p>
                              <button
                                type="button"
                                onClick={() => setIsAnalyzing(false)}
                                className="btn-secondary py-1 text-xs font-semibold mt-2 w-full flex items-center justify-center gap-1"
                              >
                                &larr; Back &amp; Edit Settings
                              </button>
                            </div>
                          ) : (
                            <form onSubmit={handleRunForecast} className="flex flex-col gap-md">
                              
                              {/* Date Column select */}
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] text-ink font-bold uppercase tracking-wide">
                                  Time/Date Dimension
                                </label>
                                <select
                                  value={dateColumn}
                                  onChange={(e) => setDateColumn(e.target.value)}
                                  className="bg-canvas text-ink border border-hairline px-3 py-2 text-caption rounded-md focus:border-ink outline-none"
                                  required
                                >
                                  <option value="">-- Choose Column --</option>
                                  {selectedDoc.metadata?.columns?.filter((c: string) => {
                                    const colType = selectedDoc.metadata?.column_types?.[c] || "";
                                    const nameLower = c.toLowerCase();
                                    return colType === "datetime" || 
                                           nameLower.includes("date") || 
                                           nameLower.includes("time") || 
                                           nameLower.includes("year") || 
                                           nameLower.includes("month") || 
                                           nameLower.includes("day") || 
                                           nameLower.includes("timestamp") || 
                                           nameLower.includes("dt");
                                  }).map((c: string) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Target value select */}
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] text-ink font-bold uppercase tracking-wide">
                                  Target Value (Numeric)
                                </label>
                                <select
                                  value={targetColumn}
                                  onChange={(e) => setTargetColumn(e.target.value)}
                                  className="bg-canvas text-ink border border-hairline px-3 py-2 text-caption rounded-md focus:border-ink outline-none"
                                  required
                                >
                                  <option value="">-- Choose Column --</option>
                                  {selectedDoc.metadata?.columns?.filter((c: string) => {
                                    const colType = selectedDoc.metadata?.column_types?.[c] || "";
                                    return colType === "numeric";
                                  }).map((c: string) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Steps input */}
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] text-ink font-bold uppercase tracking-wide">
                                  Forecast steps
                                </label>
                                <input
                                  type="number"
                                  value={forecastSteps}
                                  onChange={(e) => setForecastSteps(parseInt(e.target.value) || 12)}
                                  min="1"
                                  max="48"
                                  className="bg-canvas text-ink border border-hairline px-3 py-1.5 text-caption rounded-md focus:border-ink outline-none"
                                  required
                                />
                              </div>

                              {/* Scrub checkbox */}
                              <div className="flex items-center gap-xs">
                                <input
                                  id="clean-check"
                                  type="checkbox"
                                  checked={cleanOutliers}
                                  onChange={(e) => setCleanOutliers(e.target.checked)}
                                  className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                                />
                                <label htmlFor="clean-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                  Filter Outliers (IQR)
                                </label>
                              </div>

                              <button
                                type="submit"
                                className="btn-primary w-full"
                              >
                                Run Forecast
                              </button>

                            </form>
                          )}
                        </div>

                        {/* Matplotlib & Seaborn Style Customizer Card */}
                        <div className="border border-hairline p-card-lg bg-surface-soft rounded-md flex flex-col gap-md">
                          <span className="text-caption text-ink font-bold uppercase tracking-wider block border-b border-hairline pb-1.5">
                            Plot Visual Customizer
                          </span>
                          
                          {/* Style Theme Select */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] text-ink font-bold uppercase tracking-wide">
                              Visualization Theme
                            </label>
                            <select
                              value={chartTheme}
                              onChange={(e) => setChartTheme(e.target.value as any)}
                              className="bg-canvas text-ink border border-hairline px-3 py-1.5 text-caption rounded-md focus:border-ink outline-none"
                            >
                              <option value="darkgrid">Seaborn Darkgrid</option>
                              <option value="whitegrid">Seaborn Whitegrid</option>
                              <option value="dark">Classic Dark Plot</option>
                              <option value="white">Seaborn White</option>
                              <option value="classic">Matplotlib Classic</option>
                              <option value="cyberpunk">Cyberpunk Neon</option>
                              <option value="minimalist">Minimalist Light</option>
                            </select>
                          </div>

                          {/* Color Palette Select */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] text-ink font-bold uppercase tracking-wide">
                              Color Palette
                            </label>
                            <select
                              value={chartPalette}
                              onChange={(e) => setChartPalette(e.target.value as any)}
                              className="bg-canvas text-ink border border-hairline px-3 py-1.5 text-caption rounded-md focus:border-ink outline-none"
                            >
                              <option value="deep">Deep Palette</option>
                              <option value="muted">Muted Palette</option>
                              <option value="bright">Bright Palette</option>
                              <option value="colorblind">Colorblind Friendly</option>
                              <option value="viridis">Viridis Palette</option>
                              <option value="warm">Warm Flame</option>
                            </select>
                          </div>

                          {/* Chart Type Select */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] text-ink font-bold uppercase tracking-wide">
                              Chart Type / Layout
                            </label>
                            <select
                              value={chartType}
                              onChange={(e) => setChartType(e.target.value)}
                              className="bg-canvas text-ink border border-hairline px-3 py-1.5 text-caption rounded-md focus:border-ink outline-none"
                            >
                              <optgroup label="Basic Charts">
                                <option value="line">Line Chart</option>
                                <option value="multi_line">Multi-Line Chart</option>
                                <option value="bar">Bar Chart</option>
                                <option value="horizontal_bar">Horizontal Bar Chart</option>
                                <option value="grouped_bar">Grouped Bar Chart</option>
                                <option value="stacked_bar">Stacked Bar Chart</option>
                                <option value="stacked_bar_100">100% Stacked Bar Chart</option>
                                <option value="pie">Pie Chart</option>
                                <option value="donut">Donut Chart</option>
                                <option value="area">Area Chart</option>
                                <option value="stacked_area">Stacked Area Chart</option>
                                <option value="step">Step Chart</option>
                              </optgroup>
                              <optgroup label="Distribution Charts">
                                <option value="histogram">Histogram</option>
                                <option value="kde">KDE (Kernel Density) Plot</option>
                                <option value="freq_polygon">Frequency Polygon</option>
                                <option value="density">Density Plot</option>
                                <option value="ecdf">ECDF Plot</option>
                                <option value="rug">Rug Plot</option>
                                <option value="qq_plot">QQ Plot</option>
                                <option value="prob_plot">Probability Plot</option>
                              </optgroup>
                              <optgroup label="Relationship Charts">
                                <option value="scatter">Scatter Plot</option>
                                <option value="bubble">Bubble Chart</option>
                                <option value="hexbin">Hexbin Plot</option>
                                <option value="pair">Pair Plot</option>
                                <option value="joint">Joint Plot</option>
                                <option value="regression">Regression Plot</option>
                                <option value="lm_plot">LM Plot</option>
                                <option value="connected_scatter">Connected Scatter Plot</option>
                              </optgroup>
                              <optgroup label="Categorical Charts">
                                <option value="count_plot">Count Plot</option>
                                <option value="box">Box Plot</option>
                                <option value="violin">Violin Plot</option>
                                <option value="boxen">Boxen Plot</option>
                                <option value="strip">Strip Plot</option>
                                <option value="swarm">Swarm Plot</option>
                                <option value="beeswarm">Beeswarm Plot</option>
                                <option value="point_plot">Point Plot</option>
                                <option value="cat_plot">Cat Plot</option>
                              </optgroup>
                              <optgroup label="Matrix &amp; Correlation">
                                <option value="heatmap">Heatmap</option>
                                <option value="corr_heatmap">Correlation Heatmap</option>
                                <option value="cluster_map">Cluster Map</option>
                                <option value="confusion_matrix">Confusion Matrix</option>
                                <option value="covariance_matrix">Covariance Matrix</option>
                              </optgroup>
                              <optgroup label="Statistical Charts">
                                <option value="error_bar">Error Bar Plot</option>
                                <option value="ci_plot">Confidence Interval Plot</option>
                                <option value="residual">Residual Plot</option>
                                <option value="leverage">Leverage Plot</option>
                                <option value="influence">Influence Plot</option>
                                <option value="bland_altman">Bland-Altman Plot</option>
                              </optgroup>
                              <optgroup label="Time Series &amp; Financial">
                                <option value="time_series_line">Time Series Line Chart</option>
                                <option value="rolling_mean">Rolling Mean Plot</option>
                                <option value="rolling_std">Rolling Std Plot</option>
                                <option value="seasonal">Seasonal Plot</option>
                                <option value="trend">Trend Plot</option>
                                <option value="lag">Lag Plot</option>
                                <option value="acf">Autocorrelation Plot (ACF)</option>
                                <option value="pacf">Partial Autocorrelation (PACF)</option>
                                <option value="candlestick">Candlestick Chart</option>
                                <option value="ohlc">OHLC Chart</option>
                                <option value="waterfall">Waterfall Chart</option>
                                <option value="volume">Volume Chart</option>
                                <option value="moving_average">Moving Average Chart</option>
                                <option value="bollinger">Bollinger Bands Chart</option>
                              </optgroup>
                              <optgroup label="Hierarchical Charts">
                                <option value="treemap">Tree Map</option>
                                <option value="sunburst">Sunburst Chart</option>
                                <option value="icicle">Icicle Chart</option>
                                <option value="dendrogram">Dendrogram</option>
                                <option value="circle_packing">Circle Packing Chart</option>
                              </optgroup>
                              <optgroup label="Flow &amp; Network">
                                <option value="sankey">Sankey Diagram</option>
                                <option value="alluvial">Alluvial Diagram</option>
                                <option value="chord">Chord Diagram</option>
                                <option value="flow_map">Flow Map</option>
                                <option value="network">Network Graph</option>
                                <option value="force_directed">Force Directed Graph</option>
                                <option value="node_link">Node-Link Diagram</option>
                              </optgroup>
                              <optgroup label="Geographical Charts">
                                <option value="choropleth">Choropleth Map</option>
                                <option value="bubble_map">Bubble Map</option>
                                <option value="density_map">Density Map</option>
                                <option value="geo_scatter">Geo Scatter Plot</option>
                                <option value="heat_map_on_map">Heat Map on Map</option>
                                <option value="cartogram">Cartogram</option>
                                <option value="hexagonal_map">Hexagonal Map</option>
                              </optgroup>
                              <optgroup label="Circular Charts">
                                <option value="radar">Radar Chart</option>
                                <option value="polar">Polar Plot</option>
                                <option value="radial_bar">Radial Bar Chart</option>
                                <option value="circular_heatmap">Circular Heatmap</option>
                              </optgroup>
                              <optgroup label="3D Charts">
                                <option value="3d_scatter">3D Scatter Plot</option>
                                <option value="3d_line">3D Line Plot</option>
                                <option value="3d_surface">3D Surface Plot</option>
                                <option value="3d_wireframe">3D Wireframe Plot</option>
                                <option value="3d_contour">3D Contour Plot</option>
                                <option value="3d_bar">3D Bar Chart</option>
                                <option value="3d_mesh">3D Mesh Plot</option>
                              </optgroup>
                              <optgroup label="Specialized Charts">
                                <option value="funnel">Funnel Chart</option>
                                <option value="gauge">Gauge Chart</option>
                                <option value="bullet">Bullet Chart</option>
                                <option value="pareto">Pareto Chart</option>
                                <option value="mosaic">Mosaic Plot</option>
                                <option value="ridgeline">Ridgeline Plot</option>
                                <option value="waffle">Waffle Chart</option>
                                <option value="lollipop">Lollipop Chart</option>
                                <option value="dumbbell">Dumbbell Chart</option>
                                <option value="marimekko">Marimekko Chart</option>
                                <option value="streamgraph">Streamgraph</option>
                                <option value="horizon">Horizon Chart</option>
                                <option value="gantt">Gantt Chart</option>
                                <option value="calendar_heatmap">Calendar Heatmap</option>
                                <option value="word_cloud">Word Cloud</option>
                                <option value="parallel_coordinates">Parallel Coordinates Plot</option>
                                <option value="andrews_curve">Andrews Curve</option>
                                <option value="roc_curve">ROC Curve</option>
                                <option value="precision_recall">Precision-Recall Curve</option>
                                <option value="lift_chart">Lift Chart</option>
                                <option value="calibration">Calibration Curve</option>
                              </optgroup>
                            </select>
                          </div>

                          {/* Plot Elements Checkboxes */}
                          <div className="flex flex-col gap-2 pt-1">
                            <span className="text-[11px] text-ink font-bold uppercase tracking-wide block mb-1">
                              Plot Overlays
                            </span>
                            
                            {chartType === "line" && (
                              <div className="flex items-center gap-xs">
                                <input
                                  id="ci-check"
                                  type="checkbox"
                                  checked={showCI}
                                  onChange={(e) => setShowCI(e.target.checked)}
                                  className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                                />
                                <label htmlFor="ci-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                  Show 95% Conf. Interval
                                </label>
                              </div>
                            )}

                            {(chartType === "bar" || chartType === "scatter") && (
                              <div className="flex items-center gap-xs">
                                <input
                                  id="ci-caps-check"
                                  type="checkbox"
                                  checked={showCI}
                                  onChange={(e) => setShowCI(e.target.checked)}
                                  className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                                />
                                <label htmlFor="ci-caps-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                  Show Confidence Error Caps
                                </label>
                              </div>
                            )}

                            {chartType !== "bar" && (
                              <div className="flex items-center gap-xs">
                                <input
                                  id="markers-check"
                                  type="checkbox"
                                  checked={showMarkers}
                                  onChange={(e) => setShowMarkers(e.target.checked)}
                                  className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                                />
                                <label htmlFor="markers-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                  Show Data Markers
                                </label>
                              </div>
                            )}

                            <div className="flex items-center gap-xs">
                              <input
                                id="trend-check"
                                type="checkbox"
                                checked={showTrendLine}
                                onChange={(e) => setShowTrendLine(e.target.checked)}
                                className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                              />
                              <label htmlFor="trend-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                Plot Historical Trendline
                              </label>
                            </div>

                            <div className="flex items-center gap-xs">
                              <input
                                id="ma-check"
                                type="checkbox"
                                checked={showMovingAverage}
                                onChange={(e) => setShowMovingAverage(e.target.checked)}
                                className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                              />
                              <label htmlFor="ma-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                Plot Moving Average
                              </label>
                            </div>

                            {showMovingAverage && (
                              <div className="flex items-center gap-2 pl-6">
                                <label htmlFor="ma-period" className="text-[11px] text-muted font-bold uppercase">Period:</label>
                                <input
                                  id="ma-period"
                                  type="number"
                                  value={movingAveragePeriod}
                                  onChange={(e) => setMovingAveragePeriod(Math.max(2, parseInt(e.target.value) || 3))}
                                  min="2"
                                  max="30"
                                  className="w-16 bg-canvas text-ink border border-hairline px-2 py-0.5 text-caption rounded-sm outline-none focus:border-ink"
                                />
                              </div>
                            )}

                            <div className="flex items-center gap-xs">
                              <input
                                id="minmax-check"
                                type="checkbox"
                                checked={showMinMax}
                                onChange={(e) => setShowMinMax(e.target.checked)}
                                className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                              />
                              <label htmlFor="minmax-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                Plot Min/Max Bounds
                              </label>
                            </div>
                          </div>

                          {/* Export Tools */}
                          <div className="flex flex-col gap-2 pt-2 border-t border-hairline">
                            <span className="text-[11px] text-ink font-bold uppercase tracking-wide block">
                              Export Projections
                            </span>
                            <div className="grid grid-cols-2 gap-sm">
                              <button
                                type="button"
                                disabled={!selectedRun?.chart?.config}
                                onClick={handleExportSVG}
                                className="btn-secondary py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Export SVG
                              </button>
                              <button
                                type="button"
                                disabled={!selectedRun?.chart?.config}
                                onClick={() => selectedRun?.chart?.config && handleExportCSV(selectedRun.chart.config)}
                                className="btn-secondary py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Export CSV
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setChartTheme("darkgrid");
                                setChartPalette("deep");
                                setChartType("line");
                                setShowCI(true);
                                setShowMarkers(true);
                                setShowTrendLine(false);
                                setShowMovingAverage(false);
                                setMovingAveragePeriod(3);
                                setShowMinMax(false);
                              }}
                              className="text-center text-[10px] text-[#aa2d00] uppercase font-bold tracking-wider hover:underline pt-1 cursor-pointer"
                            >
                              Reset to Default Style
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Display panel (8 Cols) */}
                      <div className="md:col-span-8 flex flex-col gap-md">
                        {selectedRun ? (
                          <div className="flex flex-col gap-md">
                            
                            {/* SVG Chart display */}
                            {selectedRun.chart?.config && (
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-muted font-bold tracking-widest uppercase">
                                    Simulation Chart // {selectedRun.chart.config.method}
                                  </span>
                                  <button
                                    onClick={() => setIsChartModalOpen(true)}
                                    className="p-1 hover:bg-surface-soft border border-hairline rounded text-muted hover:text-ink transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                                    title="Enlarge Chart"
                                  >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none" strokeWidth="2.5">
                                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                    </svg>
                                    Enlarge
                                  </button>
                                </div>
                                <div className="border border-hairline p-md rounded-md bg-canvas transition-all duration-300 hover:scale-[1.01] hover:shadow-md relative">
                                  {renderSVGChart(selectedRun.chart.config)}
                                  {hoveredPoint && (
                                    <div 
                                      className="absolute pointer-events-none bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded shadow-lg border border-slate-700/50 flex flex-col gap-0.5 z-50 -translate-x-1/2 -translate-y-full -mt-3 transition-opacity duration-150 animate-fade-in font-sans"
                                      style={{
                                        left: `${(hoveredPoint.x / 800) * 100}%`,
                                        top: `${(hoveredPoint.y / 480) * 100}%`,
                                      }}
                                    >
                                      <div className="flex gap-2 items-center justify-between">
                                        <span className="font-bold text-[9px] uppercase tracking-wider text-slate-400">{hoveredPoint.type}</span>
                                        <span className="font-mono text-sky-400 text-[10px]">{hoveredPoint.date}</span>
                                      </div>
                                      <span className="font-bold font-mono text-[12px] text-white">Value: {hoveredPoint.value.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Enlarge Modal */}
                                {isChartModalOpen && (
                                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-fade-in">
                                    <div className="bg-canvas border border-hairline rounded-lg p-6 max-w-5xl w-full flex flex-col gap-4 shadow-2xl relative">
                                      <div className="flex justify-between items-center border-b border-hairline pb-3">
                                        <h3 className="text-title-md font-cal text-ink m-0">
                                          Enlarged Visualization: {selectedRun.query}
                                        </h3>
                                        <button 
                                          onClick={() => setIsChartModalOpen(false)}
                                          className="p-1.5 rounded-full hover:bg-surface-soft text-muted hover:text-ink transition-colors border border-hairline cursor-pointer"
                                        >
                                          <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth="2">
                                            <path d="M18 6L6 18M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                      <div className="border border-hairline p-4 rounded bg-canvas flex justify-center items-center overflow-auto max-h-[70vh] relative w-full">
                                        {renderSVGChart(selectedRun.chart.config)}
                                        {hoveredPoint && (
                                          <div 
                                            className="absolute pointer-events-none bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded shadow-lg border border-slate-700/50 flex flex-col gap-0.5 z-50 -translate-x-1/2 -translate-y-full -mt-3 transition-opacity duration-150 animate-fade-in font-sans"
                                            style={{
                                              left: `${(hoveredPoint.x / 800) * 100}%`,
                                              top: `${(hoveredPoint.y / 480) * 100}%`,
                                            }}
                                          >
                                            <div className="flex gap-2 items-center justify-between">
                                              <span className="font-bold text-[9px] uppercase tracking-wider text-slate-400">{hoveredPoint.type}</span>
                                              <span className="font-mono text-sky-400 text-[10px]">{hoveredPoint.date}</span>
                                            </div>
                                            <span className="font-bold font-mono text-[12px] text-white">Value: {hoveredPoint.value.toLocaleString()}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {/* Simple Chart explanation banner */}
                                <div className="border border-hairline p-md bg-[#fafbfc] rounded-md flex gap-md items-start">
                                  <div className="w-5 h-5 bg-ink rounded-md flex items-center justify-center flex-shrink-0 text-white font-bold text-xs mt-0.5">i</div>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-caption text-ink font-bold block uppercase tracking-wider">
                                      Chart Insight
                                    </span>
                                    <p className="text-caption text-muted m-0 leading-relaxed font-semibold">
                                      {CHART_EXPLANATIONS[chartType] || "No explanation available for this chart type."}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Audit Logs */}
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] text-muted font-bold tracking-widest uppercase">
                                Multi-Agent Execution Log
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                                {selectedRun.logs.map((log, i) => (
                                  <div key={i} className="border border-hairline p-sm bg-[#fafbfc] rounded-md font-mono text-[11px] text-muted leading-relaxed">
                                    <strong className="text-ink text-caption font-bold block mb-1 uppercase font-sans">
                                      {log.agent_name}
                                    </strong>
                                    <span>Status: <strong className="text-success uppercase">success</strong></span><br />
                                    <span>Duration: <strong className="text-ink">{log.duration_ms} ms</strong></span><br />
                                    {log.agent_name.includes("Cleansing") ? (
                                      <>
                                        <span>Initial Rows: <strong className="text-ink">{log.output?.initial_rows}</strong></span><br />
                                        <span>Outliers: <strong className="text-ink">{log.output?.outliers_detected}</strong></span>
                                      </>
                                    ) : (
                                      <>
                                        <span>Model: <strong className="text-ink">{log.output?.method}</strong></span><br />
                                        <span>Historical points: <strong className="text-ink">{log.output?.historical_points}</strong></span>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        ) : (
                          <div className="border border-hairline border-dashed p-16 text-center rounded-md bg-[#fafbfc] flex flex-col justify-center items-center h-full min-h-[300px]">
                            <span className="text-caption text-muted font-bold uppercase tracking-wider mb-1">
                              Ready for Simulation
                            </span>
                            <p className="text-caption text-muted m-0 max-w-sm">
                              Run the forecast model configuration on the left to compute and visualize metrics.
                            </p>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Historical Simulation Runs Table */}
                    <div className="border border-hairline p-card-lg bg-canvas rounded-md flex flex-col gap-md">
                      <span className="text-caption text-ink font-bold uppercase tracking-wider block border-b border-hairline pb-1.5">
                        Simulation runs registry
                      </span>
                      {runs.length === 0 ? (
                        <span className="text-caption text-muted py-2">No previous forecast runs found.</span>
                      ) : (
                        <div className="flex flex-col divide-y divide-hairline-soft max-h-[200px] overflow-y-auto pr-1">
                          {runs.map((run) => (
                            <div
                              key={run.id}
                              onClick={() => handleSelectRun(run.id)}
                              className="py-2.5 flex justify-between items-center group cursor-pointer hover:bg-surface-soft px-1.5 rounded-sm"
                            >
                              <div className="flex flex-col gap-0.5 truncate">
                                <span className="text-caption text-ink font-semibold group-hover:text-brand-accent transition-colors truncate block">
                                  {run.query}
                                </span>
                                <span className="text-[11px] text-muted">
                                  Completed: {new Date(run.created_at).toLocaleString()} &bull; Speed: {run.duration_ms ?? "-"} ms
                                </span>
                              </div>
                              <button className="btn-secondary h-auto py-1 px-3 text-xs font-semibold">
                                View Chart
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* 3. INTERACTIVE CONVERSATIONAL RAG TAB */}
                {activeTab === "chat" && (
                  <div className={
                    isFullScreen 
                      ? "fixed inset-0 z-50 bg-canvas text-ink p-8 flex flex-col h-screen max-h-screen overflow-hidden backdrop-blur-md animate-fade-in"
                      : "grid grid-cols-12 gap-gutter h-[620px] bg-canvas overflow-hidden"
                  }>
                    {/* Fullscreen Close / Header Overlay in Fullscreen mode */}
                    {isFullScreen && (
                      <div className="flex justify-between items-center border-b border-hairline pb-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                          <h2 className="text-title-lg font-cal font-bold m-0 tracking-tight">Unified Analyst Terminal</h2>
                        </div>
                        <button
                          onClick={() => setIsFullScreen(false)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-hairline rounded-md hover:bg-surface-soft font-semibold text-xs transition-all text-ink cursor-pointer"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none" strokeWidth="2.5">
                            <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4" />
                          </svg>
                          Minimize Dashboard
                        </button>
                      </div>
                    )}

                    <div className={isFullScreen ? "grid grid-cols-12 gap-6 flex-grow h-[calc(100vh-120px)] overflow-hidden" : "contents"}>
                      {/* Left Pane: Chat Threads & Focus */}
                      <div className={`${
                        isFullScreen ? "col-span-3" : "col-span-3 border-r"
                      } border-hairline pr-6 flex flex-col justify-between h-full overflow-hidden`}>
                        <div className="flex flex-col h-full overflow-hidden">
                          <div className="flex justify-between items-center pb-4 mb-2">
                            <h3 className="text-sm font-semibold text-ink m-0 flex items-center gap-2">
                              <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              Conversations
                            </h3>
                            <button
                              onClick={handleCreateConversation}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-soft text-ink transition-colors"
                              title="New Thread"
                            >
                              <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                            </button>
                          </div>
                          
                          {/* Threads List */}
                          <div className="flex-grow overflow-y-auto space-y-1 pr-2">
                            {conversations.length === 0 ? (
                              <div className="text-center py-10 text-xs text-muted">
                                No active threads
                              </div>
                            ) : (
                              conversations.map((conv) => {
                                const isActive = activeConvId === conv.id;
                                return (
                                  <button
                                    key={conv.id}
                                    onClick={() => handleSelectConversation(conv.id)}
                                    className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all block ${
                                      isActive
                                        ? "bg-surface-soft text-ink font-medium"
                                        : "bg-transparent text-muted hover:bg-surface-soft hover:text-ink"
                                    }`}
                                  >
                                    <div className="truncate pr-2">
                                      {conv.preview || `Thread ${conv.id.slice(0, 8)}`}
                                    </div>
                                    <div className="text-[10px] text-muted opacity-60 mt-1">
                                      {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* RAG Context Focus */}
                        <div className="pt-4 mt-4 bg-canvas">
                          <label className="text-[11px] text-muted font-medium mb-1.5 flex items-center gap-1.5">
                            <svg viewBox="0 0 24 24" className="w-3 h-3 stroke-current fill-none" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            RAG Focus
                          </label>
                          <select
                            value={selectedDocId}
                            onChange={(e) => setSelectedDocId(e.target.value)}
                            className="w-full bg-surface-soft text-ink border-none px-3 py-2.5 text-xs rounded-xl focus:ring-1 focus:ring-ink outline-none transition-all cursor-pointer appearance-none"
                          >
                            <option value="">Query Entire Index</option>
                            {documents.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.filename}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Middle Pane: Chat Workspace */}
                      <div className={`${
                        isFullScreen ? "col-span-6" : "col-span-9"
                      } flex flex-col h-full ${!isFullScreen ? 'pl-2' : ''} overflow-hidden relative`}>
                        
                        {/* Active Conversation header */}
                        <div className="flex justify-between items-center pb-3 mb-2">
                          <div className="flex items-center gap-2">
                            {activeConvId ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-soft rounded-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                <span className="text-xs font-medium text-ink">Session: {activeConvId.slice(0, 8)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted">Select or start a session</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {isSending && (
                              <span className="text-[10px] font-mono text-link animate-pulse font-medium">Processing...</span>
                            )}
                            {!isFullScreen && (
                              <button
                                onClick={() => setIsFullScreen(true)}
                                className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-soft text-muted hover:text-ink transition-all cursor-pointer"
                                title="Expand to fullscreen"
                              >
                                <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none" strokeWidth="2">
                                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Message Log */}
                        <div className="flex-grow overflow-y-auto flex flex-col gap-6 px-2 pb-4 scrollbar-hide">
                          {messages.length === 0 ? (
                            <div className="m-auto text-center flex flex-col items-center justify-center opacity-60">
                              <div className="w-12 h-12 rounded-2xl bg-surface-soft flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-ink fill-none" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                              </div>
                              <h3 className="text-sm font-medium text-ink mb-1">How can I help you analyze the data?</h3>
                              <p className="text-xs text-muted max-w-[250px]">
                                Ask questions about trends, correlations, specific values, or request insights.
                              </p>
                            </div>
                          ) : (
                            <>
                              {messages.map((msg, i) => (
                                <div
                                  key={i}
                                  className={`flex flex-col gap-1.5 w-full ${
                                    msg.role === "user" ? "items-end" : "items-start"
                                  }`}
                                >
                                  <div
                                    className={`px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm max-w-[85%] ${
                                      msg.role === "user"
                                        ? "bg-ink text-canvas rounded-br-sm"
                                        : "bg-surface-soft text-ink rounded-bl-sm border border-hairline-soft"
                                    }`}
                                  >
                                    {renderMessageContent(msg.content)}
                                  </div>
                                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1 ml-1">
                                      {msg.sources.map((src, sIdx) => (
                                        <div key={sIdx} className="flex items-center gap-1 bg-surface-soft text-muted px-2 py-1 rounded-md border border-hairline text-[10px]">
                                          <svg viewBox="0 0 24 24" className="w-3 h-3 stroke-current fill-none" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                          {src.filename}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {isUploading && (
                                <div className="flex flex-col gap-1.5 items-start animate-pulse w-full">
                                  <div className="p-4 rounded-2xl rounded-bl-sm bg-surface-soft text-ink border border-hairline-soft max-w-[85%] w-[320px]">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-[11px] font-medium text-muted flex items-center gap-1.5">
                                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 30" strokeLinecap="round" className="opacity-25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"></path></svg>
                                        Analyzing Document...
                                      </span>
                                      <span className="text-[11px] font-medium text-ink">{Math.round(((ingestionStep + 1) / ingestionProgressLog.length) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden mb-3">
                                      <div 
                                        className="bg-ink h-full transition-all duration-500 ease-out"
                                        style={{ width: `${((ingestionStep + 1) / ingestionProgressLog.length) * 100}%` }}
                                      ></div>
                                    </div>
                                    <p className="text-[10px] text-muted m-0 truncate">
                                      {ingestionProgressLog[ingestionStep]}
                                    </p>
                                  </div>
                                </div>
                              )}
                              <div ref={messagesEndRef} />
                            </>
                          )}
                        </div>

                        {/* Input message form */}
                        <div className="pt-2 pb-1 relative bg-canvas">
                          <form onSubmit={(e) => handleSendMessage(e)} className="relative flex items-end gap-2 bg-surface-soft rounded-2xl border border-hairline focus-within:border-ink focus-within:ring-1 focus-within:ring-ink transition-all p-1.5">
                            <input
                              id="chat-file-upload-input"
                              type="file"
                              onChange={async (e) => {
                                if (e.target.files && e.target.files[0]) {
                                  await uploadFile(e.target.files[0]);
                                  e.target.value = "";
                                }
                              }}
                              accept=".txt,.pdf,.docx,.doc,.csv,.xlsx,.xls"
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById("chat-file-upload-input")?.click()}
                              disabled={isSending || isUploading}
                              className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-canvas transition-colors cursor-pointer flex-shrink-0"
                              title="Attach file for analysis"
                            >
                              <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                              </svg>
                            </button>
                            <textarea
                              value={inputText}
                              onChange={(e) => setInputText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage(e);
                                }
                              }}
                              placeholder="Message Agent..."
                              className="flex-grow bg-transparent text-ink border-none px-2 py-2.5 text-[13px] outline-none resize-none max-h-[120px] min-h-[40px]"
                              rows={1}
                              required
                              disabled={isSending || isUploading}
                              style={{ height: inputText ? 'auto' : '40px' }}
                            />
                            <button
                              type="submit"
                              disabled={isSending || isUploading || !inputText.trim()}
                              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                                inputText.trim() && !isSending && !isUploading 
                                  ? 'bg-ink text-canvas hover:opacity-90 cursor-pointer' 
                                  : 'bg-transparent text-muted cursor-not-allowed'
                              }`}
                              title="Send Message"
                            >
                              {isSending ? (
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 30" strokeLinecap="round" className="opacity-25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"></path></svg>
                              ) : (
                                <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                </svg>
                              )}
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Right Pane: Synced Tools */}
                      {isFullScreen && (
                        <div className="col-span-3 flex flex-col gap-md h-full pl-xs overflow-y-auto">
                        
                        {/* Section 1: Forecast Sync Tool */}
                        <div className="border border-hairline rounded-lg p-sm bg-[#fafbfc] flex flex-col gap-xs">
                          <div className="flex items-center justify-between border-b border-hairline pb-xs">
                            <span className="text-[10px] text-ink font-bold tracking-wider uppercase">Forecast Integration</span>
                            <span className={`w-2 h-2 rounded-full ${selectedRun ? "bg-green-500" : "bg-[#9297a0]"}`}></span>
                          </div>

                          {runs.length > 0 ? (
                            <div className="space-y-sm mt-xs">
                              <div>
                                <label className="text-[10px] text-muted font-bold block mb-1">Active Forecast Run:</label>
                                <select
                                  value={selectedRun?.id || ""}
                                  onChange={(e) => {
                                    if (e.target.value) handleSelectRun(e.target.value);
                                  }}
                                  className="w-full bg-canvas text-ink border border-hairline px-2 py-1 text-caption font-semibold rounded focus:border-ink outline-none"
                                >
                                  <option value="">Select a run to sync...</option>
                                  {runs.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.query.length > 20 ? r.query.slice(0, 20) + "..." : r.query} ({r.status})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {selectedRun && (
                                <div className="bg-canvas border border-hairline p-xs rounded text-[11px] space-y-1 font-mono text-muted">
                                  <div><span className="font-semibold text-ink">Method:</span> {selectedRun.result_metadata?.method || "ARIMA"}</div>
                                  <div><span className="font-semibold text-ink">Target:</span> {selectedRun.result_metadata?.target_column || "Value"}</div>
                                  <div><span className="font-semibold text-ink">Horizon:</span> {selectedRun.chart?.config?.forecast_values?.length ?? 12} steps</div>
                                </div>
                              )}

                              {selectedRun && (
                                <div className="grid grid-cols-2 gap-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const prompt = `Summarize the forecasting metrics, parameters, and findings for the simulation run "${selectedRun.query}".`;
                                      setInputText(prompt);
                                      handleSendMessage(null as any, prompt);
                                    }}
                                    className="w-full bg-[#f8fafc] hover:bg-[#e0e2e6] border border-hairline text-ink py-1 px-1.5 rounded text-[10px] font-semibold text-center transition-colors"
                                  >
                                    Explain Model
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const prompt = `Explain the detailed projections, confidence margins (upper and lower bounds) for the forecast run "${selectedRun.query}".`;
                                      setInputText(prompt);
                                      handleSendMessage(null as any, prompt);
                                    }}
                                    className="w-full bg-[#f8fafc] hover:bg-[#e0e2e6] border border-hairline text-ink py-1 px-1.5 rounded text-[10px] font-semibold text-center transition-colors"
                                  >
                                    Analyze Projections
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted m-0 mt-xs">No active forecasting runs available in this workspace.</p>
                          )}
                        </div>

                        {/* Section 2: Data Schema & Column Scanner */}
                        <div className="border border-hairline rounded-lg p-sm bg-[#fafbfc] flex flex-col gap-xs">
                          <div className="flex items-center justify-between border-b border-hairline pb-xs">
                            <span className="text-[10px] text-ink font-bold tracking-wider uppercase">Column Scanner</span>
                            {selectedDoc?.metadata?.is_tabular && (
                              <span className="text-[10px] font-mono font-bold bg-[#fcf0eb] text-[#aa2d00] px-1 rounded">TABULAR</span>
                            )}
                          </div>

                          {selectedDoc?.metadata?.columns ? (
                            <div className="space-y-sm mt-xs">
                              <span className="text-[10px] text-muted block">Select a column to generate quick analytical prompt:</span>
                              <div className="flex flex-wrap gap-xs max-h-[120px] overflow-y-auto border border-hairline p-xs rounded bg-canvas pr-xs">
                                {selectedDoc.metadata.columns.map((col: string) => {
                                  const type = selectedDoc.metadata.column_types?.[col] || "unknown";
                                  const isNum = type.toLowerCase().includes("int") || type.toLowerCase().includes("float") || type.toLowerCase().includes("num");
                                  return (
                                    <button
                                      key={col}
                                      type="button"
                                      onClick={() => {
                                        // Pre-fill action triggers for this column
                                        const prompt = `Analyze column "${col}" from the current dataset. Show its basic stats, check for anomalies, and explain what we can learn from it.`;
                                        setInputText(prompt);
                                      }}
                                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold bg-canvas hover:bg-surface-soft border border-hairline rounded px-1.5 py-0.5 transition-colors text-ink select-none"
                                    >
                                      <span className="truncate max-w-[80px]">{col}</span>
                                      <span className={`text-[8px] font-mono px-0.5 rounded ${isNum ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                                        {isNum ? "num" : "str"}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="grid grid-cols-3 gap-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = inputText.trim() || `Provide a detailed statistical summary of the column structure in the dataset.`;
                                    setInputText(text);
                                    handleSendMessage(null as any, text);
                                  }}
                                  className="bg-[#f8fafc] hover:bg-[#e0e2e6] border border-hairline text-ink py-1 px-1 rounded text-[9px] font-semibold text-center transition-colors"
                                >
                                  Stats Summary
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = inputText.trim() || `Run an outlier analysis across all columns to find anomalous records.`;
                                    setInputText(text);
                                    handleSendMessage(null as any, text);
                                  }}
                                  className="bg-[#f8fafc] hover:bg-[#e0e2e6] border border-hairline text-ink py-1 px-1 rounded text-[9px] font-semibold text-center transition-colors"
                                >
                                  Outlier Check
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = inputText.trim() || `Perform correlation analysis between numeric columns of the dataset.`;
                                    setInputText(text);
                                    handleSendMessage(null as any, text);
                                  }}
                                  className="bg-[#f8fafc] hover:bg-[#e0e2e6] border border-hairline text-ink py-1 px-1 rounded text-[9px] font-semibold text-center transition-colors"
                                >
                                  Correlations
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted m-0 mt-xs">No active dataset selected. Load a file to scan columns.</p>
                          )}
                        </div>

                        {/* Section 3: Analyst Shortcuts */}
                        <div className="border border-hairline rounded-lg p-sm bg-[#fafbfc] flex flex-col gap-xs">
                          <span className="text-[10px] text-ink font-bold tracking-wider uppercase border-b border-hairline pb-xs">Analyst Shortcuts</span>
                          <div className="grid grid-cols-2 gap-xs mt-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const text = "Explain any data quality issues, null values, or anomalies in the active dataset.";
                                setInputText(text);
                                handleSendMessage(null as any, text);
                              }}
                              className="bg-canvas hover:bg-surface-soft border border-hairline text-ink text-[10px] font-semibold py-1.5 px-2 rounded text-left transition-colors"
                            >
                              💡 Clean Data
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const text = "Create a brief summary highlighting the three most important trends in this dataset.";
                                setInputText(text);
                                handleSendMessage(null as any, text);
                              }}
                              className="bg-canvas hover:bg-surface-soft border border-hairline text-ink text-[10px] font-semibold py-1.5 px-2 rounded text-left transition-colors"
                            >
                              📈 Key Trends
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const text = "Evaluate all numerical values and explain the correlation matrix of this spreadsheet.";
                                setInputText(text);
                                handleSendMessage(null as any, text);
                              }}
                              className="bg-canvas hover:bg-surface-soft border border-hairline text-ink text-[10px] font-semibold py-1.5 px-2 rounded text-left transition-colors"
                            >
                              📊 Correlations
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const text = "Compile an executive brief summarizing the core findings, variables, and potential forecast models for this data.";
                                setInputText(text);
                                handleSendMessage(null as any, text);
                              }}
                              className="bg-canvas hover:bg-surface-soft border border-hairline text-ink text-[10px] font-semibold py-1.5 px-2 rounded text-left transition-colors"
                            >
                              📝 Executive Brief
                            </button>
                          </div>
                        </div>

                      </div>
                      )}
                    </div>

                  </div>
                )}

                {/* 4. EXECUTIVE PDF REPORTS TAB */}
                {activeTab === "reports" && (
                  <div className="flex flex-col gap-lg">
                    
                    <div className="border-b border-hairline pb-md">
                      <h2 className="text-title-lg text-ink font-cal m-0">Printable Executive Briefings</h2>
                      <span className="text-caption text-muted">
                        Compile completed simulations and visualizations into printable high-contrast PDF sheets.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-lg items-start">
                      
                      {/* Compiler (4 Cols) */}
                      <div className="md:col-span-4 border border-hairline p-card-lg bg-surface-soft rounded-md flex flex-col gap-md">
                        <span className="text-caption text-ink font-bold uppercase tracking-wider block border-b border-hairline pb-1.5">
                          PDF Compiler Settings
                        </span>

                        <form onSubmit={handleCompileReport} className="flex flex-col gap-md">
                          
                          {/* Step 1: Choose run */}
                          <div className="flex flex-col gap-1.5 p-3 border border-hairline rounded-md bg-canvas">
                            <label className="text-[11px] text-ink font-bold uppercase tracking-wide flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-ink text-white text-[9px]">1</span>
                              Select Data Run
                            </label>
                            <select
                              value={selectedAnalysisId}
                              onChange={(e) => setSelectedAnalysisId(e.target.value)}
                              className="bg-canvas text-ink border border-hairline px-3 py-2 text-caption rounded-md focus:border-ink outline-none mt-1"
                              required
                            >
                              <option value="">-- Choose Completed Run --</option>
                              {runs.filter(r => r.status === "completed").map((run) => (
                                <option key={run.id} value={run.id}>
                                  {run.query.substring(0, 32)}...
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Step 2: Choose Chart for AI Insights */}
                          <div className={`flex flex-col gap-2 p-3 border border-hairline rounded-md bg-canvas transition-opacity ${!selectedAnalysisId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            <label className="text-[11px] text-ink font-bold uppercase tracking-wide flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-ink text-white text-[9px]">2</span>
                              Gather AI Insights
                            </label>
                            <div className="text-caption text-muted mb-1 leading-snug">
                              Select a chart type from this run to generate an intelligent analysis based on your RAG vector knowledge.
                            </div>
                            
                            <select
                              value={reportChartType}
                              onChange={(e) => setReportChartType(e.target.value)}
                              className="bg-canvas text-ink border border-hairline px-3 py-2 text-caption rounded-md focus:border-ink outline-none"
                            >
                              <option value="Time Series Line Chart">Time Series Line Chart</option>
                              <option value="Bar Chart">Bar Chart</option>
                              <option value="Waterfall Chart">Waterfall Chart</option>
                              <option value="Scatter Plot">Scatter Plot</option>
                              <option value="Box Plot">Box Plot</option>
                            </select>
                            
                            {!chartExplanation ? (
                              <button
                                type="button"
                                onClick={handleGenerateExplanation}
                                disabled={isExplaining || !selectedAnalysisId}
                                className="btn-secondary w-full justify-center mt-1 border-ink text-ink hover:bg-ink hover:text-white"
                              >
                                {isExplaining ? "Analyzing Context Vectors..." : "Generate AI Insight"}
                              </button>
                            ) : (
                              <div className="mt-2 flex flex-col gap-1.5">
                                <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                  Insights Generated successfully
                                </span>
                                <textarea
                                  value={chartExplanation}
                                  onChange={(e) => setChartExplanation(e.target.value)}
                                  className="w-full h-32 text-xs bg-[#f8fafc] border border-hairline p-2 rounded-md outline-none focus:border-ink resize-y"
                                  placeholder="AI generated insight..."
                                />
                                <button type="button" onClick={() => setChartExplanation("")} className="text-xs text-muted hover:text-ink self-start underline">
                                  Regenerate / Clear
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Step 3: Compile Configuration */}
                          <div className={`flex flex-col gap-3 p-3 border border-hairline rounded-md bg-canvas transition-opacity ${!chartExplanation && !selectedAnalysisId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            <label className="text-[11px] text-ink font-bold uppercase tracking-wide flex items-center gap-1.5">
                              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-ink text-white text-[9px]">3</span>
                              Finalize & Compile
                            </label>
                            
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-muted font-bold uppercase tracking-wider">
                                Report Title
                              </label>
                              <input
                                type="text"
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                placeholder="e.g. Q4 Growth Briefing"
                                className="bg-canvas text-ink border border-hairline px-3 py-1.5 text-caption rounded-md focus:border-ink outline-none"
                                required
                              />
                            </div>

                            <div className="flex flex-col gap-2 pt-2 border-t border-hairline">
                              <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-0.5">
                                Included Formal Sections
                              </span>
                              
                              <div className="flex items-center gap-xs">
                                <input
                                  id="inc-chart-check"
                                  type="checkbox"
                                  checked={includeChart}
                                  onChange={(e) => setIncludeChart(e.target.checked)}
                                  className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                                />
                                <label htmlFor="inc-chart-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                  Include Visual Trendline Graph
                                </label>
                              </div>

                              <div className="flex items-center gap-xs">
                                <input
                                  id="inc-metrics-check"
                                  type="checkbox"
                                  checked={includeMetrics}
                                  onChange={(e) => setIncludeMetrics(e.target.checked)}
                                  className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                                />
                                <label htmlFor="inc-metrics-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                  Include Observed Data Table
                                </label>
                              </div>

                              <div className="flex items-center gap-xs">
                                <input
                                  id="inc-logs-check"
                                  type="checkbox"
                                  checked={includeLogs}
                                  onChange={(e) => setIncludeLogs(e.target.checked)}
                                  className="w-4 h-4 border border-hairline bg-canvas rounded-sm accent-black cursor-pointer"
                                />
                                <label htmlFor="inc-logs-check" className="text-caption text-ink font-semibold select-none cursor-pointer">
                                  Include Agent Audit Logs
                                </label>
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={isCompiling || !selectedAnalysisId}
                              className="btn-primary w-full mt-1"
                            >
                              {isCompiling ? "Compiling Official PDF..." : "Compile Official Report PDF"}
                            </button>
                          </div>

                        </form>
                      </div>

                      {/* Display compiled reports list (8 Cols) */}
                      <div className="md:col-span-8 flex flex-col gap-md">
                        <span className="text-caption text-ink font-bold uppercase tracking-wider block border-b border-hairline pb-1.5">
                          Executive PDF briefings library
                        </span>

                        {reports.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-hairline rounded-md bg-[#fafbfc]">
                            <span className="text-caption text-muted font-bold uppercase tracking-wider block mb-1">
                              No PDFs Compiled
                            </span>
                            <p className="text-caption text-muted m-0">
                              Compile completed simulations using the form on the left.
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col divide-y divide-hairline-soft">
                            {reports.map((rep) => (
                              <div
                                key={rep.id}
                                className="py-3.5 flex justify-between items-center group"
                              >
                                <div className="flex flex-col gap-0.5 truncate pr-2">
                                  <strong className="text-caption text-ink font-semibold truncate block">
                                    {rep.title}
                                  </strong>
                                  <span className="text-[11px] text-muted">
                                    Abstract: {rep.summary || "Completed forecast analysis brief."} &bull; {new Date(rep.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex gap-sm shrink-0">
                                  <a
                                    href={getApiUrl(`/api/v1/reports/${rep.id}/download`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary h-auto py-1 px-3 text-xs no-underline font-semibold"
                                  >
                                    Download PDF
                                  </a>
                                  <button
                                    onClick={() => handleDeleteReport(rep.id)}
                                    className="btn-secondary h-auto py-1 px-2.5 text-xs text-error hover:bg-red-50 hover:border-error/20"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                  </div>
                )}

              </>
            ) : (
              /* If no datasets exist in storage */
              <div className="flex flex-col justify-center items-center py-20 text-center">
                <span className="text-title-lg text-muted font-cal block mb-1">
                  Workspace Ready // Awaiting Data Ingestion
                </span>
                <p className="text-caption text-muted m-0 max-w-sm mb-md">
                  Please upload a spreadsheet or text document in the sidebar to initialize the RAG vector store and profile configurations.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* 3. Brand voltage full-bleed callout card (Airtable Signature Coral Card) */}
      <section className="bg-[#aa2d00] text-white rounded-lg p-card-xxl flex flex-col md:flex-row justify-between items-start md:items-center gap-lg mt-xl shadow-subtle">
        <div className="max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#ffd3c4] block mb-1">
            Data Analysis Authority
          </span>
          <h2 className="text-display-md text-white font-cal m-0 leading-tight">
            Production speeds with playground simplicity.
          </h2>
          <p className="text-caption text-[#ffd3c4] mt-xs leading-relaxed m-0">
            AnalystAI integrates vector indexes, outlier sanitization, statistical profiles, Prophet regression metrics, and PDF compilations in one lightweight, sandbox interface.
          </p>
        </div>
        <a 
          href="https://rag-data-analyser.onrender.com/docs" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="btn-secondary-on-dark no-underline text-ink font-semibold shrink-0"
        >
          Explore Sandbox API &raquo;
        </a>
      </section>

    </div>
  );
}
