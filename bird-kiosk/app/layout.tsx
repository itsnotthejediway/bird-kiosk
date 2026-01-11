import "./globals.css";

export const metadata = { title: "Bird Kiosk" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
