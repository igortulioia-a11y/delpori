import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Delpori - Gestão de Delivery",
  description: "Sistema de gestão de delivery com IA no WhatsApp",
  // Icons: arquivos de convencao em src/app/ (favicon.ico, icon.svg, apple-icon.png)
  // sao gerenciados automaticamente pelo Next.js App Router.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
