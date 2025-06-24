import './globals.css';

export const metadata = {
  title: 'Process Map Viewer',
  description: 'Professional process map visualization tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}