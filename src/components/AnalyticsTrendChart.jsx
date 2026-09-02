// src/components/AnalyticsTrendChart.jsx
//
// Pure hand-rolled SVG bar chart - no charting library, matching this
// app's existing ExpenseDonutChart.jsx convention (a real, computed chart,
// not a decorative placeholder). Each day gets two bars sharing one
// x-slot: a low-opacity background bar sized to `total` (items dated that
// day) and a solid foreground bar sized to `completed` - the same
// "real, unfilled track behind the filled value" idea ExpenseDonutChart
// already uses for its ring, applied to a bar per day instead of a
// segment per category.
//
// `variant="sparkline"` is a small, fixed-size, label-free chart for the
// AI feed cards. `variant="full"` is a larger, responsive chart (viewBox
// + width:100%) with every-5th-day date labels, for the drill-down modal.

const parseDayLabel = (dateStr) => {
    const parts = dateStr.split('-');
    return `${parts[1]}/${parts[2]}`;
};

const AnalyticsTrendChart = ({ data, color = 'var(--primary)', variant = 'sparkline' }) => {
    if (!data || data.length === 0) return null;

    const isFull = variant === 'full';
    const width = isFull ? 320 : 90;
    const height = isFull ? 110 : 26;
    const labelSpace = isFull ? 16 : 0;
    const chartHeight = height - labelSpace;
    const barGap = isFull ? 3 : 1.5;
    const barWidth = (width - barGap * (data.length - 1)) / data.length;
    const maxTotal = Math.max(1, ...data.map((d) => d.total));

    return (
        <svg
            width={isFull ? '100%' : width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            style={{ display: 'block', overflow: 'visible' }}
        >
            {data.map((d, idx) => {
                const x = idx * (barWidth + barGap);
                const totalH = (d.total / maxTotal) * chartHeight;
                const completedH = (d.completed / maxTotal) * chartHeight;
                const showLabel = isFull && (idx % 5 === 0 || idx === data.length - 1);
                return (
                    <g key={d.date}>
                        {d.total > 0 && (
                            <rect
                                x={x} y={chartHeight - totalH} width={barWidth} height={Math.max(1, totalH)}
                                fill={color} opacity="0.18" rx={isFull ? 1.5 : 0.5}
                            />
                        )}
                        {d.completed > 0 && (
                            <rect
                                x={x} y={chartHeight - completedH} width={barWidth} height={Math.max(1, completedH)}
                                fill={color} rx={isFull ? 1.5 : 0.5}
                            />
                        )}
                        {showLabel && (
                            <text
                                x={x + barWidth / 2} y={height - 3} textAnchor="middle"
                                fontSize="8" fill="var(--text-muted)"
                            >
                                {parseDayLabel(d.date)}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

export default AnalyticsTrendChart;
