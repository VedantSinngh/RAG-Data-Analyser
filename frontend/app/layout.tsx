import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnalystAI - Unified Data Analyst Workspace",
  description: "Automated RAG, profiling, forecasting, and reporting workstation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%23181d26%22/><circle cx=%2250%22 cy=%2250%22 r=%2220%22 fill=%22white%22/></svg>"/>
      </head>
      <body className="antialiased min-h-screen bg-canvas text-body font-sans flex flex-col">
        
        {/* Airtable Top Nav (64px white bar, horizontal nav) */}
        <header className="w-full h-16 border-b border-hairline bg-canvas sticky top-0 z-50 flex items-center">
          <div className="max-w-[1280px] w-full mx-auto px-lg flex justify-between items-center">
            
            {/* Logo Wordmark */}
            <div className="flex items-center gap-2 select-none">
              <a href="/" className="flex items-end gap-1 no-underline text-ink hover:opacity-90">
                <span className="font-cal text-lg font-bold tracking-tight lowercase">analystai</span>
                <span className="h-2 w-2 bg-ink rounded-full mb-1"></span>
              </a>
            </div>

            {/* Main Navigation links - Simplified & Consolidated */}
            <nav className="hidden md:flex items-center gap-md">
              <a href="/" className="text-body-md text-ink font-semibold no-underline hover:text-ink/80 transition-colors">
                Workspace Dashboard
              </a>
              <a href="https://rag-data-analyser.onrender.com/docs" target="_blank" rel="noopener noreferrer" className="text-body-md text-muted no-underline hover:text-ink transition-colors">
                API Sandbox
              </a>
              <a href="/settings" className="text-body-md text-muted no-underline hover:text-ink transition-colors">
                Workspace Settings
              </a>
            </nav>

            {/* Right Status Badge */}
            <div className="flex items-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-soft border border-hairline rounded-pill text-caption text-ink font-semibold">
                <span className="h-1.5 w-1.5 bg-brand-accent rounded-full"></span>
                Local Node Active
              </span>
            </div>

          </div>
        </header>

        {/* Unified Subheader switcher */}
        <div className="w-full border-b border-hairline bg-surface-soft py-3 flex justify-center text-center">
          <span className="text-caption text-muted font-bold tracking-widest uppercase">
            Platform Workspace // Multi-Agent Data Analyst Workstation
          </span>
        </div>

        {/* Core Main Content Area */}
        <main className="flex-grow bg-canvas">
          <div className="max-w-[1280px] mx-auto px-lg py-xl">
            {children}
          </div>
        </main>

        {/* Airtable Editorial Footer (Light surface canvas, 6 columns) */}
        <footer className="bg-canvas border-t border-hairline py-section px-lg">
          <div className="max-w-[1280px] mx-auto flex flex-col gap-xl">
            
            {/* 6-Column Grid Layout */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-lg">
              
              {/* Brand Col (Spans 2 on desktop) */}
              <div className="col-span-2 flex flex-col gap-md">
                <a href="/" className="flex items-end gap-1 no-underline text-ink hover:opacity-90 w-max">
                  <span className="font-cal text-xl font-bold tracking-tight lowercase">analystai</span>
                  <span className="h-2.5 w-2.5 bg-ink rounded-full mb-1"></span>
                </a>
                <p className="text-body-md text-muted leading-relaxed max-w-sm">
                  Quietly editorial RAG data workspace. Powered by local embeddings, isolated worker containers, and custom AI agent execution logs.
                </p>
              </div>

              {/* Col 2: Platform */}
              <div className="flex flex-col gap-sm">
                <span className="text-ink text-caption font-bold uppercase tracking-wider">Platform</span>
                <ul className="list-none p-0 m-0 flex flex-col gap-xs text-body-md">
                  <li><a href="/" className="text-muted hover:text-ink no-underline transition-colors">Workspace Console</a></li>
                  <li><a href="https://rag-data-analyser.onrender.com/docs" target="_blank" className="text-muted hover:text-ink no-underline transition-colors">Swagger API</a></li>
                  <li><a href="/settings" className="text-muted hover:text-ink no-underline transition-colors">Configuration</a></li>
                </ul>
              </div>

              {/* Col 3: Solutions */}
              <div className="flex flex-col gap-sm">
                <span className="text-ink text-caption font-bold uppercase tracking-wider">Solutions</span>
                <ul className="list-none p-0 m-0 flex flex-col gap-xs text-body-md">
                  <li><a href="/" className="text-muted hover:text-ink no-underline transition-colors">Tabular Profiler</a></li>
                  <li><a href="/" className="text-muted hover:text-ink no-underline transition-colors">Time Series Forecasting</a></li>
                  <li><a href="/" className="text-muted hover:text-ink no-underline transition-colors">Conversational RAG</a></li>
                </ul>
              </div>

              {/* Col 4: Resources */}
              <div className="flex flex-col gap-sm">
                <span className="text-ink text-caption font-bold uppercase tracking-wider">Resources</span>
                <ul className="list-none p-0 m-0 flex flex-col gap-xs text-body-md">
                  <li><a href="https://rag-data-analyser.onrender.com/api/v1/health" target="_blank" className="text-muted hover:text-ink no-underline transition-colors">API Node Health</a></li>
                  <li><a href="https://console.groq.com" target="_blank" className="text-muted hover:text-ink no-underline transition-colors">Groq Console</a></li>
                  <li><a href="https://huggingface.co" target="_blank" className="text-muted hover:text-ink no-underline transition-colors">HuggingFace Hub</a></li>
                </ul>
              </div>

              {/* Col 5: Company */}
              <div className="flex flex-col gap-sm">
                <span className="text-ink text-caption font-bold uppercase tracking-wider">Company</span>
                <ul className="list-none p-0 m-0 flex flex-col gap-xs text-body-md">
                  <li><a href="#" className="text-muted hover:text-ink no-underline transition-colors">About Us</a></li>
                  <li><a href="#" className="text-muted hover:text-ink no-underline transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="text-muted hover:text-ink no-underline transition-colors">Contact Support</a></li>
                </ul>
              </div>

            </div>

            {/* Lower Footer Bottom Row */}
            <div className="pt-lg border-t border-hairline flex flex-col sm:flex-row justify-between items-center gap-md text-caption text-muted">
              <span>
                Copyright &copy; 2026 AnalystAI Workspace. All rights reserved.
              </span>
              <div className="flex gap-lg">
                <a href="#" className="text-muted hover:text-ink no-underline transition-colors font-semibold">System Settings</a>
                <a href="#" className="text-muted hover:text-ink no-underline transition-colors font-semibold">User Privacy</a>
              </div>
            </div>

          </div>
        </footer>

      </body>
    </html>
  );
}
