import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Percent,
  IndianRupee,
  Calendar,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getOccupancyReport,
  getAdrReport,
  getRevparReport,
  getProperties,
  parseApiError,
} from '../../api';
import type { ReportPage, ReportRow, ReportType, PropertyOut } from '../../types';
import {
  PageHeader,
  Select,
  Input,
  Table,
  StatCard,
  LoadingSpinner,
  ErrorState,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatCurrency, formatMonthYear, formatPercent } from '../../utils/formatters';
import { getFirstDayOfYear, getLastDayOfYear } from '../../utils/dates';

export const ReportsPage: React.FC = () => {
  const { user, isOwner, isManager } = useAuth();

  const [reportType, setReportType] = useState<ReportType>('occupancy');
  const [fromDate, setFromDate] = useState(getFirstDayOfYear());
  const [toDate, setToDate] = useState(getLastDayOfYear());

  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    isManager && user?.property_id ? String(user.property_id) : ''
  );

  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load properties for Owner
  useEffect(() => {
    if (isOwner) {
      getProperties(50, 0)
        .then((res) => setProperties(res.items))
        .catch(() => {});
    }
  }, [isOwner]);

  const fetchReport = async () => {
    if (!fromDate || !toDate) return;
    if (toDate <= fromDate) {
      setError('End date must be after start date.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const propId = selectedPropertyId ? Number(selectedPropertyId) : undefined;
      let res: ReportPage;

      if (reportType === 'occupancy') {
        res = await getOccupancyReport(fromDate, toDate, propId);
      } else if (reportType === 'adr') {
        res = await getAdrReport(fromDate, toDate, propId);
      } else {
        res = await getRevparReport(fromDate, toDate, propId);
      }

      setReportData(res.items);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedPropertyId, fromDate, toDate]);

  // Compute average of the metric
  const averageValue =
    reportData.length > 0
      ? reportData.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0) / reportData.length
      : 0;

  const columns: Column<ReportRow>[] = [
    {
      header: 'Month Period',
      accessorKey: 'month',
      cell: (r) => (
        <span className="font-semibold text-slate-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>{formatMonthYear(r.month)}</span>
        </span>
      ),
    },
    {
      header: 'Property ID',
      accessorKey: 'property_id',
      cell: (r) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
          Property #{r.property_id}
        </span>
      ),
    },
    {
      header:
        reportType === 'occupancy'
          ? 'Occupancy Rate (%)'
          : reportType === 'adr'
          ? 'Average Daily Rate (ADR)'
          : 'RevPAR (Revenue per Room)',
      accessorKey: 'value',
      cell: (r) => {
        const val = parseFloat(r.value) || 0;
        if (reportType === 'occupancy') {
          return (
            <div className="flex items-center gap-3">
              <div className="w-28 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-brand-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(val, 100)}%` }}
                />
              </div>
              <span className="font-bold text-brand-300">{formatPercent(r.value)}</span>
            </div>
          );
        }
        return (
          <span className="font-extrabold text-emerald-400 text-base">
            {formatCurrency(r.value)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hospitality Analytics & Reports"
        subtitle={
          isOwner
            ? 'Consolidated multi-property performance metrics'
            : `Operational analytics for Property #${user?.property_id}`
        }
      />

      {/* Report Type Selector Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-fit shadow-md">
        <button
          onClick={() => setReportType('occupancy')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            reportType === 'occupancy'
              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Occupancy %</span>
        </button>

        <button
          onClick={() => setReportType('adr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            reportType === 'adr'
              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          <span>ADR (Average Daily Rate)</span>
        </button>

        <button
          onClick={() => setReportType('revpar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            reportType === 'revpar'
              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>RevPAR (Rev per Available Room)</span>
        </button>
      </div>

      {/* Filter Parameters */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <Input
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          {isOwner ? (
            <Select
              label="Property Scope"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              options={[
                { value: '', label: 'All Properties Consolidated' },
                ...properties.map((p) => ({
                  value: p.property_id,
                  label: `${p.name} (${p.city})`,
                })),
              ]}
            />
          ) : (
            <Input
              label="Assigned Property"
              type="text"
              value={`Property #${user?.property_id}`}
              disabled
            />
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={
            reportType === 'occupancy'
              ? 'Average Occupancy'
              : reportType === 'adr'
              ? 'Average ADR'
              : 'Average RevPAR'
          }
          value={
            reportType === 'occupancy'
              ? formatPercent(averageValue)
              : formatCurrency(averageValue)
          }
          subtitle={`Across ${reportData.length} monthly report periods`}
          icon={<BarChart3 className="w-5 h-5" />}
          accentColor="brand"
        />

        <StatCard
          title="Reporting Months"
          value={reportData.length}
          subtitle={`${fromDate} to ${toDate}`}
          icon={<Calendar className="w-5 h-5" />}
          accentColor="indigo"
        />

        <StatCard
          title="Scoping"
          value={selectedPropertyId ? `Prop #${selectedPropertyId}` : 'Consolidated'}
          subtitle={isOwner ? 'Owner Global Access' : 'Manager Assigned Property'}
          icon={<Building2 className="w-5 h-5" />}
          accentColor="emerald"
        />
      </div>

      {/* Content Table */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Computing operational analytics..." className="py-16" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReport} />
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100">
            Monthly Performance Breakdown ({reportData.length} entries)
          </h3>
          <Table
            columns={columns}
            data={reportData}
            keyExtractor={(r) => `${r.property_id}-${r.month}`}
            emptyMessage="No analytics data available for the selected dates and property."
          />
        </div>
      )}
    </div>
  );
};
