import './globals.css';

export const metadata = {
  title: 'YashProcessMapViewer',
  description: 'View and render draw.io diagrams in Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
