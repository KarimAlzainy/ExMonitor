import React from 'react';
import { Radiation, Shield, ShieldAlert, AlertTriangle, Compass } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const RadiationHazardBadge: React.FC = () => {
  const { vitals } = useTelemetry();
  const { radiationDoseRate, cumulativeRadiation } = vitals;

  // NASA MR092L Thresholds
  const isCritical = radiationDoseRate >= 1.0;
  const isCaution = radiationDoseRate >= 0.3 && !isCritical;

  return (
    <div className="rounded-2xl bg-space-900 border border-space-700/60 p-4 sm:p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-space-800">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2 rounded-xl border ${
              isCritical
                ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                : isCaution
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-nasa-blue/20 text-nasa-cyan border-nasa-cyan/30'
            }`}
          >
            <Radiation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold tracking-wide text-slate-100 font-mono">
                NASA MR092L Radiation Dosimetry
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-800 text-slate-300 border border-space-700">
                SRAG Standard
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              In-Flight PIN Diode Active Dosimeter • Cosmic & Solar Flux
            </p>
          </div>
        </div>

        {/* Radiation Status Pill */}
        <div className="flex items-center space-x-2">
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium flex items-center space-x-1.5 ${
              isCritical
                ? 'bg-red-500/10 text-red-400 border-red-500/40 animate-pulse'
                : isCaution
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isCritical ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : isCaution ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            <span className="uppercase font-bold">
              {isCritical ? 'SPE STORM BREACH' : isCaution ? 'ELEVATED FLUX' : 'DOSE SAFE (NOMINAL)'}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
        {/* Instantaneous Rate */}
        <div className="bg-space-950 p-3 rounded-xl border border-space-800">
          <span className="text-xs text-slate-400 font-mono block">DOSE RATE (IONIZING)</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className={`text-2xl font-bold font-mono ${isCritical ? 'text-red-400' : isCaution ? 'text-amber-400' : 'text-slate-100'}`}>
              {radiationDoseRate.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">mSv/hr</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">
            Contingency ceiling: 1.00 mSv/hr
          </span>
        </div>

        {/* Cumulative Mission Dose */}
        <div className="bg-space-950 p-3 rounded-xl border border-space-800">
          <span className="text-xs text-slate-400 font-mono block">CUMULATIVE MISSION DOSE</span>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-bold font-mono text-nasa-cyan">
              {cumulativeRadiation.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">mSv total</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">
            NASA 30-Day limit: 25.0 mSv
          </span>
        </div>

        {/* Storm Shelter Vector */}
        <div className="bg-space-950 p-3 rounded-xl border border-space-800">
          <span className="text-xs text-slate-400 font-mono block">SHELTER DIRECTIVE</span>
          <div className="flex items-center space-x-2 mt-1">
            <Compass className="w-4 h-4 text-slate-400" />
            <span className={`text-sm font-bold font-mono ${isCritical ? 'text-red-400' : 'text-slate-200'}`}>
              {isCritical ? 'STORM BAY 4 (RETREAT)' : 'HABITAT GENERAL (SAFE)'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-1">
            SPE Water Wall Mass Factor: 14 g/cm²
          </span>
        </div>
      </div>

      {/* NASA 5 Hazards Checklist Footer */}
      <div className="pt-2 border-t border-space-800 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
        <span className="text-slate-300 font-medium">NASA 5 HAZARDS ALIGNMENT:</span>
        <span className="px-2 py-0.5 rounded bg-space-800/80 text-emerald-400 border border-emerald-500/20">
          ✓ 1. Space Radiation
        </span>
        <span className="px-2 py-0.5 rounded bg-space-800/80 text-emerald-400 border border-emerald-500/20">
          ✓ 2. Isolation (AI Doctor)
        </span>
        <span className="px-2 py-0.5 rounded bg-space-800/80 text-emerald-400 border border-emerald-500/20">
          ✓ 3. Distance from Earth (0ms Mesh)
        </span>
        <span className="px-2 py-0.5 rounded bg-space-800/80 text-emerald-400 border border-emerald-500/20">
          ✓ 4. Gravity Fields (ECG)
        </span>
        <span className="px-2 py-0.5 rounded bg-space-800/80 text-emerald-400 border border-emerald-500/20">
          ✓ 5. Hostile Environments (Suit LCVG)
        </span>
      </div>
    </div>
  );
};
