// YashProcessMapViewer/app/page.jsx

'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function Page() {
  const containerRef = useRef(null);
  const [xmlContent, setXmlContent] = useState(null);

  useEffect(() => {
    fetch('/sourcemap.xml')
      .then(res => res.text())
      .then(setXmlContent)
      .catch(err => console.error('❌ Failed to fetch XML:', err));
  }, []);

  useEffect(() => {
    const tryRender = () => {
      if (
        window.mxGraph &&
        window.mxUtils &&
        window.mxCodec &&
        window.mxGraphModel &&
        window.mxRubberband &&
        window.mxPanningHandler &&
        xmlContent
      ) {
        renderGraph(xmlContent);
        return true;
      }
      return false;
    };

    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 100);
    }
  }, [xmlContent]);

  const renderGraph = (xml) => {
    console.log('🛠️ Parsing XML and rendering graph...');

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const diagramNode = doc.getElementsByTagName('diagram')[0];
    const diagramXml = diagramNode.innerHTML || new XMLSerializer().serializeToString(diagramNode.firstChild);

    const xmlDoc = mxUtils.parseXml(diagramXml);
    const codec = new mxCodec(xmlDoc);
    const model = new mxGraphModel();
    codec.decode(xmlDoc.documentElement, model);

    const container = containerRef.current;
    container.innerHTML = ''; // Clear previous render
    const graph = new mxGraph(container, model); // Pass model directly during initialization
    window.graph = graph;

    graph.setHtmlLabels(true);
    graph.setConnectable(false);
    graph.setPanning(true);
    graph.setTooltips(true);
    graph.setEnabled(true);
    new mxPanningHandler(graph);
    new mxRubberband(graph);

    graph.getModel().beginUpdate();
    try {
      graph.refresh();
    } finally {
      graph.getModel().endUpdate();
    }

    console.log('✅ Graph rendered successfully.');
  };

  return (
    <>
      <Script src="https://unpkg.com/mxgraph/javascript/mxClient.min.js" strategy="beforeInteractive" />
      <main className="flex flex-col items-start justify-start min-h-screen bg-white overflow-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Yash Process Map Viewer</h1>
        <div className="flex gap-2 mb-2">
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={() => {
              if (window.graph) {
                window.graph.zoomIn();
              }
            }}
          >
            Zoom In
          </button>
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={() => {
              if (window.graph) {
                window.graph.zoomOut();
              }
            }}
          >
            Zoom Out
          </button>
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded"
            onClick={() => {
              if (window.graph) {
                window.graph.zoomActual();
                window.graph.fit(containerRef.current, true);
              }
            }}
          >
            Fit View
          </button>
        </div>
        <div
          ref={containerRef}
          style={{ overflowX: 'auto', width: '100%', height: '80vh' }}
          className="border border-gray-300 shadow-md"
        ></div>
      </main>
    </>
  );
}