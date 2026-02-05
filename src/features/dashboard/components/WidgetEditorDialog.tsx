import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Checkbox } from '@/shared/ui/checkbox';
import { Switch } from '@/shared/ui/switch';
import {
  DashboardGroupBy,
  DashboardFilterField,
  DashboardFilterGroup,
  DashboardFilterOperator,
  DashboardFilterRule,
  DashboardOption,
  DashboardPeriod,
  DashboardStatus,
  DashboardStatusFilter,
  DashboardWidget,
  DashboardWidgetType,
  DashboardBarPalette,
  DashboardMilestoneView,
  DashboardMilestoneCalendarMode,
} from '@/features/dashboard/types/dashboard';
import { BAR_PALETTES, DEFAULT_BAR_PALETTE, createWidgetId } from '@/features/dashboard/lib/dashboardUtils';
import { formatStatusLabel } from '@/shared/lib/statusLabels';
import { formatProjectLabel } from '@/shared/lib/projectLabels';

interface WidgetEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: DashboardStatus[];
  projects: DashboardOption[];
  assignees: DashboardOption[];
  groups: DashboardOption[];
  initialWidget?: DashboardWidget | null;
  onSave: (widget: DashboardWidget) => void;
}

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const typeOptions: Array<{ value: DashboardWidgetType; label: string }> = [
  { value: 'kpi', label: 'KPI' },
  { value: 'bar', label: 'Bar chart' },
  { value: 'line', label: 'Line chart' },
  { value: 'area', label: 'Area chart' },
  { value: 'pie', label: 'Pie chart (Donut)' },
  { value: 'milestone', label: 'Milestones' },
];

const groupByOptions: Array<{ value: DashboardGroupBy; label: string }> = [
  { value: 'assignee', label: 'By user' },
  { value: 'status', label: 'By status' },
  { value: 'project', label: 'By project' },
];

const statusFilterOptions: Array<{ value: DashboardStatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'final', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'custom', label: 'Custom' },
];

const filterFieldOptions: Array<{ value: DashboardFilterField; label: string }> = [
  { value: 'assignee', label: 'User' },
  { value: 'group', label: 'Group' },
  { value: 'status', label: 'Status' },
  { value: 'project', label: 'Project' },
];

const UNASSIGNED_FILTER_VALUE = '__unassigned__';

const filterOperatorOptions: Array<{ value: DashboardFilterOperator; label: string }> = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
];

const groupMatchOptions: Array<{ value: DashboardFilterGroup['match']; label: string }> = [
  { value: 'and', label: 'Match all rules (AND)' },
  { value: 'or', label: 'Match any rule (OR)' },
];

const milestoneViewOptions: Array<{ value: DashboardMilestoneView; label: string }> = [
  { value: 'list', label: 'List' },
  { value: 'calendar', label: 'Calendar (month)' },
];

const milestoneCalendarModeOptions: Array<{ value: DashboardMilestoneCalendarMode; label: string }> = [
  { value: 'month', label: 'Current month' },
  { value: 'rolling', label: 'Month from current week' },
];

