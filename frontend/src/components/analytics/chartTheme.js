import { formatCurrency } from '../../utils/format';

/** Shared palette for the analytics charts. */
export const CHART_COLORS = ['#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/** Compact rupee value used in chart tooltips (3 significant digits). */
export const formatChartCurrency = (value) => formatCurrency(value, { significant: 3 });
