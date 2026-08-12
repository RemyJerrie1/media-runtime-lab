type ProgressBarProps = { label: string; value: number; tone?: 'accent' | 'success' | 'warning' };

export function ProgressBar({ label, value, tone = 'accent' }: ProgressBarProps) {
  const boundedValue = Math.min(100, Math.max(0, value));
  return <div className="ds-progress" data-tone={tone}>
    <div className="ds-progress__meta"><span>{label}</span><strong>{boundedValue}%</strong></div>
    <div className="ds-progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={boundedValue}>
      <i className="ds-progress__value" style={{ width: `${boundedValue}%` }} />
    </div>
  </div>;
}