export const WidgetEditorDialog: React.FC<WidgetEditorDialogProps> = ({
  open,
  onOpenChange,
  statuses,
  projects,
  assignees,
  groups,
  initialWidget,
  onSave,
}) => {
  const [widgetId, setWidgetId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DashboardWidgetType>('kpi');
  const [groupBy, setGroupBy] = useState<DashboardGroupBy>('none');
  const [period, setPeriod] = useState<DashboardPeriod>('week');
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>('active');
  const [statusIds, setStatusIds] = useState<string[]>([]);
  const [includeUnassigned, setIncludeUnassigned] = useState(true);
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('small');
  const [barPalette, setBarPalette] = useState<DashboardBarPalette>(DEFAULT_BAR_PALETTE);
  const [milestoneView, setMilestoneView] = useState<DashboardMilestoneView>('list');
  const [milestoneCalendarMode, setMilestoneCalendarMode] = useState<DashboardMilestoneCalendarMode>('month');
  const [filterGroups, setFilterGroups] = useState<DashboardFilterGroup[]>([]);

  const dialogTitle = initialWidget ? 'Edit widget' : 'New widget';
  const isChartType = type === 'bar' || type === 'line' || type === 'area' || type === 'pie';
  const isMilestoneWidget = type === 'milestone' || type === 'milestone_calendar';
  const isMilestoneCalendar = isMilestoneWidget && milestoneView === 'calendar';
  const isTaskWidget = type === 'kpi' || isChartType;

  const createRule = (field: DashboardFilterField = 'assignee'): DashboardFilterRule => ({
    id: createWidgetId(),
    field,
    operator: 'eq',
    value: '',
  });

  const createGroup = (): DashboardFilterGroup => ({
    id: createWidgetId(),
    match: 'and',
    rules: [createRule()],
  });

  useEffect(() => {
    if (!open) return;
    if (initialWidget) {
      const normalizedType = initialWidget.type === 'milestone_calendar'
        ? 'milestone'
        : initialWidget.type;
      const normalizedMilestoneView = normalizedType === 'milestone'
        ? (initialWidget.milestoneView ?? (initialWidget.type === 'milestone_calendar' ? 'calendar' : 'list'))
        : 'list';
      const normalizedCalendarMode = normalizedType === 'milestone'
        ? (initialWidget.milestoneCalendarMode ?? 'month')
        : 'month';
      setWidgetId(initialWidget.id);
      setTitle(initialWidget.title);
      setType(normalizedType);
      setGroupBy(initialWidget.groupBy ?? 'none');
      setPeriod(initialWidget.period);
      setStatusFilter(initialWidget.statusFilter);
      setStatusIds(initialWidget.statusIds ?? []);
      setIncludeUnassigned(Boolean(initialWidget.includeUnassigned));
      setSize(initialWidget.size ?? 'small');
      setBarPalette(initialWidget.barPalette ?? DEFAULT_BAR_PALETTE);
      setMilestoneView(normalizedMilestoneView);
      setMilestoneCalendarMode(normalizedCalendarMode);
      setFilterGroups(initialWidget.filterGroups ?? []);
      return;
    }

    setWidgetId(createWidgetId());
    setTitle('New widget');
    setType('kpi');
    setGroupBy('none');
    setPeriod('week');
    setStatusFilter('active');
    setStatusIds([]);
    setIncludeUnassigned(true);
    setSize('small');
    setBarPalette(DEFAULT_BAR_PALETTE);
    setMilestoneView('list');
    setMilestoneCalendarMode('month');
    setFilterGroups([]);
  }, [initialWidget, open]);

  useEffect(() => {
    if (!isTaskWidget && groupBy !== 'none') {
      setGroupBy('none');
      return;
    }
    if (type === 'kpi' && groupBy !== 'none') {
      setGroupBy('none');
    }
    if (isChartType && groupBy === 'none') {
      setGroupBy('assignee');
    }
  }, [groupBy, isChartType, isTaskWidget, type]);

  useEffect(() => {
    if (isMilestoneCalendar && period !== 'month') {
      setPeriod('month');
    }
  }, [isMilestoneCalendar, period]);

  useEffect(() => {
    if (initialWidget) return;
    setSize('small');
  }, [initialWidget, type]);

  const showGroupBy = isChartType;
  const showCustomStatuses = statusFilter === 'custom';
  const showTaskFilters = isTaskWidget;
  const canSave = title.trim().length > 0;

  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.name.localeCompare(b.name)),
    [statuses],
  );

  const orderedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const orderedAssignees = useMemo(
    () => [...assignees].sort((a, b) => a.name.localeCompare(b.name)),
    [assignees],
  );

  const orderedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  );

  const toggleStatus = (statusId: string) => {
    setStatusIds((current) => (
      current.includes(statusId)
        ? current.filter((item) => item !== statusId)
        : [...current, statusId]
    ));
  };

  const addFilterGroup = () => {
    setFilterGroups((current) => [...current, createGroup()]);
  };

  const removeFilterGroup = (groupId: string) => {
    setFilterGroups((current) => current.filter((group) => group.id !== groupId));
  };

  const updateFilterGroup = (groupId: string, updates: Partial<DashboardFilterGroup>) => {
    setFilterGroups((current) => current.map((group) => (
      group.id === groupId ? { ...group, ...updates } : group
    )));
  };

  const addRuleToGroup = (groupId: string) => {
    setFilterGroups((current) => current.map((group) => (
      group.id === groupId ? { ...group, rules: [...group.rules, createRule()] } : group
    )));
  };

  const removeRuleFromGroup = (groupId: string, ruleId: string) => {
    setFilterGroups((current) => current.map((group) => (
      group.id === groupId
        ? { ...group, rules: group.rules.filter((rule) => rule.id !== ruleId) }
        : group
    )));
  };

  const updateRule = (groupId: string, ruleId: string, updates: Partial<DashboardFilterRule>) => {
    setFilterGroups((current) => current.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        rules: group.rules.map((rule) => (
          rule.id === ruleId ? { ...rule, ...updates } : rule
        )),
      };
    }));
  };

  const getRuleOptions = (field: DashboardFilterField) => {
    if (field === 'project') {
      return orderedProjects.map((project) => ({
        ...project,
        name: formatProjectLabel(project.name, project.code),
      }));
    }
    if (field === 'group') {
      return orderedGroups;
    }
    if (field === 'status') {
      return orderedStatuses.map((status) => ({
        id: status.id,
        name: formatStatusLabel(status.name, status.emoji),
      }));
    }
    return [
      { id: UNASSIGNED_FILTER_VALUE, name: 'Unassigned' },
      ...orderedAssignees,
    ];
  };

  const handleSave = () => {
    const normalizedType = type === 'milestone_calendar' ? 'milestone' : type;
    const nextIsChartType = normalizedType === 'bar'
      || normalizedType === 'line'
      || normalizedType === 'area'
      || normalizedType === 'pie';
    const nextIsMilestone = normalizedType === 'milestone';
    const nextIsTaskWidget = normalizedType === 'kpi' || nextIsChartType;
    const normalizedGroupBy = nextIsChartType ? groupBy : 'none';
    const normalizedGroups = nextIsTaskWidget
      ? filterGroups
        .map((group) => ({
          ...group,
          rules: group.rules.filter((rule) => rule.value),
        }))
        .filter((group) => group.rules.length > 0)
      : [];
    const normalizedPeriod = nextIsMilestone && milestoneView === 'calendar' ? 'month' : period;
    const normalizedStatusFilter = nextIsTaskWidget ? statusFilter : 'all';
    const nextWidget: DashboardWidget = {
      id: widgetId,
      title: title.trim(),
      type: normalizedType,
      groupBy: normalizedGroupBy,
      period: normalizedPeriod,
      size,
      barPalette: nextIsChartType ? barPalette : undefined,
      milestoneView: nextIsMilestone ? milestoneView : undefined,
      milestoneCalendarMode: nextIsMilestone ? milestoneCalendarMode : undefined,
      statusFilter: normalizedStatusFilter,
      statusIds: nextIsTaskWidget && showCustomStatuses ? statusIds : [],
      includeUnassigned: normalizedGroupBy === 'assignee' ? includeUnassigned : false,
      filterGroups: normalizedGroups,
    };
    onSave(nextWidget);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="widget-title">Title</Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as DashboardWidgetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as DashboardPeriod)}
                disabled={isMilestoneCalendar}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </div>

          {isMilestoneWidget && (
            <div className="space-y-2">
              <Label>Milestone view</Label>
              <Select
                value={milestoneView}
                onValueChange={(value) => setMilestoneView(value as DashboardMilestoneView)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {milestoneViewOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isMilestoneCalendar && (
            <div className="space-y-2">
              <Label>Calendar range</Label>
              <Select
                value={milestoneCalendarMode}
                onValueChange={(value) => setMilestoneCalendarMode(value as DashboardMilestoneCalendarMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {milestoneCalendarModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showGroupBy && (
            <div className="space-y-2">
              <Label>Group by</Label>
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as DashboardGroupBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupByOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showGroupBy && (
            <div className="space-y-2">
              <Label>Chart palette</Label>
              <Select
                value={barPalette}
                onValueChange={(value) => setBarPalette(value as DashboardBarPalette)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BAR_PALETTES).map(([value, palette]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <span className="flex h-3 w-12 overflow-hidden rounded-sm border border-border">
                          {palette.colors.slice(0, 4).map((color) => (
                            <span
                              key={color}
                              className="flex-1"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
                        {palette.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showTaskFilters && (
            <div className="space-y-2">
              <Label>Status filter</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DashboardStatusFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showTaskFilters && showCustomStatuses && (
            <div className="space-y-2">
              <Label>Selected statuses</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {orderedStatuses.length === 0 && (
                  <div className="text-sm text-muted-foreground">No statuses found.</div>
                )}
                {orderedStatuses.map((status) => (
                  <label key={status.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={statusIds.includes(status.id)}
                      onCheckedChange={() => toggleStatus(status.id)}
                    />
                    <span className="truncate">{formatStatusLabel(status.name, status.emoji)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {showGroupBy && groupBy === 'assignee' && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Include unassigned</div>
                <div className="text-xs text-muted-foreground">
                  Show tasks without an assignee.
                </div>
              </div>
              <Switch checked={includeUnassigned} onCheckedChange={setIncludeUnassigned} />
            </div>
          )}

          {showTaskFilters && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Advanced filters</Label>
                <Button variant="outline" size="sm" onClick={addFilterGroup}>
                  <Plus className="h-4 w-4" />
                  Add group
                </Button>
              </div>
              {filterGroups.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  No advanced filters. Add a group to build custom rules.
                </div>
              )}
              {filterGroups.map((group, index) => (
                <div key={group.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">Group {index + 1}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={group.match}
                        onValueChange={(value) => updateFilterGroup(group.id, { match: value as DashboardFilterGroup['match'] })}
                      >
                        <SelectTrigger className="w-[210px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {groupMatchOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFilterGroup(group.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {group.rules.length === 0 && (
                    <div className="text-xs text-muted-foreground">No rules yet.</div>
                  )}
                  {group.rules.map((rule) => {
                    const options = getRuleOptions(rule.field);
                    return (
                      <div
                        key={rule.id}
                        className="grid gap-2 sm:grid-cols-[1.1fr_0.9fr_1.3fr_auto] items-center"
                      >
                        <Select
                          value={rule.field}
                          onValueChange={(value) => updateRule(group.id, rule.id, {
                            field: value as DashboardFilterField,
                            value: '',
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {filterFieldOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.operator}
                          onValueChange={(value) => updateRule(group.id, rule.id, { operator: value as DashboardFilterOperator })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {filterOperatorOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.value}
                          onValueChange={(value) => updateRule(group.id, rule.id, { value })}
                          disabled={options.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={options.length ? 'Select value' : 'No options'} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRuleFromGroup(group.id, rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}

                  <Button variant="outline" size="sm" onClick={() => addRuleToGroup(group.id)}>
                    <Plus className="h-4 w-4" />
                    Add rule
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
