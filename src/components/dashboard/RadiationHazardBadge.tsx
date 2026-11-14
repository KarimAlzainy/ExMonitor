import React from 'react';
import { Radiation } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { InfoTip } from '../ui/InfoTip';

export const RadiationHazardBadge: React.FC = () => {
  const { vitals } = useTelemetry();
  const { radiationDoseRate, cumulativeRadiation } = vitals;

  const isCritical = radiationDoseRate >= 1.0;
  const isCaution = radiationDoseRate >= 0.3 && !isCritical;

  const dosePercent = Math.min(100, (radiationDoseRate / 1.0) * 100);
  const cumulativePercent = Math.min(100, (cumulativeRadiation / 25) * 100);

  const tone = isCritical
    ? { dot: 'bg-critical', text: 'text-critical', bar: 'bg-critical' }
    : isCaution
      ? { dot: 'bg-caution', text: 'text-caution', bar: 'bg-caution' }
      : { dot: 'bg-positive', text: 'text-positive', bar: 'bg-positive' };

  const statusLabel = isCritical ? 'Above the limit' : isCaution ? 'Raised' : 'Normal';

  return (
    <section className="flex h-full flex-col rounded-xl border border-white/[0.08] bg-space-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radiation className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
            <h2 className="flex items-center text-[15px] font-medium text-ink-100">
              Radiation
              <InfoTip
                text="Dose rate is the radiation arriving right now. Total dose adds up over the mission. The caution line is 0.30 and the critical line is 1.00 millisieverts per hour."
                label="Radiation"
              />
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">Suit dosimeter · NASA MR092L reference</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center text-[11px] text-ink-400">
              Dose rate
              <InfoTip text="How much radiation reaches the body each hour. Milli-sieverts (mSv) are the unit." />
            </span>
            <span className="text-[11px] text-ink-500">{Math.round(dosePercent)}% of the limit</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className={`text-2xl font-medium leading-none tabular-nums ${isCritical ? 'text-critical' : isCaution ? 'text-caution' : 'text-ink-100'}`}>
              {radiationDoseRate.toFixed(2)}
            </span>
            <span className="text-xs text-ink-400">mSv/hr</span>
          </div>
          <div className="relative mt-3 h-1.5 rounded-full bg-space-800">
            <div
              className={`h-full rounded-full ${tone.bar}`}
              style={{ width: `${Math.max(2, dosePercent)}%` }}
            />
            <span className="absolute left-[30%] top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/15" />
          </div>
          <div className="relative mt-1 h-4">
            <span className="absolute left-0 font-mono text-[10px] text-ink-500">0</span>
            <span className="absolute left-[30%] -translate-x-1/2 font-mono text-[10px] text-ink-500">0.30</span>
            <span className="absolute right-0 font-mono text-[10px] text-ink-500">1.00</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center text-[11px] text-ink-400">
              Total mission dose
              <InfoTip text="The running total since the mission started. The 30-day guidance limit shown here is 25 milli-sieverts." />
            </span>
            <span className="text-[11px] text-ink-500">30-day guide 25 mSv</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-medium leading-none tabular-nums text-ink-100">
              {cumulativeRadiation.toFixed(2)}
            </span>
            <span className="text-xs text-ink-400">mSv</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-space-800">
            <div
              className="h-full rounded-full bg-signal/70"
              style={{ width: `${Math.max(2, cumulativePercent)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-500">
            <span>0</span>
            <span>25 mSv</span>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-white/[0.06] pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-ink-500">Where to shelter</p>
            <p className={`mt-1 text-[13px] font-medium ${isCritical ? 'text-critical' : 'text-ink-200'}`}>
              {isCritical ? 'Storm shelter' : 'Habitat'}
            </p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end text-[11px] text-ink-500">
              Water shielding
              <InfoTip text="A layer of water absorbs radiation. The thicker the layer, the safer the shelter." />
            </p>
            <p className="mt-1 text-[13px] font-medium tabular-nums text-ink-200">14 g/cm²</p>
          </div>
        </div>
      </div>
    </section>
  );
};
