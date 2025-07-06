"use client"

import { useEffect, useRef, useState } from "react"

export default function Page() {
  const containerRef = useRef(null)
  const [xmlContent, setXmlContent] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tooltip, setTooltip] = useState({ show: false, content: '', x: 0, y: 0 })

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
          setError(null)
        })
        .catch((err) => {
          setError(err.message)
        })
        .finally(() => setIsLoading(false))
    }
  }, [xmlContent])

  // Handle file upload
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

  // Parse XML to extract node information for tooltips
  const parseNodeData = (xml) => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xml, "text/xml")
      const cells = xmlDoc.querySelectorAll('mxCell')
      const nodeData = {}

      cells.forEach(cell => {
        const id = cell.getAttribute('id')
        const value = cell.getAttribute('value')
        if (value && value.trim() !== '') {
          const decodedValue = decodeURIComponent(value.replace(/</g, '<').replace(/>/g, '>').replace(/&/g, '&'))
          const tooltipContent = decodedValue.replace(/<[^>]*>/g, '') // Remove HTML tags
          nodeData[id] = { content: tooltipContent }
        }
      })

      console.log("Parsed node data:", nodeData)
      return nodeData
    } catch (err) {
      console.error('Error parsing XML for tooltip data:', err)
      return {}
    }
  }

  // Render diagram viewer with tooltip support
  const renderDiagramViewer = (xml) => {
    try {
      const container = containerRef.current
      container.innerHTML = ""

      // Parse node data for tooltips
      const nodeData = parseNodeData(xml)

      // Create iframe with viewer settings
      const iframe = document.createElement("iframe")
      iframe.style.width = "100%"
      iframe.style.height = "100%"
      iframe.style.border = "none"
      iframe.style.backgroundColor = "#ffffff"

      const encodedXml = encodeURIComponent(xml)
      const viewerParams = new URLSearchParams({
        lightbox: "1",
        highlight: "0000ff",
        
        layers: "1",
        nav: "1",
        title: "Process Map",
        bg: "white",
        "page-bg": "white",
        fit: "1",
        zoom: "fit",
        scale: "1.2",
        center: "1",
        tooltips: "1",
        enableMouseEvents: "1", // Added to ensure mouse events are sent
      })

      iframe.src = `https://viewer.diagrams.net/?${viewerParams.toString()}#R${encodedXml}`

      // Message handler for tooltip events
      const messageHandler = (event) => {
        if (event.origin !== "https://viewer.diagrams.net") return

        console.log("Received message from viewer:", event.data)

        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data

          if (data.event === "init") {
            // Configure viewer for tooltips
            iframe.contentWindow.postMessage(
              JSON.stringify({
                action: "configure",
                config: {
                  exportBg: "white",
                  exportTransparent: false,
                  fitWindow: true,
                  center: true,
                  tooltips: true,
                  enableTooltips: true,
                  mouseEvents: true,
                },
              }),
              "https://viewer.diagrams.net"
            )
            console.log("Sent tooltip configuration to viewer")
          } else if (data.event === "pointermove" || data.event === "mouseover" || data.event === "mousemove") {
            // Handle tooltip display
            const cellId = data.cellId || data.id
            if (cellId && nodeData[cellId]) {
              const rect = container.getBoundingClientRect()
              setTooltip({
                show: true,
                content: nodeData[cellId].content,
                x: (data.x || 0) + rect.left + 10,
                y: (data.y || 0) + rect.top - 10,
              })
              console.log("Showing tooltip for cell:", cellId, nodeData[cellId].content)
            } else {
              setTooltip(prev => ({ ...prev, show: false }))
              console.log("No tooltip data for cellId:", cellId)
            }
          } else if (data.event === "pointerout" || data.event === "mouseout") {
            setTooltip(prev => ({ ...prev, show: false }))
            console.log("Hiding tooltip")
          }
        } catch (e) {
          console.log("Ignoring invalid message data:", e.message)
        }
      }

      window.addEventListener("message", messageHandler)

      iframe.onload = () => {
        console.log("✅ Diagram viewer loaded")
        // Send fit-to-view configuration
        setTimeout(() => {
          iframe.contentWindow.postMessage(
            JSON.stringify({
              action: "fit",
              config: {
                fitWindow: true,
                center: true,
                maxScale: 2,
                minScale: 0.5,
              },
            }),
            "https://viewer.diagrams.net"
          )
        }, 1000)
      }

      container.appendChild(iframe)

      // Store cleanup function
      container._cleanup = () => {
        window.removeEventListener("message", messageHandler)
        setTooltip({ show: false, content: '', x: 0, y: 0 })
      }
    } catch (err) {
      console.error("Error rendering diagram viewer:", err)
      setError("Failed to render diagram")
    }
  }

  useEffect(() => {
    if (xmlContent && containerRef.current) {
      if (containerRef.current._cleanup) {
        containerRef.current._cleanup()
      }
      renderDiagramViewer(xmlContent)
    }

    return () => {
      if (containerRef.current && containerRef.current._cleanup) {
        containerRef.current._cleanup()
      }
    }
  }, [xmlContent])

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
                
                              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-gray-700">Upload XML:</label>
              <input type="file" accept=".xml,.drawio" onChange={handleFileUpload} className="input-file" />
            </div>
           
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 sm:p-6 relative">
        <div className="max-w-7xl mx-auto h-full">
          <div className="card h-full overflow-hidden relative">
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{
                height: "calc(100vh - 200px)",
                overflow: "hidden",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                margin: "0 16px",
              }}
            />
            {tooltip.show && (
              <div
                className="absolute z-50 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none max-w-xs"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: 'translate(10px, -100%)',
                }}
              >
                <div className="whitespace-pre-line">{tooltip.content}</div>
                <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}