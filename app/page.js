"use client";
import { useEffect, useRef, useState } from "react"
 
// Helper: normalize color to #rrggbb lowercase
function normalizeColor(color) {
  if (!color) return null
  if (color.startsWith("%23")) color = "#" + color.slice(3)
  if (!color.startsWith("#")) color = "#" + color
  return color.toLowerCase()
}
 
// Helper: get contrasting text color
function getContrastColor(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}
 
// Map of normalized colors to their descriptive names from the image
const colorToNameMap = {
  "#cce5ff": "SD-C2C",
  "#d5e8d4": "FI",
  "#e1d5e7": "SCM(QM,MM)",
  "#fff2cc": "MRO",
  "#e6d0de": "External System",
  "#e5e5e5": "Bank accounting",
  "#f5b500": "Customizations",
  "#ff0000": "Ticket count",
  "#ffff88": "MRO",
  "#f5f5f5": "Bank accounting",
  "#ffcd28": "Customizations",
};
 
export default function Page() {
  const containerRef = useRef(null)
  const [xmlContent, setXmlContent] = useState(null)
  const [originalXmlContent, setOriginalXmlContent] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDiagramLoading, setIsDiagramLoading] = useState(false)
  const [error, setError] = useState(null)
  const [colorFilters, setColorFilters] = useState([])
  const [activeFilter, setActiveFilter] = useState(null)
 
  // Fetch default diagram on mount
  useEffect(() => {
    if (!xmlContent) {
      setIsLoading(true)
      fetch("/sourcemap.xml")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load default diagram")
          return res.text()
        })
        .then((data) => {
          setXmlContent(data)
          setOriginalXmlContent(data)
          setError(null)
        })
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false))
    }
  }, [xmlContent])
 
  // File upload handler
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      setIsLoading(true)
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target.result
        setXmlContent(data)
        setOriginalXmlContent(data)
        setError(null)
        setActiveFilter(null)
        setIsLoading(false)
      }
      reader.onerror = () => {
        setError("Failed to read file")
        setIsLoading(false)
      }
      reader.readAsText(file)
    }
  }
 
  // Extract unique node fill colors from XML
  const extractNodeColorsFromXML = (xml) => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xml, "text/xml")
      const mxCells = xmlDoc.getElementsByTagName("mxCell")
      const colors = new Set()
      for (let cell of mxCells) {
        const style = cell.getAttribute("style")
        if (!style) continue
        if (cell.getAttribute("edge") === "1") continue
        const match = style.match(/fillColor=([#%0-9a-fA-F]+)/)
        if (match) {
          let color = normalizeColor(match[1])
          if (color === "#dae8fc") {
            color = "#cce5ff"
          }
          if (
            color !== "#ffffff" && color !== "#000000" &&
            color !== "#f8f8f8" && color !== "#fafafa" &&
            color !== "#e5e5e5" && color !== "#d3d3d3" &&
            color !== "#cccccc"
          ) {
            colors.add(color)
          }
        }
      }
      const sortedColors = Array.from(colors).sort()
      setColorFilters(sortedColors)
      return sortedColors
    } catch (err) {
      console.error("Error extracting node colors:", err)
      return []
    }
  }
 
  // Create filtered XML: only selected color, others gray
function createColorFilteredXML(originalXml, selectedColor) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalXml, "text/xml");
    const mxCells = Array.from(xmlDoc.getElementsByTagName("mxCell"));
    const grayColor = "#f6f6f6";
    const selected = normalizeColor(selectedColor);
    const errorColor = "#ff0000";
 
    // Build maps for quick lookup
    const cellById = {};
    const incomingEdges = {};
    const outgoingEdges = {};
    mxCells.forEach(cell => {
      const id = cell.getAttribute("id");
      cellById[id] = cell;
      // Build incoming/outgoing edge maps
      if (cell.getAttribute("edge") === "1") {
        const source = cell.getAttribute("source");
        const target = cell.getAttribute("target");
        if (target) {
          if (!incomingEdges[target]) incomingEdges[target] = [];
          incomingEdges[target].push(source);
        }
        if (source) {
          if (!outgoingEdges[source]) outgoingEdges[source] = [];
          outgoingEdges[source].push(target);
        }
      }
    });
 
    // Find all nodes that are colored (active in this filter)
    const activeNodeIds = new Set();
    mxCells.forEach(cell => {
      const style = cell.getAttribute("style");
      if (!style) return;
      if (cell.getAttribute("edge") === "1") return;
      const fillMatch = style.match(/fillColor=([#%0-9a-fA-F]+)/);
      let fillColor = fillMatch ? normalizeColor(fillMatch[1]) : null;
      if (fillColor === "#dae8fc") fillColor = "#cce5ff";
      if (fillColor === selected) {
        activeNodeIds.add(cell.getAttribute("id"));
      }
    });
 
    // For each active node, trace back to its start event(s)
    const highlightStartNodes = new Set();
    function traceToStart(nodeId, visited = new Set()) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const cell = cellById[nodeId];
      if (!cell) return;
      const style = cell.getAttribute("style") || "";
      if (
        style.includes("shape=mxgraph.bpmn.event") &&
        style.includes("outline=standard")
      ) {
        highlightStartNodes.add(nodeId);
        return;
      }
      const sources = incomingEdges[nodeId] || [];
      sources.forEach(sourceId => traceToStart(sourceId, visited));
    }
    activeNodeIds.forEach(nodeId => traceToStart(nodeId));
 
    // For each active node, trace forward to its end event(s)
    const highlightEndNodes = new Set();
    function traceToEnd(nodeId, visited = new Set()) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const cell = cellById[nodeId];
      if (!cell) return;
      const style = cell.getAttribute("style") || "";
      if (
        style.includes("shape=mxgraph.bpmn.event") &&
        style.includes("outline=end")
      ) {
        highlightEndNodes.add(nodeId);
        return;
      }
      const targets = outgoingEdges[nodeId] || [];
      targets.forEach(targetId => traceToEnd(targetId, visited));
    }
    activeNodeIds.forEach(nodeId => traceToEnd(nodeId));
 
    // Now apply coloring logic
    mxCells.forEach(cell => {
      const style = cell.getAttribute("style");
      if (!style) return;
      if (cell.getAttribute("edge") === "1") return;
      const fillMatch = style.match(/fillColor=([#%0-9a-fA-F]+)/);
      const gradMatch = style.match(/gradientColor=([#%0-9a-fA-F]+)/);
      let fillColor = fillMatch ? normalizeColor(fillMatch[1]) : null;
      let gradColor = gradMatch ? normalizeColor(gradMatch[1]) : null;
      if (fillColor === "#dae8fc") fillColor = "#cce5ff";
      if (gradColor === "#dae8fc") gradColor = "#cce5ff";
      const cellId = cell.getAttribute("id");
 
      // Highlight if active node, error, start, or end event for active
      if (
        fillColor === selected ||
        gradColor === selected ||
        fillColor === errorColor ||
        gradColor === errorColor ||
        highlightStartNodes.has(cellId) ||
        highlightEndNodes.has(cellId)
      ) {
        return; // keep original color
      }
 
      // Otherwise, gray out
      let newStyle = style;
      if (fillMatch) {
        newStyle = newStyle.replace(/fillColor=([#%0-9a-fA-F]+)/, `fillColor=${grayColor}`);
      } else {
        newStyle += `;fillColor=${grayColor}`;
      }
      if (gradMatch) {
        newStyle = newStyle.replace(/gradientColor=([#%0-9a-fA-F]+)/, `gradientColor=${grayColor}`);
      } else {
        newStyle += `;gradientColor=${grayColor}`;
      }
      cell.setAttribute("style", newStyle);
    });
 
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  } catch (err) {
    console.error("Error creating color-filtered XML:", err);
    return originalXml;
  }
}
 
 
 
  // Render diagram in viewer with controls on the right side
  const renderDiagramViewer = (xml, isFiltered = false, filterColor = null) => {
    const container = containerRef.current;
    if (!container) return;
   
    setIsDiagramLoading(true);
    container.innerHTML = "";
   
    // Create wrapper div for padding and margin
    const wrapperDiv = document.createElement("div");
    wrapperDiv.style.width = "100%";
    wrapperDiv.style.height = "100%";
    wrapperDiv.style.padding = "20px";
    wrapperDiv.style.margin = "8px";
    wrapperDiv.style.boxSizing = "border-box";
    wrapperDiv.style.overflow = "scroll";
    wrapperDiv.style.backgroundColor = "#ffffff";
   
    const iframe = document.createElement("iframe");
    iframe.id = "drawio-iframe";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "1px solid #e5e7eb";
    iframe.style.borderRadius = "8px";
    iframe.style.backgroundColor = "#ffffff";
    iframe.style.overflow = "scroll";
    iframe.style.boxSizing = "border-box";
   
    const encodedXml = encodeURIComponent(xml);
    const viewerParams = new URLSearchParams({
      lightbox: "1",
  highlight: "0000ff",
  layers: "1",
  nav: "1",
  fit: "1", // <-- this is the important part
  center: "1",
  tooltips: "1",
  toolbar: "zoom layers",
  zoom: "2",
      pan: "0",
      // Position toolbar on the right side vertically
      tb: "0", // Hide default toolbar
      ui: "kennedy", // Use Kennedy UI theme
      chrome: "0", // Minimal chrome
      picker: "0", // No color picker
      stepper: "0", // No stepper
      ruler: "0", // No ruler
      grid: "0", // Show grid
      guides: "1", // Show guides
      page: "0", // No page view
      fold: "0", // No folding
      tags: "{}",
      // Custom toolbar configuration for right side
      toolbar_position: "right",
      toolbar_orientation: "vertical"
    });
   
    iframe.src = `https://viewer.diagrams.net/?${viewerParams.toString()}#R${encodedXml}`;
 
    let loadTimeout;
    let positioningComplete = false;
   
    // Listen for messages from the iframe
    const handleMessage = (event) => {
      if (event.source === iframe.contentWindow) {
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'init' || message.event === 'load') {
            if (!positioningComplete) {
              positioningComplete = true;
              performPositioning();
            }
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      }
    };
   
    const performPositioning = () => {
      setTimeout(() => {
        try {
          // Set initial zoom to show content with padding
          iframe.contentWindow.postMessage(
            JSON.stringify({ action: "zoom", zoom: 0.75 }),
            "*"
          );
         
          // Position with left padding to prevent content cutoff
          setTimeout(() => {
            iframe.contentWindow.postMessage(
              JSON.stringify({ action: "pan", x: -100, y: -80 }),
              "*"
            );
          }, 300);
         
          // Hide loading after positioning
          setTimeout(() => {
            setIsDiagramLoading(false);
          }, 600);
         
        } catch (e) {
          console.log("Positioning commands failed:", e);
          setIsDiagramLoading(false);
        }
      }, 200);
    };
   
    // Add message listener
    window.addEventListener('message', handleMessage);
   
    iframe.onload = () => {
      clearTimeout(loadTimeout);
     
      // Fallback timeout
      loadTimeout = setTimeout(() => {
        if (!positioningComplete) {
          positioningComplete = true;
          performPositioning();
        }
      }, 4000);
     
      // Try positioning after iframe loads
      setTimeout(() => {
        if (!positioningComplete) {
          positioningComplete = true;
          performPositioning();
        }
      }, 2000);
    };
   
    iframe.onerror = () => {
      clearTimeout(loadTimeout);
      window.removeEventListener('message', handleMessage);
      setIsDiagramLoading(false);
      setError("Failed to load diagram viewer");
    };
   
    // Append iframe to wrapper, then wrapper to container
    wrapperDiv.appendChild(iframe);
    container.appendChild(wrapperDiv);
    setActiveFilter(filterColor);
   
    // Cleanup function
    return () => {
      clearTimeout(loadTimeout);
      window.removeEventListener('message', handleMessage);
    };
  };
 
  // Apply color filter
  const applyColorFilter = (selectedColor) => {
    if (!originalXmlContent) {
      setError("No diagram loaded")
      return
    }
    setError(null)
    if (selectedColor) {
      const filteredXml = createColorFilteredXML(originalXmlContent, selectedColor)
      setXmlContent(filteredXml)
      renderDiagramViewer(filteredXml, true, selectedColor)
    } else {
      setXmlContent(originalXmlContent)
      renderDiagramViewer(originalXmlContent, false, null)
    }
  }
 
  // On XML or filter change, update color filters and render
  useEffect(() => {
    if (originalXmlContent && containerRef.current) {
      extractNodeColorsFromXML(originalXmlContent)
      renderDiagramViewer(xmlContent || originalXmlContent, activeFilter !== null, activeFilter)
    }
  }, [xmlContent, originalXmlContent])
 
  // Button handlers
  const handleColorFilterClick = (color) => applyColorFilter(color)
  const showAllFlows = () => applyColorFilter(null)
 
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading diagram...</p>
        </div>
      </div>
    )
  }
 
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Diagram</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
 
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 bg-blue-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">YASH SAP Process Map Viewer</h1>
              </div>
            </div>
          </div>
        </div>
      </header>
 
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col gap-4">
            {/* File Upload Section */}
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">Upload XML:</label>
              <input
                type="file"
                accept=".xml,.drawio"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
 
            {/* Color Filter Buttons */}
            {colorFilters.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Filter by Process Flow:</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={showAllFlows}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeFilter === null
                        ? "bg-gray-800 text-white shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Show All Flows
                  </button>
                  {colorFilters
  .filter(color => color !== "#f8cecc" && color !== "#ff0000")
  .map((color, index) => (
    <button
      key={color}
      onClick={() => handleColorFilterClick(color)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
        activeFilter === color ? "ring-2 ring-gray-800 shadow-lg" : "hover:shadow-md"
      }`}
      style={{
        backgroundColor: color,
        color: getContrastColor(color),
        border: activeFilter === color ? "2px solid #1f2937" : "1px solid rgba(0,0,0,0.1)",
      }}
    >
      <div className="w-3 h-3 rounded-full border border-current" style={{ backgroundColor: color }} />
      {colorToNameMap[color] || `Process Flow ${index + 1}`}
      {activeFilter === color && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
))}
 
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
 
      <main className="flex-1 p-4 sm:p-6 relative">
        <div className="max-w-7xl mx-auto h-full">
          <div className="bg-white rounded-lg shadow-lg relative overflow-hidden">
            {/* Loading overlay for diagram */}
            {isDiagramLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-20 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-700 text-xl font-medium">Loading diagram viewer...</p>
                  <p className="text-gray-500 text-sm mt-2">Configuring controls for optimal viewing experience</p>
                  <div className="mt-4 flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></div>
                  </div>
                </div>
              </div>
            )}
           
            <div
              ref={containerRef}
              className="w-full bg-gray-50"
              style={{
                height: "calc(100vh - 280px)",
                minHeight: "500px",
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
          </div>
        </div>
      </main>
    </div>
  )
}