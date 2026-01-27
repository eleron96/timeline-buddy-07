import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/classNames';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/ui/chart';
import {
  DashboardStatusFilter,
  DashboardWidget,
  DashboardWidgetData,
} from '@/features/dashboard/types/dashboard';
import { getBarPalette, getPeriodRange } from '@/features/dashboard/lib/dashboardUtils';

const filterLabels: Record<DashboardStatusFilter, string> = {
  all: 'All statuses',
  active: 'Active',
  final: 'Closed',
  cancelled: 'Cancelled',
  custom: 'Custom',
};

interface DashboardWidgetCardProps {
  widget: DashboardWidget;
  data: DashboardWidgetData | null;
  loading: boolean;
  error: string | null;
  editing: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}

export const DashboardWidgetCard: React.FC<DashboardWidgetCardProps> = ({
  widget,
  data,
  loading,
  error,
  editing,
  onEdit,
  onRemove,
}) => {
  const { startDate, endDate } = getPeriodRange(widget.period);
  const periodLabel = `${startDate} to ${endDate}`;
  const size = widget.size ?? (widget.type === 'kpi' ? 'small' : 'medium');
  const showPeriod = size !== 'small';
  const showFilter = size === 'large';
  const showAxes = size !== 'small';
  const palette = widget.type === 'bar' || widget.type === 'pie'
    ? getBarPalette(widget.barPalette)
    : ['#94A3B8'];
  const paletteColors = palette.length ? palette : ['#94A3B8'];
  const isChart = widget.type !== 'kpi';
  const topSeries = isChart ? (data?.series ?? []).slice(0, 3) : [];
  const showCompactLabels = size === 'small' && topSeries.length > 0 && isChart;
  const pieInnerRadius = size === 'small' ? '45%' : '55%';
  const pieOuterRadius = size === 'small' ? '75%' : '90%';

  return (
    <Card
      className={cn(
        'dashboard-widget-card h-full w-full min-h-0 flex flex-col p-4 overflow-hidden',
        editing && 'ring-1 ring-muted',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-2', editing && 'dashboard-widget-handle cursor-move')}>
          {editing && <GripVertical className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">{widget.title}</span>
        </div>
        {editing && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 pt-3">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading data...
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && widget.type === 'kpi' && (
          <div className="flex h-full flex-col justify-center gap-2">
            <div className="text-4xl font-semibold text-foreground">
              {data?.total ?? 0}
            </div>
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && widget.type === 'bar' && (
          <div className="flex h-full min-h-0 flex-col gap-2">
            {data?.series.length ? (
              <ChartContainer
                config={{ value: { label: 'Tasks' } }}
                className={cn('flex-1 min-h-0', size === 'small' ? 'min-h-[96px]' : 'min-h-[180px]')}
                style={{ aspectRatio: 'auto' }}
              >
                <BarChart data={data.series}>
                  {showAxes && (
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={50}
                    />
                  )}
                  {showAxes && (
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                  )}
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {data.series.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={paletteColors[index % paletteColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            )}
            {showCompactLabels && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {topSeries.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: paletteColors[index % paletteColors.length] }}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && widget.type === 'line' && (
          <div className="flex h-full min-h-0 flex-col gap-2">
            {data?.series.length ? (
              <ChartContainer
                config={{ value: { label: 'Tasks', color: 'hsl(var(--primary))' } }}
                className={cn('flex-1 min-h-0', size === 'small' ? 'min-h-[96px]' : 'min-h-[180px]')}
                style={{ aspectRatio: 'auto' }}
              >
                <LineChart data={data.series}>
                  {showAxes && (
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={50}
                    />
                  )}
                  {showAxes && (
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                  )}
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            )}
            {showCompactLabels && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {topSeries.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.name}</span>
                    <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && widget.type === 'area' && (
          <div className="flex h-full min-h-0 flex-col gap-2">
            {data?.series.length ? (
              <ChartContainer
                config={{ value: { label: 'Tasks', color: 'hsl(var(--primary))' } }}
                className={cn('flex-1 min-h-0', size === 'small' ? 'min-h-[96px]' : 'min-h-[180px]')}
                style={{ aspectRatio: 'auto' }}
              >
                <AreaChart data={data.series}>
                  {showAxes && (
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={50}
                    />
                  )}
                  {showAxes && (
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                  )}
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    fill="var(--color-value)"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            )}
            {showCompactLabels && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {topSeries.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.name}</span>
                    <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && widget.type === 'pie' && (
          <div className="flex h-full min-h-0 flex-col gap-2">
            {data?.series.length ? (
              <ChartContainer
                config={{ value: { label: 'Tasks' } }}
                className={cn('flex-1 min-h-0', size === 'small' ? 'min-h-[140px]' : 'min-h-[200px]')}
                style={{ aspectRatio: 'auto' }}
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                  <Pie
                    data={data.series}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={pieInnerRadius}
                    outerRadius={pieOuterRadius}
                    paddingAngle={2}
                  >
                    {data.series.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={paletteColors[index % paletteColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            )}
            {showCompactLabels && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {topSeries.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: paletteColors[index % paletteColors.length] }}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
