import './globals.css';

export const metadata = {
  title: 'Command Center',
  description: 'Tu día, organizado.',
};

export const viewport = {
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}
