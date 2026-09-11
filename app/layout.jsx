import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

export const metadata = {
  title: "Outta the Units | Berkeley Housing Intelligence",
  description: "Private, property-specific intelligence for your next lease."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
