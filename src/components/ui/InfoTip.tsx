import React, { useId, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTipProps {
  text: string;
  label?: string;
}

export const InfoTip: React.FC<InfoTipProps> = ({ text, label }) => {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ? `About ${label}` : 'More information'}
        aria-describedby={id}
        onClick={() => setOpen((previous) => !previous)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-500 transition-colors hover:text-ink-200 focus-visible:text-ink-200"
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-[95] mb-2 w-60 -translate-x-1/2 rounded-lg border border-white/[0.12] bg-space-800 px-3 py-2 text-left text-[11px] font-normal leading-4 text-ink-200 shadow-xl transition-opacity ${
          open ? 'opacity-100' : 'opacity-0'
        } group-hover:opacity-100`}
        onMouseEnter={() => setOpen(true)}
      >
        {text}
      </span>
    </span>
  );
};

export const Term: React.FC<{ children: React.ReactNode; tip: string }> = ({ children, tip }) => (
  <span className="group relative inline-flex items-center">
    {children}
    <InfoTip text={tip} label={typeof children === 'string' ? children : undefined} />
  </span>
);
