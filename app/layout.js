import "./globals.css"

export const metadata = {
  title: "Process Map Viewer",
  description: "Professional process map visualization tool with interactive features",
  keywords: "process map, diagram viewer, business process, workflow visualization",
  authors: [{ name: "Process Map Team" }],
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased bg-gray-50">{children}</body>
    </html>
  )
}
