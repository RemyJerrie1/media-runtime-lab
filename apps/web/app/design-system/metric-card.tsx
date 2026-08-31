type MetricCardProps = { label: string; value: string; tone?: 'default' | 'accent' | 'success' };

export function MetricCard({ label, value, tone = 'default' }: MetricCardProps) {
  return (
    <div className="metric-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
