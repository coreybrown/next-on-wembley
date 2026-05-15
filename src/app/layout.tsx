import type { Metadata } from "next";
import { Fraunces, Chivo, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
});

const chivo = Chivo({
  subsets: ["latin"],
  variable: "--font-chivo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Next on Wembley",
  description:
    "A weekly column of what to watch — for two readers, one couch.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const dataTheme =
    themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      suppressHydrationWarning
      className={`${fraunces.variable} ${chivo.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-svh bg-surface text-ink font-body">{children}</body>
    </html>
  );
}
