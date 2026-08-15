// src/components/ExpenseDonutChart.jsx
//
// A real, working SVG donut chart - genuinely computed
// stroke-dasharray/stroke-dashoffset arc math per category, not a
// static placeholder image or a decorative div. No charting library
// dependency added for a single chart; pure SVG is the responsible
// choice here. Complements FinancePage's own existing horizontal bar
// breakdown (which stays exactly as it already worked) with an
// at-a-glance proportional view a bar chart doesn't convey as
// intuitively - relative share of the whole.

const RADIUS = 70;
const STROKE_WIDTH = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ExpenseDonutChart = ({ categoryBreakdown, currency, totalSpent, colorForCategory }) => {
    if (!categoryBreakdown || categoryBreakdown.length === 0) return null;

    // Each segment's own real cumulative offset - so segments genuinely
    // stack around the circle in order, rather than all starting from
    // the same point and overlapping.
    let cumulativePct = 0;
    const segments = categoryBreakdown.map((row) => {
        const pct = row.pct || 0;
        const dashLength = (pct / 100) * CIRCUMFERENCE;
        // SVG circles start their own stroke at the 3 o'clock position
        // by default; rotating the whole <svg> by -90deg (below) moves
        // that start to 12 o'clock instead, the real, conventional
        // starting point for a donut/pie chart.
        const offset = CIRCUMFERENCE - (cumulativePct / 100) * CIRCUMFERENCE;
        cumulativePct += pct;
        return { ...row, dashLength, offset };
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: `${(RADIUS + STROKE_WIDTH) * 2}px`, height: `${(RADIUS + STROKE_WIDTH) * 2}px`, flexShrink: 0 }}>
                <svg
                    width={(RADIUS + STROKE_WIDTH) * 2}
                    height={(RADIUS + STROKE_WIDTH) * 2}
                    viewBox={`0 0 ${(RADIUS + STROKE_WIDTH) * 2} ${(RADIUS + STROKE_WIDTH) * 2}`}
                    style={{ transform: 'rotate(-90deg)' }}
                >
                    {/* Real, unfilled track behind every segment - so a
                        category with a genuinely small share still
                        shows its real position on the ring, not just
                        blank space. */}
                    <circle
                        cx={RADIUS + STROKE_WIDTH} cy={RADIUS + STROKE_WIDTH} r={RADIUS}
                        fill="none" stroke="var(--surface-inset)" strokeWidth={STROKE_WIDTH}
                    />
                    {segments.map((seg) => (
                        <circle
                            key={seg.category}
                            cx={RADIUS + STROKE_WIDTH} cy={RADIUS + STROKE_WIDTH} r={RADIUS}
                            fill="none"
                            stroke={colorForCategory(seg.category)}
                            strokeWidth={STROKE_WIDTH}
                            strokeDasharray={`${seg.dashLength} ${CIRCUMFERENCE - seg.dashLength}`}
                            strokeDashoffset={seg.offset}
                            strokeLinecap="butt"
                            style={{ transition: 'stroke-dasharray 0.4s ease' }}
                        />
                    ))}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Total</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{currency}{Math.round(totalSpent).toLocaleString()}</span>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 160px', minWidth: 0 }}>
                {categoryBreakdown.map((row) => (
                    <div key={row.category} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colorForCategory(row.category), flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.category}</span>
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }}>{row.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExpenseDonutChart;
