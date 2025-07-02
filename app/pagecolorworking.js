"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"

export default function Page() {
  const containerRef = useRef(null)
  const [xmlContent, setXmlContent] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [colorPalette, setColorPalette] = useState([]) // Dynamic color palette
  const [selectedNodeColor, setSelectedNodeColor] = useState(null) // Track selected node color

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
          setError(null)
        })
        .catch((err) => {
          setError(err.message)
        })
        .finally(() => setIsLoading(false))
    }
  }, [xmlContent])

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      setIsLoading(true)
      const reader = new FileReader()
      reader.onload = (e) => {
        setXmlContent(e.target.result)
        setError(null)
        setIsLoading(false)
      }
      reader.onerror = () => {
        setError("Failed to read file")
        setIsLoading(false)
      }
      reader.readAsText(file)
    }
  }

  useEffect(() => {
    const tryRender = () => {
      if (
        typeof window !== "undefined" &&
        window.mxGraph &&
        window.mxUtils &&
        window.mxCodec &&
        window.mxGraphModel &&
        window.mxRubberband &&
        window.mxPanningHandler &&
        xmlContent &&
        containerRef.current
      ) {
        renderGraph(xmlContent)
        return true
      }
      return false
    }

    const interval = setInterval(() => {
      if (tryRender()) clearInterval(interval)
    }, 100)

    return () => clearInterval(interval)
  }, [xmlContent])

  /**
   * Show only the nodes matching this color (or everything for reset)
   */
  const handleColorFilter = (color) => {
    const graph = window.graph
    if (!graph) return
    const model = graph.getModel()
    model.beginUpdate()
    try {
      const cells = model.cells
      for (let id in cells) {
        const cell = cells[id]
        if (cell.vertex === 1) {
          const style = cell.style || ''
          // Look for fillColor in the style string
          const fillColorMatch = style.match(/fillColor=#([0-9a-fA-F]{6})/i)
          const fillColor = fillColorMatch ? `#${fillColorMatch[1].toLowerCase()}` : null

          if (!color) {
            // Show all nodes
            model.setVisible(cell, true)
          } else if (fillColor === color.toLowerCase()) {
            model.setVisible(cell, true)
          } else {
            model.setVisible(cell, false)
          }
        }
      }
      setSelectedNodeColor(color)
    } finally {
      model.endUpdate()
    }
    
    // Refresh the graph to ensure visibility changes are applied
    graph.refresh()
  }

  /**
   * Handle node click to show only that node's process/color
   */
  const handleNodeClick = (cell) => {
    if (!cell || !cell.vertex) return
    
    const style = cell.style || ''
    const fillColorMatch = style.match(/fillColor=#([0-9a-fA-F]{6})/i)
    const fillColor = fillColorMatch ? `#${fillColorMatch[1].toLowerCase()}` : null
    
    if (fillColor) {
      handleColorFilter(fillColor)
      console.log(`Clicked node with color: ${fillColor}`)
    }
  }

  /**
   * Show all nodes (reset filter)
   */
  const showAllNodes = () => {
    handleColorFilter(null)
    setSelectedNodeColor(null)
  }

  /**
   * Main graph rendering and color palette extraction
   */
  const renderGraph = (xml) => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, "text/xml")
      const diagramNode = doc.getElementsByTagName("diagram")[0]
      if (!diagramNode) throw new Error("No diagram found in XML")

      const diagramXml = diagramNode.innerHTML || new XMLSerializer().serializeToString(diagramNode.firstChild)
      const xmlDoc = window.mxUtils.parseXml(diagramXml)
      const codec = new window.mxCodec(xmlDoc)
      const model = new window.mxGraphModel()
      codec.decode(xmlDoc.documentElement, model)

      const container = containerRef.current
      container.innerHTML = ""

      const graph = new window.mxGraph(container, model)
      window.graph = graph

      graph.setHtmlLabels(true)
      graph.setConnectable(false)
      graph.setTooltips(true)
      graph.setEnabled(true)
      graph.setCellsResizable(false)
      graph.setCellsMovable(false)
      graph.setCellsEditable(false)
      graph.setPanning(true)
      graph.panningHandler.useLeftButtonForPanning = true
      graph.panningHandler.ignoreCell = true

      // Add click event listener for nodes
      graph.addListener(window.mxEvent.CLICK, function(sender, evt) {
        const cell = evt.getProperty('cell')
        if (cell && cell.vertex === 1) {
          handleNodeClick(cell)
        }
      })

      graph.panningHandler.addListener(window.mxEvent.PAN_START, function() {
        container.style.cursor = 'grabbing'
      })
      graph.panningHandler.addListener(window.mxEvent.PAN_END, function() {
        container.style.cursor = 'grab'
      })

      graph.addMouseListener({
        mouseDown: function(sender, me) {
          if (me.getState() == null) container.style.cursor = 'grabbing'
        },
        mouseMove: function(sender, me) {
          if (me.getState() == null && !graph.panningHandler.active) {
            container.style.cursor = 'grab'
          } else if (me.getState() != null) {
            container.style.cursor = 'pointer'
          }
        },
        mouseUp: function(sender, me) {
          if (!graph.panningHandler.active) {
            container.style.cursor = me.getState() == null ? 'grab' : 'pointer'
          }
        }
      })
      container.addEventListener("dragstart", (e) => e.preventDefault())
      container.addEventListener("selectstart", (e) => e.preventDefault())

      new window.mxRubberband(graph)

      graph.getModel().beginUpdate()
      try {
        graph.refresh()
        fitDiagramToView(graph, container)
        extractColors(model) // Extract color palette from graph nodes
      } finally {
        graph.getModel().endUpdate()
      }

      const cells = model.cells
      for (let id in cells) {
        if (cells[id].value && cells[id].value.indexOf("swimlane") !== -1) {
          graph.foldCells(true, false, [cells[id]], true)
        }
      }

      container.style.cursor = 'grab'
    } catch (err) {
      console.error("Error rendering graph:", err)
      setError("Failed to render diagram")
    }
  }

  /**
   * Extract all unique fill colors into colorPalette
   */
  const extractColors = (model) => {
    const colors = new Set()
    for (let id in model.cells) {
      const cell = model.cells[id]
      if (cell.vertex === 1) {
        const style = cell.style || ''
        // Look for fillColor in the style string
        const fillColorMatch = style.match(/fillColor=#([0-9a-fA-F]{6})/i)
        if (fillColorMatch) {
          const fillColor = `#${fillColorMatch[1].toLowerCase()}`
          colors.add(fillColor)
        }
      }
    }
    console.log("Extracted colors:", Array.from(colors))
    setColorPalette(Array.from(colors))
  }

  const fitDiagramToView = (graph, container) => {
    if (!graph || !container) return
    const bounds = graph.getGraphBounds()
    if (bounds.width === 0 || bounds.height === 0) return
    const padding = 20
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const scaleX = (containerWidth - padding * 2) / bounds.width
    const scaleY = (containerHeight - padding * 2) / bounds.height
    const scale = Math.min(scaleX, scaleY, 1)
    graph.view.setScale(scale)
    graph.view.setTranslate(-bounds.x + padding / scale, -bounds.y + padding / scale)
    setZoomLevel(Math.round(scale * 100))
  }

  const handleZoomIn = () => {
    if (window.graph) {
      window.graph.zoomIn()
      setZoomLevel(Math.round(window.graph.view.scale * 100))
    }
  }

  const handleZoomOut = () => {
    if (window.graph) {
      window.graph.zoomOut()
      setZoomLevel(Math.round(window.graph.view.scale * 100))
    }
  }

  const handleFitView = () => {
    if (window.graph && containerRef.current) {
      fitDiagramToView(window.graph, containerRef.current)
    }
  }

  const handleActualSize = () => {
    if (window.graph) {
      window.graph.zoomActual()
      setZoomLevel(100)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading diagram...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Diagram</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script src="https://unpkg.com/mxgraph/javascript/mxClient.min.js" strategy="beforeInteractive" />
      <div className="min-h-screen flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 bg-primary">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">YASH SAP Process Map Viewer</h1>
                  <p className="text-sm text-gray-600"></p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleZoomIn} className="toolbar-btn">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                  Zoom In
                </button>
                <button onClick={handleZoomOut} className="toolbar-btn">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                    />
                  </svg>
                  Zoom Out
                </button>
                <button onClick={handleFitView} className="toolbar-btn">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  Fit to View
                </button>
                <button onClick={handleActualSize} className="toolbar-btn">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4V4z" />
                  </svg>
                  Actual Size
                </button>
                
                <div className="flex items-center gap-2 ml-4">
                  <span className="font-semibold text-gray-700">Filter by Color:</span>
                  {colorPalette.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorFilter(color)}
                      style={{
                        backgroundColor: color,
                        border: selectedNodeColor === color ? "3px solid #333" : "1px solid #bbb",
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                      title={`Filter by ${color}`}
                    />
                  ))}
                  <button
                    onClick={showAllNodes}
                    style={{
                      backgroundColor: "#fff",
                      border: selectedNodeColor === null ? "3px solid #333" : "1px solid #bbb",
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                    title="Show All"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-gray-700">Upload XML:</label>
                  <input type="file" accept=".xml" onChange={handleFileUpload} className="input-file" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 font-medium">Zoom:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 font-mono">
                    {zoomLevel}%
                  </span>
                </div>
              </div>
            </div>
            
            {selectedNodeColor && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Showing only nodes with color: </span>
                  <div 
                    style={{ 
                      backgroundColor: selectedNodeColor, 
                      width: 16, 
                      height: 16, 
                      borderRadius: 2,
                      border: "1px solid #999"
                    }}
                  />
                  <span className="font-mono">{selectedNodeColor}</span>
                  <button 
                    onClick={showAllNodes}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    Show All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto h-full">
            <div className="card h-full overflow-hidden">
              <div
                ref={containerRef}
                className="w-full h-full custom-scrollbar"
                style={{
                  height: "calc(100vh - 180px)",
                  overflow: "hidden",
                  cursor: "grab",
                  backgroundColor: "#fafafa",
                  touchAction: "none",
                  userSelect: "none",
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  )
}