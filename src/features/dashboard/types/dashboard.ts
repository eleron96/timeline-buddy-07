export type DashboardPeriod = 'day' | 'week' | 'month';

export type DashboardWidgetType = 'kpi' | 'bar' | 'line' | 'area' | 'pie';

export type DashboardGroupBy = 'none' | 'assignee' | 'status';

export type DashboardStatusFilter = 'all' | 'active' | 'final' | 'cancelled' | 'custom';

export type DashboardWidgetSize = 'small' | 'medium' | 'large';

export type DashboardBarPalette =
  | 'pastel-sky'
  | 'pastel-dawn'
  | 'pastel-mint'
  | 'mono'
  | 'checker';

export type DashboardFilterField = 'assignee' | 'status' | 'project';

export type DashboardFilterOperator = 'eq' | 'neq';

export type DashboardFilterRule = {
  id: string;
  field: DashboardFilterField;
  operator: DashboardFilterOperator;
  value: string;
};

export type DashboardFilterGroup = {
  id: string;
  match: 'and' | 'or';
  rules: DashboardFilterRule[];
};

export type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  period: DashboardPeriod;
  groupBy?: DashboardGroupBy;
  size?: DashboardWidgetSize;
  barPalette?: DashboardBarPalette;
  statusFilter: DashboardStatusFilter;
  statusIds?: string[];
  includeUnassigned?: boolean;
  filterGroups?: DashboardFilterGroup[];
};

export type DashboardLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

export type DashboardLayouts = Record<string, DashboardLayoutItem[]>;

export type DashboardStatus = {
  id: string;
  name: string;
  isFinal: boolean;
  color: string;
};

export type DashboardOption = {
  id: string;
  name: string;
};

export type DashboardStatsRow = {
  assignee_id: string | null;
  assignee_name: string | null;
  project_id: string | null;
  project_name: string | null;
  status_id: string;
  status_name: string;
  status_is_final: boolean;
  total: number;
};

export type DashboardSeriesItem = {
  name: string;
  value: number;
};

export type DashboardWidgetData = {
  total: number;
  series: DashboardSeriesItem[];
};
