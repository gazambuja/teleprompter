import { type ChangeEvent, type ReactNode } from 'react';

interface SliderProps {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  display?: (value: number) => string;
  children?: ReactNode;
}

export function Slider({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  children
}: SliderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  const shown = display ? display(value) : `${value}${unit ? ` ${unit}` : ''}`;

  return (
    <label className="block group">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-paper-muted group-hover:text-paper-dim transition-colors duration-300 ease-premium">
          {label}
        </span>
        <span className="font-mono text-[11px] text-paper-dim tabular-nums">
          {shown}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        className="w-full"
      />
      {children}
    </label>
  );
}
