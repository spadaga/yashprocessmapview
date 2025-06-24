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
      if (window.mxGraph && window.mxUtils && window.mxCodec && window.mxGraphModel && xmlContent) {
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
    const graph = new mxGraph(container, model);
    graph.setHtmlLabels(true);
    
    graph.getModel().beginUpdate();
    try {
      graph.refresh();
      graph.fit();            // optional: zoom to fit
      graph.center(true, true); // optional: center view
      console.log('✅ Graph rendered successfully.');
    } finally {
      graph.getModel().endUpdate();
    }
    
  };
  
  
  

  return (
    <>
      <Script src="https://unpkg.com/mxgraph/javascript/mxClient.min.js" strategy="beforeInteractive" />
      <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Yash Process Map Viewer</h1>
        <div
          ref={containerRef}
          className="w-full h-[80vh] border border-gray-300 shadow-md bg-white"
        ></div>
      </main>
    </>
  );
}
