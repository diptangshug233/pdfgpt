import { Inter } from "next/font/google";
import "./globals.css";
import { cn, constructMetadata } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";

import "react-loading-skeleton/dist/skeleton.css";
import "simplebar-react/dist/simplebar.min.css";
import { Toaster } from "@/components/ui/toaster";
import { Viewport } from "next";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#FFF",
};

export const metadata = constructMetadata();

/**
 * The root layout component, which wraps the entire app with a basic HTML
 * structure, and includes some global UI elements like a navbar and a toaster.
 *
 * This component is used by Next.js to generate the HTML for each page, and is
 * used as the root component for every page in the app.
 *
 * @param {{ children: React.ReactNode }} props The props for the component.
 * @returns {JSX.Element} The root layout component.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <Providers>
        <body
          className={cn(
            "min-h-screen font-sans antialiased grainy",
            inter.className
          )}
        >
          <Toaster />
          <Navbar />
          {children}
        </body>
      </Providers>
    </html>
  );
}
