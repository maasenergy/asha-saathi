import React from 'react';
import { CloudOff } from 'lucide-react';

interface AiOfflineBannerProps {
  language: 'hi' | 'en';
  className?: string;
}

/**
 * Shown wherever Gemini was unavailable. Everything next to it comes only from the
 * deterministic rule + trend engines; no AI-style text is generated in its place.
 */
export const AiOfflineBanner: React.FC<AiOfflineBannerProps> = ({ language, className = '' }) => (
  <div
    role="status"
    className={`flex items-center gap-2 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl ${className}`}
  >
    <CloudOff className="w-4 h-4 text-slate-500 shrink-0" />
    <span>
      {language === 'hi'
        ? 'AI ऑफ़लाइन — केवल नियम-इंजन का परिणाम दिखाया जा रहा है'
        : 'AI offline — showing rule-engine result only'}
    </span>
  </div>
);
