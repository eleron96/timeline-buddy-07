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
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { GripVertical, Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/classNames';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/ui/chart';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';
import {
  DashboardStatusFilter,
  DashboardMilestone,
  DashboardOption,
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
  milestones?: DashboardMilestone[];
  projects?: DashboardOption[];
  onEdit?: () => void;
}

export const DashboardWidgetCard: React.FC<DashboardWidgetCardProps> = ({
  widget,
  data,
  loading,
  error,
  editing,
  milestones = [],
  projects = [],
  onEdit,
}) => {
  const { startDate: taskStartDate, endDate: taskEndDate } = getPeriodRange(widget.period);
  const taskPeriodLabel = `${taskStartDate} to ${taskEndDate}`;
  const size = widget.size ?? (widget.type === 'kpi' ? 'small' : 'medium');
  const isSmall = size === 'small';
  const showPeriod = size !== 'small';
  const showFilter = size === 'large';
  const showAxes = size !== 'small';
  const palette = widget.type !== 'kpi'
    ? getBarPalette(widget.barPalette)
    : ['#94A3B8'];
  const paletteColors = palette.length ? palette : ['#94A3B8'];
  const isChart = widget.type === 'bar' || widget.type === 'line' || widget.type === 'area' || widget.type === 'pie';
  const milestoneView = widget.milestoneView
    ?? (widget.type === 'milestone_calendar' ? 'calendar' : 'list');
  const milestoneCalendarMode = widget.milestoneCalendarMode ?? 'month';
  const isMilestoneWidget = widget.type === 'milestone' || widget.type === 'milestone_calendar';
  const isMilestoneList = isMilestoneWidget && milestoneView === 'list';
  const isMilestoneCalendar = isMilestoneWidget && milestoneView === 'calendar';
  const legendItems = isChart ? (data?.series ?? []) : [];
  const maxLegendItems = size === 'small' ? 2 : size === 'medium' ? 6 : 8;
  const visibleLegendItems = legendItems.slice(0, maxLegendItems);
  const hiddenLegendItems = legendItems.slice(maxLegendItems);
  const hiddenLegendCount = hiddenLegendItems.length;
  const showLegend = isChart && legendItems.length > 0;
  const contentGapClass = isSmall ? 'gap-1.5' : 'gap-2';
  const calendarGapClass = isMilestoneCalendar && isSmall ? 'gap-1' : contentGapClass;
  const cardPaddingClass = isSmall ? 'p-3' : 'p-4';
  const contentPaddingClass = isMilestoneCalendar && isSmall ? 'pt-2' : 'pt-3';
  const chartMinHeightClass = isSmall ? 'min-h-[64px]' : 'min-h-[180px]';
  const pieMinHeightClass = isSmall ? 'min-h-[72px]' : 'min-h-[200px]';
  const kpiValueClass = isSmall ? 'text-3xl' : 'text-4xl';
  const pieInnerRadius = size === 'small' ? '45%' : '55%';
  const pieOuterRadius = size === 'small' ? '75%' : '90%';
  const timeSeries = data?.timeSeries ?? [];
  const seriesKeys = data?.seriesKeys ?? [];
  const hasTimeSeries = timeSeries.length > 0 && seriesKeys.length > 0;
  const legendList = showLegend ? (
    <div
      className={cn(
        'text-xs text-muted-foreground',
        size === 'small' ? 'flex w-fit flex-col items-start gap-1' : 'flex flex-wrap gap-x-4 gap-y-1',
      )}
    >
      {visibleLegendItems.map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          className={cn(
            'flex items-center gap-2',
            size === 'small' ? 'max-w-full' : 'max-w-[220px]',
          )}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: paletteColors[index % paletteColors.length] }}
          />
          <span className={cn('truncate', size === 'small' ? 'max-w-[120px]' : 'max-w-[160px]')}>
            {item.name}
          </span>
          <span className="font-medium text-foreground">{item.value.toLocaleString()}</span>
        </div>
      ))}
      {hiddenLegendCount > 0 && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                +{hiddenLegendCount} more
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs p-2 text-xs">
              <div className="grid gap-1">
                {hiddenLegendItems.map((item, index) => {
                  const paletteIndex = index + maxLegendItems;
                  return (
                    <div key={`${item.name}-${paletteIndex}`} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: paletteColors[paletteIndex % paletteColors.length] }}
                      />
                      <span className="truncate">{item.name}</span>
                      <span className="font-medium text-foreground">
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  ) : null;

  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const projectColorById = new Map(
    projects.map((project) => [project.id, project.color ?? '#94A3B8']),
  );
  const now = new Date();
  const milestoneRangeStart = startOfDay(now);
  const milestoneRangeEnd = endOfDay(
    widget.period === 'day'
      ? now
      : widget.period === 'week'
        ? addWeeks(now, 1)
        : addMonths(now, 1),
  );
  const milestonePeriodLabel = `${format(milestoneRangeStart, 'yyyy-MM-dd')} to ${format(milestoneRangeEnd, 'yyyy-MM-dd')}`;
  const periodLabel = isMilestoneList ? milestonePeriodLabel : taskPeriodLabel;
  const milestonesInRange = milestones
    .filter((milestone) => isWithinInterval(parseISO(milestone.date), {
      start: milestoneRangeStart,
      end: milestoneRangeEnd,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const milestoneLimit = size === 'small' ? 2 : size === 'medium' ? 4 : 6;
  const visibleMilestones = milestonesInRange.slice(0, milestoneLimit);
  const hiddenMilestones = milestonesInRange.slice(milestoneLimit);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const calendarStart = milestoneCalendarMode === 'month'
    ? startOfWeek(monthStart, { weekStartsOn: 1 })
    : startOfWeek(now, { weekStartsOn: 1 });
  const calendarEnd = milestoneCalendarMode === 'month'
    ? endOfWeek(monthEnd, { weekStartsOn: 1 })
    : endOfWeek(addWeeks(calendarStart, 4), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => (
    format(addDays(calendarStart, index), isSmall ? 'EEEEE' : 'EE')
  ));
  const calendarLabel = milestoneCalendarMode === 'month'
    ? format(monthStart, 'LLLL yyyy')
    : `${format(calendarStart, 'MMM d')} - ${format(calendarEnd, 'MMM d')}`;
  const milestonesByDate = milestones.reduce((map, milestone) => {
    const list = map.get(milestone.date) ?? [];
    list.push(milestone);
    map.set(milestone.date, list);
    return map;
  }, new Map<string, DashboardMilestone[]>());
  const milestonesInCalendar = milestones.filter((milestone) => (
    isWithinInterval(parseISO(milestone.date), { start: calendarStart, end: calendarEnd })
  ));

  return (
    <Card
      className={cn(
        'dashboard-widget-card h-full w-full min-h-0 flex flex-col overflow-hidden',
        cardPaddingClass,
        editing && 'ring-1 ring-muted',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-2', editing && 'dashboard-widget-handle cursor-move')}>
          {editing && <GripVertical className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">{widget.title}</span>
        </div>
        {editing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-40 transition-opacity hover:opacity-100"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className={cn('flex-1 min-h-0', contentPaddingClass)}>
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
            <div className={cn(kpiValueClass, 'font-semibold text-foreground')}>
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
          <div className={cn('flex h-full min-h-0 flex-col', contentGapClass)}>
            {data?.series.length ? (
              <ChartContainer
                config={{ value: { label: 'Tasks' } }}
                className={cn('flex-1 min-h-0', chartMinHeightClass)}
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
            {legendList}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && widget.type === 'line' && (
          <div className={cn('flex h-full min-h-0 flex-col', contentGapClass)}>
            {hasTimeSeries ? (
              <ChartContainer
                config={{}}
                className={cn('flex-1 min-h-0', chartMinHeightClass)}
                style={{ aspectRatio: 'auto' }}
              >
                <LineChart data={timeSeries}>
                  {showAxes && (
                    <XAxis
                      dataKey="date"
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
                  {seriesKeys.map((seriesKey, index) => (
                    <Line
                      key={seriesKey.key}
                      type="monotone"
                      dataKey={seriesKey.key}
                      name={seriesKey.label}
                      stroke={paletteColors[index % paletteColors.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            )}
            {legendList}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && widget.type === 'area' && (
          <div className={cn('flex h-full min-h-0 flex-col', contentGapClass)}>
            {hasTimeSeries ? (
              <ChartContainer
                config={{}}
                className={cn('flex-1 min-h-0', chartMinHeightClass)}
                style={{ aspectRatio: 'auto' }}
              >
                <AreaChart data={timeSeries}>
                  {showAxes && (
                    <XAxis
                      dataKey="date"
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
                  {seriesKeys.map((seriesKey, index) => (
                    <Area
                      key={seriesKey.key}
                      type="monotone"
                      dataKey={seriesKey.key}
                      name={seriesKey.label}
                      stroke={paletteColors[index % paletteColors.length]}
                      fill={paletteColors[index % paletteColors.length]}
                      fillOpacity={0.2}
                    />
                  ))}
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            )}
            {legendList}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && widget.type === 'pie' && (
          <div className={cn('flex h-full min-h-0 flex-col', contentGapClass)}>
            {data?.series.length ? (
              <ChartContainer
                config={{ value: { label: 'Tasks' } }}
                className={cn('flex-1 min-h-0', pieMinHeightClass)}
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
            {legendList}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
            {showFilter && (
              <div className="text-xs text-muted-foreground">
                Filter: {filterLabels[widget.statusFilter]}
              </div>
            )}
          </div>
        )}
        {!loading && !error && isMilestoneList && (
          <div className={cn('flex h-full min-h-0 flex-col', contentGapClass)}>
            {milestonesInRange.length ? (
              <div className="space-y-2 text-xs">
                {visibleMilestones.map((milestone) => {
                  const projectName = projectNameById.get(milestone.projectId);
                  return (
                    <div key={milestone.id} className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {milestone.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {projectName ?? 'No project'}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(milestone.date), 'MMM d')}
                      </div>
                    </div>
                  );
                })}
                {hiddenMilestones.length > 0 && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                        >
                          +{hiddenMilestones.length} more milestones
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs p-2 text-xs">
                        <div className="grid gap-1">
                          {hiddenMilestones.map((milestone) => (
                            <div key={milestone.id} className="flex items-center justify-between gap-3">
                              <span className="truncate">{milestone.title}</span>
                              <span className="text-muted-foreground">
                                {format(parseISO(milestone.date), 'MMM d')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No milestones
              </div>
            )}
            {showPeriod && <div className="text-xs text-muted-foreground">{periodLabel}</div>}
          </div>
        )}
        {!loading && !error && isMilestoneCalendar && (
          <TooltipProvider delayDuration={200}>
            <div className={cn('flex h-full min-h-0 flex-col', calendarGapClass)}>
              <div className={cn('flex items-center justify-between text-muted-foreground', isSmall ? 'text-[10px]' : 'text-xs')}>
                <span className={cn('truncate', isSmall && 'max-w-[120px]')}>{calendarLabel}</span>
                {!isSmall && <span>{milestonesInCalendar.length} milestones</span>}
              </div>
              <div className={cn('grid grid-cols-7', isSmall ? 'text-[9px]' : 'text-[10px]')}>
                {weekdayLabels.map((label) => (
                  <div key={label} className="text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>
              <div
                className={cn('grid grid-cols-7 flex-1 min-h-0', isSmall ? 'gap-0.5' : 'gap-1')}
                style={{ gridAutoRows: '1fr' }}
              >
                {calendarDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayMilestones = milestonesByDate.get(key) ?? [];
                  const dayColors = dayMilestones.map(
                    (milestone) => projectColorById.get(milestone.projectId) ?? '#94A3B8',
                  );
                  const maxDots = isSmall ? 2 : size === 'medium' ? 3 : 4;
                  const visibleColors = dayColors.slice(0, maxDots);
                  const moreCount = dayColors.length - visibleColors.length;
                  const isOutsideMonth = milestoneCalendarMode === 'month' && !isSameMonth(day, monthStart);
                  const dayCell = (
                    <div
                      className={cn(
                        'rounded-md border border-transparent leading-none',
                        isSmall ? 'p-0.5 text-[9px]' : 'p-1 text-[11px]',
                        isOutsideMonth && 'text-muted-foreground/50',
                        isToday(day) && 'border-primary text-primary',
                      )}
                    >
                      <div className={cn(isSmall ? 'text-[9px]' : 'text-[11px]')}>
                        {format(day, 'd')}
                      </div>
                      {dayMilestones.length > 0 && (
                        <div className={cn('flex items-center gap-1', isSmall ? 'mt-0.5' : 'mt-1')}>
                          {visibleColors.map((color, index) => (
                            <span
                              key={`${key}-dot-${index}`}
                              className={cn('rounded-full', isSmall ? 'h-1 w-1' : 'h-1.5 w-1.5')}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                          {moreCount > 0 && (
                            <span className="text-[9px] text-muted-foreground">+{moreCount}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );

                  if (dayMilestones.length === 0) {
                    return React.cloneElement(dayCell, { key });
                  }

                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        {dayCell}
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs p-2 text-xs">
                        <div className="grid gap-1">
                          {dayMilestones.map((milestone) => {
                            const projectName = projectNameById.get(milestone.projectId) ?? 'No project';
                            const projectColor = projectColorById.get(milestone.projectId) ?? '#94A3B8';
                            return (
                              <div key={milestone.id} className="flex items-start gap-2">
                                <span
                                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: projectColor }}
                                />
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-medium text-foreground">
                                    {milestone.title}
                                  </div>
                                  <div className="truncate text-[10px] text-muted-foreground">
                                    {projectName}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </TooltipProvider>
        )}
      </div>
    </Card>
  );
};
