"use client";

import React, { useState, useEffect } from "react";
import { getApiUrl, getAuthHeaders } from "../api";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

const GROQ_MODELS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Best — Recommended)" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Fastest)" },
  { value: "gemma2-9b-it", label: "Gemma 2 9B IT (Google)" },
  { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B 32K (Long Context)" },
  { value: "llama3-70b-8192", label: "Llama 3 70B 8K" },
  { value: "llama3-8b-8192", label: "Llama 3 8B 8K" },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Custom API overrides
  const [apiEndpoint, setApiEndpoint] = useState("https://rag-data-analyser.onrender.com");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");
  const [huggingfaceKey, setHuggingfaceKey] = useState("");

  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    // Load local storage overrides if present
    const savedEndpoint = localStorage.getItem("platform_api_endpoint");
    if (savedEndpoint) setApiEndpoint(savedEndpoint);

    const savedGroqKey = localStorage.getItem("user_groq_api_key");
    if (savedGroqKey) setGroqApiKey(savedGroqKey);

    const savedGroqModel = localStorage.getItem("user_groq_model");
    if (savedGroqModel) setGroqModel(savedGroqModel);

    const savedHfKey = localStorage.getItem("user_huggingface_key");
    if (savedHfKey) setHuggingfaceKey(savedHfKey);

    // Fetch user profile from backend
    const fetchProfile = async () => {
      try {
        const response = await fetch(getApiUrl("/api/v1/auth/me"), {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
    };

    fetchProfile();
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("platform_api_endpoint", apiEndpoint.trim());
      localStorage.setItem("user_groq_api_key", groqApiKey.trim());
      localStorage.setItem("user_groq_model", groqModel.trim());
      localStorage.setItem("user_huggingface_key", huggingfaceKey.trim());
      setStatusMsg("SUCCESS: Preferences saved. Note: API keys are stored in browser only — they are not sent to the server.");
    } catch (err) {
      setStatusMsg("ERROR: Failed to save custom preferences.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    setStatusMsg("SUCCESS: Session cleared. Redirecting...");
    setTimeout(() => {
      window.location.href = "/";
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-lg bg-canvas text-ink">
      
      {/* Title block */}
      <div>
        <span className="text-caption text-brand-accent uppercase font-bold tracking-widest block mb-1">
          Workspace // Settings Registry
        </span>
        <h1 className="text-display-sm md:text-display-md text-ink font-cal m-0">
          Platform Configuration
        </h1>
        <p className="text-body-md text-muted max-w-2xl mt-xs leading-relaxed">
          Configure the Groq LLM model and embedding API keys used during chat and RAG analysis runs.
        </p>
      </div>

      {/* Groq Info Banner */}
      <div className="bg-surface-card border border-hairline rounded-lg p-md flex items-start gap-3">
        <div className="w-8 h-8 bg-ink rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-white" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <div>
          <span className="text-caption text-ink font-bold block mb-0.5">Using Groq Playground API</span>
          <p className="text-caption text-muted m-0 leading-relaxed">
            This platform uses <strong className="text-ink">Groq's free-tier API</strong> for LLM chat completions.
            Get your free API key at{" "}
            <a href="https://console.groq.com" target="_blank" rel="noopener" className="text-brand-accent font-semibold hover:underline no-underline">
              console.groq.com
            </a>
            . Groq keys start with <code className="font-mono bg-canvas px-1 py-0.5 rounded-sm border border-hairline">gsk_</code>.
            For semantic vector search, optionally add a free{" "}
            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener" className="text-brand-accent font-semibold hover:underline no-underline">
              HuggingFace token
            </a>{" "}
            — otherwise the local hash-based fallback is used.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg items-start">
        
        {/* Left Column: Settings Configuration Override Form (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-md">
          <div className="border border-hairline p-xl bg-canvas flex flex-col gap-md rounded-lg shadow-subtle">
            
            <span className="text-caption text-ink font-bold border-b border-hairline-soft pb-2 block">
              CLIENT-SIDE CONFIG OVERRIDES
            </span>

            {statusMsg && (
              <div className={`p-sm border text-caption rounded-md ${
                statusMsg.includes("ERROR") 
                  ? "bg-red-50 border-error text-error" 
                  : "bg-green-50 border-success text-success"
              }`}>
                <span className="font-bold uppercase tracking-wider block mb-0.5">
                  {statusMsg.includes("ERROR") ? "Config Error" : "System Log"}
                </span>
                <p className="m-0 leading-relaxed">{statusMsg}</p>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="flex flex-col gap-md">
              
              {/* API Endpoint */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-ink font-bold uppercase tracking-wide">
                  Backend API Base Endpoint
                </label>
                <input
                  type="url"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://rag-data-analyser.onrender.com"
                  className="w-full bg-canvas text-ink border border-hairline rounded-md px-3 py-2.5 text-caption focus:border-ink outline-none"
                  required
                />
              </div>

              {/* Groq API Key */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-ink font-bold uppercase tracking-wide">
                  Groq API Key
                </label>
                <input
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_................................"
                  className="w-full bg-canvas text-ink border border-hairline rounded-md px-3 py-2.5 text-caption focus:border-ink outline-none"
                />
                <span className="text-[11px] text-muted leading-relaxed">
                  Get a free key at{" "}
                  <a href="https://console.groq.com" target="_blank" rel="noopener" className="text-brand-accent hover:underline no-underline font-semibold">
                    console.groq.com
                  </a>
                  . Note: This is stored in browser localStorage only — configure in <code className="font-mono">.env</code> for server-side use.
                </span>
              </div>

              {/* Groq Model Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-ink font-bold uppercase tracking-wide">
                  Groq Model
                </label>
                <select
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                  className="w-full bg-canvas text-ink border border-hairline px-3 py-2.5 text-caption rounded-md focus:border-ink outline-none"
                >
                  {GROQ_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted">
                  All models are available on the Groq free tier. <strong>llama-3.3-70b-versatile</strong> gives best results.
                </span>
              </div>

              {/* HuggingFace Key */}
              <div className="flex flex-col gap-1.5">
                <label className="text-caption text-ink font-bold uppercase tracking-wide">
                  HuggingFace API Token (Optional — for semantic embeddings)
                </label>
                <input
                  type="password"
                  value={huggingfaceKey}
                  onChange={(e) => setHuggingfaceKey(e.target.value)}
                  placeholder="hf_................................"
                  className="w-full bg-canvas text-ink border border-hairline rounded-md px-3 py-2.5 text-caption focus:border-ink outline-none"
                />
                <span className="text-[11px] text-muted leading-relaxed">
                  Groq has no embeddings endpoint. A free HuggingFace token enables semantic vector search (sentence-transformers/all-MiniLM-L6-v2). Without it, documents are indexed using a local hash-based fallback — search still works but is less semantically accurate.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-sm pt-2">
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Settings Override
                </button>
              </div>

            </form>
          </div>

          {/* Groq Models Reference Card */}
          <div className="border border-hairline p-xl bg-canvas flex flex-col gap-md rounded-lg shadow-subtle">
            <span className="text-caption text-ink font-bold border-b border-hairline-soft pb-2 block">
              AVAILABLE GROQ MODELS (FREE TIER)
            </span>
            <div className="flex flex-col divide-y divide-hairline-soft">
              {GROQ_MODELS.map((m) => (
                <div key={m.value} className="py-2.5 flex justify-between items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink font-semibold">{m.label.split(" (")[0]}</span>
                    <code className="font-mono text-[11px] text-muted">{m.value}</code>
                  </div>
                  {m.value === groqModel && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-ink text-white px-2 py-0.5 rounded-pill">
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Profile details & Status (1/3 width) */}
        <div className="lg:col-span-1 flex flex-col gap-md">
          <div className="border border-hairline p-xl bg-canvas flex flex-col gap-md rounded-lg shadow-subtle">
            
            <span className="text-caption text-ink font-bold border-b border-hairline-soft pb-2 block">
              LOCAL PLAYGROUND PROFILE
            </span>

            <div className="text-caption text-muted flex flex-col gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block font-semibold">Workspace Email:</span>
                <strong className="text-ink text-body-sm font-semibold block">{profile?.email || "dev-user@analystai.local"}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block font-semibold">User Identity:</span>
                <strong className="text-ink block font-semibold">{profile?.full_name || "Development User"}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block font-semibold">Access Level:</span>
                <strong className="text-ink uppercase block font-semibold">{profile?.role || "admin"}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted block font-semibold">Environment Authority:</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 border border-success/30 rounded-md text-[10px] text-success font-semibold w-max mt-1">
                  <span className="h-1.5 w-1.5 bg-success rounded-full"></span>
                  Active Local Node
                </span>
              </div>

              <div className="border-t border-hairline-soft pt-4 mt-2">
                <p className="text-[11px] text-muted leading-relaxed m-0">
                  This console is operating in local workspace mode. All databases, models, and index pipelines are running within your container cluster with administrative privileges.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
