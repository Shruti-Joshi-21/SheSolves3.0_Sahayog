import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { format, formatDistanceToNow } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  PointElement,
  LineController,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  LayoutDashboard,
  Users,
  Inbox,
  BarChart2,
  CalendarDays,
  LogOut,
  Leaf,
  CheckSquare,
  Clock,
  CheckCircle,
  UserCheck,
  UserX,
  TrendingUp,
  X,
  Paperclip,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Menu,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  PointElement,
  LineController,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const RING_R = 13;
const RING_C = 2 * Math.PI * RING_R;

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAlertAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  return 'just now';
}

const taskTypeChip = (type) => {
  switch (type) {
    case 'WASTE_COLLECTION':
      return { cls: 'bg-[#E8F5E9] text-[#1B5E20]', label: 'Waste' };
    case 'RECYCLING':
      return { cls: 'bg-[#E3F2FD] text-[#0D47A1]', label: 'Recycling' };
    case 'AWARENESS_DRIVE':
      return { cls: 'bg-[#F9F3E0] text-[#5D4E00]', label: 'Awareness' };
    default:
      return { cls: 'bg-[#F9FBF7] text-[#616161]', label: 'Other' };
  }
};

const rowAvatarColors = ['bg-[#427A43]', 'bg-blue-600', 'bg-amber-500', 'bg-purple-600'];

function ReportsInboxTab({
  reports,
  reportsLoading,
  pendingLeads,
  selectedReport,
  setSelectedReport,
  reportModalOpen,
  setReportModalOpen,
  activeReportsTab,
  setActiveReportsTab,
  requestedLeadIds,
  setRequestedLeadIds,
  setReports,
}) {
  const unreadCount = reports.filter((r) => !r.isRead).length;
  const filteredReports =
    activeReportsTab === 'UNREAD' ? reports.filter((r) => !r.isRead) : reports;

  const openReport = async (report) => {
    setSelectedReport(report);
    setReportModalOpen(true);
    if (!report.isRead) {
      try {
        await api.patch(`/admin/reports/${report._id}/read`);
        setReports((prev) =>
          prev.map((r) => (r._id === report._id ? { ...r, isRead: true } : r))
        );
        setSelectedReport({ ...report, isRead: true });
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to mark read');
      }
    }
  };

  const printReport = (report) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<html><head><title>Report</title></head><body><h1>${report.submittedBy?.fullName || ''}</h1><p>${report.summary || ''}</p></body></html>`
    );
    w.document.close();
    w.print();
    w.close();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex gap-2 mb-4">
        {[
          { k: 'ALL', l: 'All' },
          { k: 'UNREAD', l: `Unread (${unreadCount})` },
          { k: 'PENDING', l: `Pending Submission (${pendingLeads.length})` },
        ].map(({ k, l }) => (
          <button
            key={k}
            type="button"
            onClick={() => setActiveReportsTab(k)}
            className={`px-3 py-1.5 rounded-[10px] text-xs cursor-pointer ${
              activeReportsTab === k
                ? 'bg-[#246427] text-white'
                : 'bg-[#F9FBF7] text-[#616161] hover:bg-gray-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {activeReportsTab === 'PENDING' ? (
        <div>
          <p className="text-xs text-[#616161] mb-2">
            Team leads who haven&apos;t submitted a report this week
          </p>
          <div className="flex flex-col gap-3">
            {pendingLeads.map((lead) => (
              <div
                key={lead._id}
                className="bg-white rounded-[14px] border border-[#E0E7DC] p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-800 flex items-center justify-center text-xs font-medium">
                  {initialsFromName(lead.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#212121]">{lead.fullName}</div>
                  <div className="text-xs text-[#9E9E9E]">
                    {lead.lastReportDate
                      ? `Last submitted: ${format(new Date(lead.lastReportDate), 'MMM d, yyyy')}`
                      : 'Never submitted'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={requestedLeadIds.has(String(lead._id))}
                  onClick={async () => {
                    try {
                      await api.post(`/admin/reports/${lead._id}/request`);
                      toast.success(`Report request sent to ${lead.fullName}`);
                      setRequestedLeadIds((prev) => new Set([...prev, String(lead._id)]));
                    } catch (e) {
                      toast.error(e.response?.data?.message || 'Request failed');
                    }
                  }}
                  className="bg-[#246427] text-white text-xs px-3 py-1.5 rounded-[10px] disabled:opacity-50"
                >
                  {requestedLeadIds.has(String(lead._id)) ? 'Requested' : 'Request Report'}
                </button>
              </div>
            ))}
            {!reportsLoading && pendingLeads.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-8 h-8 mx-auto text-[#9E9E9E] mb-2" />
                <p className="text-sm text-[#9E9E9E]">No pending team leads</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reportsLoading
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse bg-gray-200 rounded-[14px]" />
              ))
            : filteredReports.length === 0
              ? (
                  <div className="text-center py-12">
                    <FileText className="w-8 h-8 mx-auto text-[#9E9E9E] mb-2" />
                    <p className="text-sm text-[#9E9E9E]">No reports yet</p>
                    <p className="text-xs text-[#9E9E9E] mt-1">Reports will appear here</p>
                  </div>
                )
              : filteredReports.map((report) => (
                  <button
                    key={report._id}
                    type="button"
                    onClick={() => openReport(report)}
                    className={`bg-white rounded-[14px] p-4 flex items-center gap-4 cursor-pointer text-left w-full ${
                      !report.isRead ? 'border-l-4 border-l-[#005F02] border border-[#E0E7DC]' : 'border border-[#E0E7DC]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#E8F5E9] text-[#1B5E20] flex items-center justify-center text-xs font-medium">
                      {initialsFromName(report.submittedBy?.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-medium text-[#212121]">
                          {report.submittedBy?.fullName}
                        </span>
                        <span className="text-xs text-[#616161]">{report.period}</span>
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[0.8125rem] font-medium bg-[#E8F5E9] text-[#1B5E20]">
                          Present: {report.presentCount}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[0.8125rem] font-medium bg-[#FFEBEE] text-[#B71C1C]">
                          Absent: {report.absentCount}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[0.8125rem] font-medium bg-[#FFF3E0] text-[#BF360C]">
                          Flagged: {report.flaggedCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] text-[#9E9E9E]">
                        {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                      </span>
                      {!report.isRead && <span className="w-2 h-2 bg-[#246427] rounded-full" />}
                    </div>
                  </button>
                ))}
        </div>
      )}

      {reportModalOpen && selectedReport && (
        <div className="min-h-screen bg-black/30 flex items-start justify-center pt-10 absolute inset-0 z-50 overflow-y-auto">
          <div className="bg-white rounded-[14px] w-[680px] max-w-[95vw] max-h-[80vh] overflow-y-auto shadow-[var(--shadow-md)] mb-10">
            <div className="p-6 border-b border-[#E0E7DC] flex justify-between items-start">
              <div>
                <div className="text-base font-medium text-[#212121]">
                  {selectedReport.submittedBy?.fullName}
                </div>
                <div className="text-xs text-[#9E9E9E] mt-0.5">
                  {selectedReport.period} · {format(new Date(selectedReport.createdAt), 'PP')}
                </div>
              </div>
              <button type="button" onClick={() => setReportModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Present', v: selectedReport.presentCount },
                  { label: 'Absent', v: selectedReport.absentCount },
                  {
                    label: 'Tasks completed',
                    v: `${selectedReport.tasksCompleted}/${selectedReport.totalTasks || '—'}`,
                  },
                ].map((s) => (
                  <div key={s.label} className="bg-[#F9FBF7] rounded-[14px] p-4">
                    <div className="text-[10px] uppercase text-[#9E9E9E]">{s.label}</div>
                    <div className="text-2xl font-medium text-[#212121]">{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs font-medium text-[#616161] uppercase mb-2">Summary</div>
              <div className="text-sm text-[#212121] leading-relaxed bg-[#F9FBF7] rounded-[14px] p-4">
                {selectedReport.summary}
              </div>
              {(selectedReport.attachments || []).length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-[#616161] uppercase mb-2">Attachments</div>
                  <ul className="space-y-1">
                    {selectedReport.attachments.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-[#616161]">
                        <Paperclip size={14} /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-[#E0E7DC] flex justify-between">
              {!selectedReport.isRead && (
                <button
                  type="button"
                  className="text-sm text-[#616161]"
                  onClick={async () => {
                    try {
                      await api.patch(`/admin/reports/${selectedReport._id}/read`);
                      setReports((prev) =>
                        prev.map((r) =>
                          r._id === selectedReport._id ? { ...r, isRead: true } : r
                        )
                      );
                      setSelectedReport({ ...selectedReport, isRead: true });
                    } catch (e) {
                      toast.error(e.response?.data?.message || 'Failed');
                    }
                  }}
                >
                  Mark as read
                </button>
              )}
              <button
                type="button"
                onClick={() => printReport(selectedReport)}
                className="ml-auto bg-[#246427] text-white rounded-[10px] px-4 py-2 text-sm flex items-center gap-2"
              >
                <Download size={16} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function AnalyticsTab({
  analyticsFilters,
  setAnalyticsFilters,
  kpis,
  analyticsTrend,
  verification,
  teamComparison,
  taskTypeData,
  monthlyCompare,
  rawRecords,
  rawTotal,
  rawPage,
  setRawPage,
  analyticsLoading,
  teamLeadsFromUsers,
  fetchAnalyticsData,
}) {
  const lineData = useMemo(
    () => ({
      labels: analyticsTrend.map((d) => d.date),
      datasets: [
        {
          label: 'Rate %',
          data: analyticsTrend.map((d) => d.rate),
          borderColor: '#246427',
          backgroundColor: 'rgba(36,100,39,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    }),
    [analyticsTrend]
  );

  const lineOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100 },
        x: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    }),
    []
  );

  const doughnutVData = useMemo(() => {
    if (!verification) return { labels: [], datasets: [] };
    const vals = [
      verification.verified,
      verification.pending,
      verification.rejected,
      verification.flagged,
    ];
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    return {
      labels: ['Verified', 'Pending', 'Rejected', 'Flagged'],
      total,
      vals,
      colors: ['#246427', '#C0B87A', '#C0392B', '#E67E22'],
    };
  }, [verification]);

  const horizontalBarData = useMemo(
    () => ({
      labels: teamComparison.map((t) => t.teamLeadName),
      datasets: [
        {
          label: 'Rate',
          data: teamComparison.map((t) => t.rate),
          backgroundColor: '#246427CC',
          barThickness: 18,
        },
      ],
    }),
    [teamComparison]
  );

  const horizontalOpts = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100 },
        y: { grid: { display: false } },
      },
      plugins: { legend: { display: false } },
    }),
    []
  );

  const taskTypeLabels = ['Waste Collection', 'Recycling', 'Awareness Drive', 'Other'];
  const typeOrder = ['WASTE_COLLECTION', 'RECYCLING', 'AWARENESS_DRIVE', 'OTHER'];
  const groupedBarData = useMemo(() => {
    const byType = Object.fromEntries(typeOrder.map((t) => [t, { present: 0, absent: 0 }]));
    (taskTypeData || []).forEach((row) => {
      if (byType[row.type]) {
        byType[row.type].present = row.present;
        byType[row.type].absent = row.absent;
      }
    });
    return {
      labels: taskTypeLabels,
      datasets: [
        {
          label: 'Present',
          data: typeOrder.map((t) => byType[t].present),
          backgroundColor: '#246427',
          barThickness: 20,
        },
        {
          label: 'Absent',
          data: typeOrder.map((t) => byType[t].absent),
          backgroundColor: '#C0392B',
          barThickness: 20,
        },
      ],
    };
  }, [taskTypeData]);

  const groupedOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
      },
      plugins: { legend: { position: 'bottom' } },
    }),
    []
  );

  const exportCsv = () => {
    const headers = ['Team Lead', 'Task', 'Date', 'Status'];
    const rows = rawRecords.map((r) => [
      r.teamLead?.fullName || '',
      r.task?.title || '',
      r.date ? format(new Date(r.date), 'yyyy-MM-dd') : '',
      r.status,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${c}"`).join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4 mb-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs text-[#616161]">From</label>
        <input
          type="date"
          value={analyticsFilters.startDate}
          onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, startDate: e.target.value })}
          className="border border-[#E0E7DC] rounded-[10px] px-2 py-1 text-sm"
        />
        <span className="text-xs text-[#616161]">to</span>
        <input
          type="date"
          value={analyticsFilters.endDate}
          onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, endDate: e.target.value })}
          className="border border-[#E0E7DC] rounded-[10px] px-2 py-1 text-sm"
        />
        <select
          value={analyticsFilters.teamLeadId}
          onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, teamLeadId: e.target.value })}
          className="border border-[#E0E7DC] rounded-[10px] px-2 py-1 text-sm"
        >
          <option value="">All Team Leads</option>
          {teamLeadsFromUsers.map((l) => (
            <option key={l._id} value={l._id}>
              {l.fullName}
            </option>
          ))}
        </select>
        <select
          value={analyticsFilters.taskType}
          onChange={(e) => setAnalyticsFilters({ ...analyticsFilters, taskType: e.target.value })}
          className="border border-[#E0E7DC] rounded-[10px] px-2 py-1 text-sm"
        >
          <option value="">All Types</option>
          <option value="WASTE_COLLECTION">Waste Collection</option>
          <option value="RECYCLING">Recycling</option>
          <option value="AWARENESS_DRIVE">Awareness Drive</option>
          <option value="OTHER">Other</option>
        </select>
        <button
          type="button"
          onClick={() => fetchAnalyticsData(1)}
          className="bg-[#246427] text-white rounded-[10px] px-4 py-2 text-sm"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="border border-[#E0E7DC] rounded-[10px] px-4 py-2 text-sm flex items-center gap-2"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {analyticsLoading || !kpis
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-[14px] border border-[#E0E7DC] p-4 h-24 animate-pulse bg-[#F9FBF7]" />
            ))
          : [
              { label: 'Total Present', v: kpis.totalPresent, Icon: UserCheck, c: 'text-green-700' },
              { label: 'Total Absent', v: kpis.totalAbsent, Icon: UserX, c: 'text-red-700' },
              { label: 'Overall Rate', v: `${kpis.overallRate}%`, Icon: TrendingUp, c: 'text-[#212121]' },
              { label: 'Late Check-ins', v: kpis.lateCheckIns, Icon: Clock, c: 'text-orange-700' },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-[14px] border border-[#E0E7DC] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex items-center gap-4">
                <div className="flex items-center justify-center bg-[#F1F8E9] p-3 rounded-[12px] shrink-0">
                  <card.Icon className="w-[24px] h-[24px] text-[#246427]" strokeWidth={2} />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[1.25rem] font-bold text-[#212121] leading-tight truncate">
                    {card.v}
                  </p>
                  <p className="text-[0.75rem] text-[#616161] mt-1 truncate">{card.label}</p>
                </div>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
          <div className="text-xs font-medium text-[#212121] mb-2">NGO attendance rate — last 30 days</div>
          <div className="h-40">
            <Line data={lineData} options={lineOpts} />
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
          <div className="text-xs font-medium text-[#212121] mb-2">Verification status</div>
          <div className="h-36">
            {verification && (
              <Doughnut
                data={{
                  labels: doughnutVData.labels,
                  datasets: [
                    {
                      data: doughnutVData.vals,
                      backgroundColor: doughnutVData.colors,
                    },
                  ],
                }}
                options={{ cutout: '55%', plugins: { legend: { display: false } } }}
              />
            )}
          </div>
          <div className="mt-2 space-y-1">
            {doughnutVData.labels?.map((lab, i) => {
              const pct = Math.round(((doughnutVData.vals[i] || 0) / doughnutVData.total) * 1000) / 10;
              return (
                <div key={lab} className="flex justify-between text-[10px] text-[#616161]">
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: doughnutVData.colors[i] }}
                    />
                    {lab}
                  </span>
                  <span>
                    {doughnutVData.vals[i]} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
          <div className="text-xs font-medium text-[#212121] mb-2">Team attendance comparison</div>
          <div className="h-56">
            <Bar data={horizontalBarData} options={horizontalOpts} />
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
          <div className="text-xs font-medium text-[#212121] mb-2">Attendance by task type</div>
          <div className="h-56">
            <Bar data={groupedBarData} options={groupedOpts} />
          </div>
        </div>
      </div>

      {monthlyCompare && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {['thisMonth', 'lastMonth'].map((key) => {
            const m = monthlyCompare[key];
            return (
              <div key={key} className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
                <div className="text-xs text-[#616161] mb-2">
                  {key === 'thisMonth' ? 'This Month' : 'Last Month'}
                </div>
                <div className="text-sm text-[#212121]">
                  Present: {m.totalPresent} | Absent: {m.totalAbsent} | Rate: {m.rate}%
                </div>
              </div>
            );
          })}
          <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
            <div className="text-xs text-[#616161] mb-2">Change</div>
            <div
              className={`text-lg font-medium ${monthlyCompare.delta >= 0 ? 'text-[#246427]' : 'text-red-600'}`}
            >
              {monthlyCompare.delta >= 0 ? '↑' : '↓'} {Math.abs(monthlyCompare.delta)}%
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-[#E0E7DC] overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <span className="text-sm font-medium text-[#212121]">Attendance Records</span>
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs text-[#246427] flex items-center gap-1"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-[#F9FBF7] border-b">
              <tr>
                {['Team Lead', 'Task', 'Date', 'Present', 'Absent', 'Rate', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[#616161] text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyticsLoading
                ? [1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="h-6 animate-pulse bg-gray-200 rounded" />
                      </td>
                    </tr>
                  ))
                : rawRecords.map((r) => (
                    <tr key={r._id} className="border-b border-[var(--color-border)]">
                      <td className="px-4 py-3 text-[#212121]">{r.teamLead?.fullName}</td>
                      <td className="px-4 py-3 text-[#212121]">{r.task?.title}</td>
                      <td className="px-4 py-3 text-[#212121]">
                        {r.date ? format(new Date(r.date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">{r.present}</td>
                      <td className="px-4 py-3">{r.absent}</td>
                      <td className="px-4 py-3">{r.rate}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            r.status === 'VERIFIED'
                              ? 'bg-[#E8F5E9] text-[#1B5E20]'
                              : r.status === 'PENDING'
                                ? 'bg-[#F9F3E0] text-[#5D4E00]'
                                : r.status === 'REJECTED'
                                  ? 'bg-[#FFEBEE] text-[#B71C1C]'
                                  : 'bg-[#FFF3E0] text-[#BF360C]'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center p-4 border-t text-xs text-[#616161]">
          <span>
            Showing {(rawPage - 1) * 15 + 1}–{Math.min(rawPage * 15, rawTotal)} of {rawTotal} records
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={rawPage <= 1}
              onClick={() => fetchAnalyticsData(rawPage - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={rawPage * 15 >= rawTotal}
              onClick={() => fetchAnalyticsData(rawPage + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const LEAVE_TYPE_LABEL = {
  SICK: 'Sick Leave',
  CASUAL: 'Casual Leave',
  EMERGENCY: 'Emergency Leave',
  OTHER: 'Other',
};

function LeaveTab({
  leaveCalendar,
  leaveSummary,
  leaveRecords,
  leaveTotal,
  leavePage,
  setLeavePage,
  currentCalendarMonth,
  setCurrentCalendarMonth,
  selectedCalendarDay,
  setSelectedCalendarDay,
  calendarPopoverOpen,
  setCalendarPopoverOpen,
  leaveFilters,
  setLeaveFilters,
  leaveLoading,
  fetchLeaveData,
  teamLeadsFromUsers,
}) {
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  const today = new Date();
  const isToday = (d) =>
    d &&
    today.getDate() === d &&
    today.getMonth() === month &&
    today.getFullYear() === year;

  const formatLeaveTypeDot = (t) => {
    if (t === 'SICK') return 'bg-[#C0392B]';
    if (t === 'CASUAL') return 'bg-[#1565C0]';
    if (t === 'EMERGENCY') return 'bg-[#E67E22]';
    return 'bg-gray-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {leaveSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
            <div className="text-xs text-[#616161]">On Leave Today</div>
            <div className="text-2xl font-medium text-[#212121]">{leaveSummary.onLeaveToday}</div>
          </div>
          <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
            <div className="text-xs text-[#616161]">Total Leaves This Month</div>
            <div className="text-2xl font-medium text-[#212121]">
              {leaveSummary.totalLeavesThisMonth}
            </div>
          </div>
          <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4">
            <div className="text-xs text-[#616161]">Most Common Type</div>
            <div className="text-lg font-medium text-[#212121]">
              {LEAVE_TYPE_LABEL[leaveSummary.mostCommonType] || leaveSummary.mostCommonType}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-5 mb-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-[#212121]">
            {format(currentCalendarMonth, 'MMMM yyyy')}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setCurrentCalendarMonth(new Date(year, month - 1, 1))
              }
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentCalendarMonth(new Date(year, month + 1, 1))
              }
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-[10px] text-[#9E9E9E] text-center font-medium py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, idx) => {
            if (d == null) return <div key={`e-${idx}`} className="min-h-[44px]" />;
            const key = format(new Date(year, month, d), 'yyyy-MM-dd');
            const entries = leaveCalendar[key] || [];
            const showDots = entries.slice(0, 4);
            const more = entries.length - showDots.length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedCalendarDay(key);
                  setCalendarPopoverOpen(true);
                }}
                className={`min-h-[44px] rounded-[10px] border border-[var(--color-border)] p-1 text-left hover:bg-[#F9FBF7] relative ${
                  isToday(d) ? 'border-[#246427] border-2 text-[#246427] font-medium' : ''
                }`}
              >
                <span className="text-[0.9375rem] text-[#616161]">{d}</span>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {showDots.map((e, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${formatLeaveTypeDot(e.leaveType)}`}
                    />
                  ))}
                  {more > 0 && <span className="text-[8px] text-[#9E9E9E]">+{more}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {calendarPopoverOpen && selectedCalendarDay && (
          <div className="bg-white border border-[#E0E7DC] rounded-[14px] shadow-lg p-4 mt-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                {format(new Date(selectedCalendarDay + 'T12:00:00'), 'PPP')}
              </span>
              <button type="button" onClick={() => setCalendarPopoverOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {(leaveCalendar[selectedCalendarDay] || []).length === 0 ? (
              <p className="text-xs text-[#9E9E9E]">No approved leaves on this day</p>
            ) : (
              <ul className="space-y-2">
                {leaveCalendar[selectedCalendarDay].map((e, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${formatLeaveTypeDot(e.leaveType)}`} />
                    <span>{e.workerName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F9FBF7]">
                      {e.leaveType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex gap-4 mt-3 flex-wrap">
          {[
            ['SICK', 'Sick', 'bg-[#C0392B]'],
            ['CASUAL', 'Casual', 'bg-[#1565C0]'],
            ['EMERGENCY', 'Emergency', 'bg-[#E67E22]'],
            ['OTHER', 'Other', 'bg-gray-400'],
          ].map(([k, lab, cls]) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-[#616161]">
              <span className={`w-2 h-2 rounded-full ${cls}`} />
              {lab}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-[#E0E7DC] p-4 mb-4 flex flex-wrap gap-3 items-center">
        <select
          value={leaveFilters.status}
          onChange={(e) => setLeaveFilters({ ...leaveFilters, status: e.target.value })}
          className="border rounded-[10px] px-2 py-1 text-sm"
        >
          <option value="">All status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={leaveFilters.leaveType}
          onChange={(e) => setLeaveFilters({ ...leaveFilters, leaveType: e.target.value })}
          className="border rounded-[10px] px-2 py-1 text-sm"
        >
          <option value="">All types</option>
          <option value="SICK">Sick</option>
          <option value="CASUAL">Casual</option>
          <option value="EMERGENCY">Emergency</option>
          <option value="OTHER">Other</option>
        </select>
        <select
          value={leaveFilters.teamLeadId}
          onChange={(e) => setLeaveFilters({ ...leaveFilters, teamLeadId: e.target.value })}
          className="border rounded-[10px] px-2 py-1 text-sm"
        >
          <option value="">All team leads</option>
          {teamLeadsFromUsers.map((l) => (
            <option key={l._id} value={l._id}>
              {l.fullName}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={leaveFilters.startDate}
          onChange={(e) => setLeaveFilters({ ...leaveFilters, startDate: e.target.value })}
          className="border rounded-[10px] px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={leaveFilters.endDate}
          onChange={(e) => setLeaveFilters({ ...leaveFilters, endDate: e.target.value })}
          className="border rounded-[10px] px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => fetchLeaveData(1)}
          className="bg-[#246427] text-white rounded-[10px] px-4 py-2 text-sm"
        >
          Apply
        </button>
      </div>

      <div className="bg-white rounded-[14px] border border-[#E0E7DC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-[#F9FBF7] border-b">
            <tr>
              {['Worker', 'Team Lead', 'Type', 'From', 'To', 'Days', 'Reason', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-[#616161]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaveLoading
              ? [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-6 bg-gray-200 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              : leaveRecords.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <CalendarDays className="w-8 h-8 mx-auto text-[#9E9E9E] mb-2" />
                        <p className="text-sm text-[#9E9E9E]">No leave records</p>
                      </td>
                    </tr>
                  )
                : leaveRecords.map((lv) => (
                    <tr key={lv._id} className="border-b border-[var(--color-border)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">
                            {initialsFromName(lv.worker?.fullName)}
                          </div>
                          {lv.worker?.fullName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#616161]">{lv.teamLead?.fullName || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            lv.leaveType === 'SICK'
                              ? 'bg-red-50 text-red-800'
                              : lv.leaveType === 'CASUAL'
                                ? 'bg-blue-50 text-blue-800'
                                : lv.leaveType === 'EMERGENCY'
                                  ? 'bg-orange-50 text-orange-800'
                                  : 'bg-[#F9FBF7] text-[#616161]'
                          }`}
                        >
                          {lv.leaveType}
                        </span>
                      </td>
                      <td className="px-4 py-3">{format(new Date(lv.fromDate), 'MMM d')}</td>
                      <td className="px-4 py-3">{format(new Date(lv.toDate), 'MMM d')}</td>
                      <td className="px-4 py-3">{lv.totalDays} days</td>
                      <td
                        className="px-4 py-3 max-w-[140px] truncate"
                        title={lv.reason}
                      >
                        {lv.reason?.slice(0, 30)}
                        {(lv.reason?.length || 0) > 30 ? '…' : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            lv.status === 'PENDING'
                              ? 'bg-[#F9F3E0] text-[#5D4E00]'
                              : lv.status === 'APPROVED'
                                ? 'bg-[#E8F5E9] text-[#1B5E20]'
                                : 'bg-[#FFEBEE] text-[#B71C1C]'
                          }`}
                        >
                          {lv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
        </div>
        <div className="flex justify-between items-center p-4 border-t text-xs text-[#616161]">
          <span>
            Showing {(leavePage - 1) * 15 + 1}–{Math.min(leavePage * 15, leaveTotal)} of {leaveTotal}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={leavePage <= 1}
              onClick={() => fetchLeaveData(leavePage - 1)}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={leavePage * 15 >= leaveTotal}
              onClick={() => fetchLeaveData(leavePage + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const sectionMotion = (i) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay: i * 0.07 },
});

const TAB_OVERVIEW = 'overview';
const TAB_USERS = 'users';
const TAB_REPORTS = 'reports';
const TAB_ANALYTICS = 'analytics';
const TAB_LEAVE = 'leave';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const firstName = user?.fullName ? user.fullName.split(' ')[0] : '';
  const currentUser = user;
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);
  const location = useLocation();

  const [overviewStats, setOverviewStats] = useState(null);
  const [impactMetrics, setImpactMetrics] = useState(null);
  const [trend, setTrend] = useState([]);
  const [tasksByType, setTasksByType] = useState(null);
  const [activeTeamLeads, setActiveTeamLeads] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);

  const [loadOverview, setLoadOverview] = useState(true);
  const [loadImpact, setLoadImpact] = useState(true);
  const [loadTrend, setLoadTrend] = useState(true);
  const [loadTypes, setLoadTypes] = useState(true);
  const [loadLeads, setLoadLeads] = useState(true);
  const [loadAlerts, setLoadAlerts] = useState(true);

  const [errOverview, setErrOverview] = useState(false);
  const [errImpact, setErrImpact] = useState(false);
  const [errTrend, setErrTrend] = useState(false);
  const [errTypes, setErrTypes] = useState(false);
  const [errLeads, setErrLeads] = useState(false);
  const [errAlerts, setErrAlerts] = useState(false);

  const [lastRefreshAt, setLastRefreshAt] = useState(Date.now());

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState('ALL');
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [pendingLeads, setPendingLeads] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeReportsTab, setActiveReportsTab] = useState('ALL');
  const [requestedLeadIds, setRequestedLeadIds] = useState(() => new Set());

  const [analyticsFilters, setAnalyticsFilters] = useState({
    startDate: '',
    endDate: '',
    teamLeadId: '',
    taskType: '',
  });
  const [kpis, setKpis] = useState(null);
  const [analyticsTrend, setAnalyticsTrend] = useState([]);
  const [verification, setVerification] = useState(null);
  const [teamComparison, setTeamComparison] = useState([]);
  const [taskTypeData, setTaskTypeData] = useState([]);
  const [monthlyCompare, setMonthlyCompare] = useState(null);
  const [rawRecords, setRawRecords] = useState([]);
  const [rawTotal, setRawTotal] = useState(0);
  const [rawPage, setRawPage] = useState(1);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [leaveCalendar, setLeaveCalendar] = useState({});
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [leaveTotal, setLeaveTotal] = useState(0);
  const [leavePage, setLeavePage] = useState(1);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [calendarPopoverOpen, setCalendarPopoverOpen] = useState(false);
  const [leaveFilters, setLeaveFilters] = useState({
    status: '',
    leaveType: '',
    teamLeadId: '',
    startDate: '',
    endDate: '',
  });
  const [leaveLoading, setLeaveLoading] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoadOverview(true);
    setErrOverview(false);
    try {
      const response = await api.get('/admin/overview');
      const { data } = response.data;
      setOverviewStats(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load overview');
      setErrOverview(true);
    } finally {
      setLoadOverview(false);
    }
  }, []);

  const fetchImpact = useCallback(async () => {
    setLoadImpact(true);
    setErrImpact(false);
    try {
      const response = await api.get('/admin/impact-metrics');
      const { data } = response.data;
      setImpactMetrics(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load impact metrics');
      setErrImpact(true);
    } finally {
      setLoadImpact(false);
    }
  }, []);

  const fetchTrend = useCallback(async () => {
    setLoadTrend(true);
    setErrTrend(false);
    try {
      const response = await api.get('/admin/attendance-trend?days=7');
      const { data } = response.data;
      setTrend(data.trend || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load attendance trend');
      setErrTrend(true);
    } finally {
      setLoadTrend(false);
    }
  }, []);

  const fetchTypes = useCallback(async () => {
    setLoadTypes(true);
    setErrTypes(false);
    try {
      const response = await api.get('/admin/tasks-by-type');
      const { data } = response.data;
      setTasksByType(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load tasks by type');
      setErrTypes(true);
    } finally {
      setLoadTypes(false);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoadLeads(true);
    setErrLeads(false);
    try {
      const response = await api.get('/admin/active-teamleads');
      const { data } = response.data;
      setActiveTeamLeads(data.activeTeamLeads || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load team leads');
      setErrLeads(true);
    } finally {
      setLoadLeads(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoadAlerts(true);
    setErrAlerts(false);
    try {
      const response = await api.get('/admin/system-alerts');
      const { data } = response.data;
      setSystemAlerts(data.alerts || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load alerts');
      setErrAlerts(true);
    } finally {
      setLoadAlerts(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchOverview();
    fetchImpact();
    fetchTrend();
    fetchTypes();
    fetchLeads();
    fetchAlerts();
    setLastRefreshAt(Date.now());
  }, [fetchOverview, fetchImpact, fetchTrend, fetchTypes, fetchLeads, fetchAlerts]);

  const fetchUsersData = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await api.get('/admin/users');
      const { data } = response.data;
      setUsers(data.users || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchReportsData = useCallback(async () => {
    setReportsLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get('/admin/reports'),
        api.get('/admin/reports/pending-leads'),
      ]);
      setReports(r1.data.data.reports || []);
      setPendingLeads(r2.data.data.pendingLeads || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const buildAnalyticsQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (analyticsFilters.startDate) p.set('startDate', analyticsFilters.startDate);
    if (analyticsFilters.endDate) p.set('endDate', analyticsFilters.endDate);
    if (analyticsFilters.teamLeadId) p.set('teamLeadId', analyticsFilters.teamLeadId);
    if (analyticsFilters.taskType) p.set('taskType', analyticsFilters.taskType);
    return p.toString();
  }, [analyticsFilters]);

  const fetchAnalyticsData = useCallback(
    async (pageNum = 1) => {
      setAnalyticsLoading(true);
      const q = buildAnalyticsQuery();
      try {
        const [k, t, v, tc, tt, mc, raw] = await Promise.all([
          api.get(`/admin/analytics/kpis?${q}`),
          api.get(`/admin/analytics/trend?${q}`),
          api.get(`/admin/analytics/verification?${q}`),
          api.get(`/admin/analytics/team-comparison?${q}`),
          api.get(`/admin/analytics/task-type?${q}`),
          api.get(`/admin/analytics/monthly-compare?${q}`),
          api.get(`/admin/analytics/raw?${q}&page=${pageNum}&limit=15`),
        ]);
        setKpis(k.data.data);
        setAnalyticsTrend(t.data.data.trend || []);
        setVerification(v.data.data);
        setTeamComparison(tc.data.data.teams || []);
        setTaskTypeData(tt.data.data.taskTypes || []);
        setMonthlyCompare(mc.data.data);
        setRawRecords(raw.data.data.records || []);
        setRawTotal(raw.data.data.total || 0);
        setRawPage(raw.data.data.page || pageNum);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load analytics');
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [buildAnalyticsQuery]
  );

  const fetchLeaveData = useCallback(
    async (pageOverride) => {
      setLeaveLoading(true);
      const ym = format(currentCalendarMonth, 'yyyy-MM');
      const page = pageOverride !== undefined ? pageOverride : leavePage;
      const lf = new URLSearchParams();
      if (leaveFilters.status) lf.set('status', leaveFilters.status);
      if (leaveFilters.leaveType) lf.set('leaveType', leaveFilters.leaveType);
      if (leaveFilters.teamLeadId) lf.set('teamLeadId', leaveFilters.teamLeadId);
      if (leaveFilters.startDate) lf.set('startDate', leaveFilters.startDate);
      if (leaveFilters.endDate) lf.set('endDate', leaveFilters.endDate);
      lf.set('page', String(page));
      lf.set('limit', '15');
      try {
        const [c, s, rec] = await Promise.all([
          api.get(`/admin/leave/calendar?month=${ym}`),
          api.get('/admin/leave/summary'),
          api.get(`/admin/leave/records?${lf.toString()}`),
        ]);
        setLeaveCalendar(c.data.data.calendar || {});
        setLeaveSummary(s.data.data);
        setLeaveRecords(rec.data.data.records || []);
        setLeaveTotal(rec.data.data.total || 0);
        if (pageOverride !== undefined) setLeavePage(page);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load leave data');
      } finally {
        setLeaveLoading(false);
      }
    },
    [currentCalendarMonth, leaveFilters, leavePage]
  );

  useEffect(() => {
    if (activeTab !== TAB_OVERVIEW) return undefined;
    refreshAll();
    const id = setInterval(refreshAll, 300000);
    return () => clearInterval(id);
  }, [activeTab, refreshAll]);

  useEffect(() => {
    if (activeTab === TAB_USERS) fetchUsersData();
  }, [activeTab, fetchUsersData]);

  useEffect(() => {
    if (location.pathname.endsWith('/admin/users')) setActiveTab(TAB_USERS);
  }, [location.pathname]);

  useEffect(() => {
    if (activeTab === TAB_REPORTS) fetchReportsData();
  }, [activeTab, fetchReportsData]);

  useEffect(() => {
    if (activeTab === TAB_ANALYTICS) fetchAnalyticsData(1);
  }, [activeTab, fetchAnalyticsData]);

  useEffect(() => {
    if (activeTab === TAB_LEAVE) fetchLeaveData();
  }, [activeTab, fetchLeaveData]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const minutesAgo = useMemo(() => {
    void tick;
    const m = Math.floor((Date.now() - lastRefreshAt) / 60000);
    if (m <= 0) return 'just now';
    return `${m} min ago`;
  }, [lastRefreshAt, tick]);

  const wasteDelta = useMemo(() => {
    if (!impactMetrics) return 0;
    return Math.round((impactMetrics.wasteCollectedTonnes - impactMetrics.wasteCollectedLastMonthTonnes) * 10) / 10;
  }, [impactMetrics]);

  const drivesDelta = useMemo(() => {
    if (!impactMetrics) return 0;
    return impactMetrics.drivesCompleted - impactMetrics.drivesCompletedLastMonth;
  }, [impactMetrics]);

  const barData = useMemo(
    () => ({
      labels: trend.map((d) => d.date),
      datasets: [
        {
          label: 'Present',
          data: trend.map((d) => d.present),
          backgroundColor: '#246427CC',
          borderRadius: 3,
          barThickness: 10,
        },
        {
          label: 'Absent',
          data: trend.map((d) => d.absent),
          backgroundColor: '#C0392BCC',
          borderRadius: 3,
          barThickness: 10,
        },
      ],
    }),
    [trend]
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 8 },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f0f0f0' } },
      },
    }),
    []
  );

  const doughnutLabels = ['Waste Collection', 'Recycling', 'Awareness Drive', 'Other'];
  const doughnutData = useMemo(() => {
    const types = tasksByType?.types || [];
    return {
      labels: doughnutLabels,
      datasets: [
        {
          data: types.map((t) => t.count),
          backgroundColor: ['#246427', '#427A43', '#C0B87A', '#8BA88C'],
        },
      ],
    };
  }, [tasksByType]);

  const doughnutOptions = useMemo(
    () => ({
      cutout: '55%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
    }),
    []
  );

  const displayedLeads = activeTeamLeads.slice(0, 6);
  const totalTeamLeads = overviewStats?.totalTeamLeads ?? 0;

  const mapCounts = useMemo(() => {
    const inProgress = activeTeamLeads.filter((r) => r.taskStatus === 'ACTIVE').length;
    const completed = activeTeamLeads.filter((r) => r.taskStatus === 'COMPLETED').length;
    const pending = activeTeamLeads.filter(
      (r) => r.taskStatus && r.taskStatus !== 'ACTIVE' && r.taskStatus !== 'COMPLETED'
    ).length;
    return { inProgress, completed, pending };
  }, [activeTeamLeads]);

  const ringDash = ((overviewStats?.attendanceRate ?? 0) / 100) * RING_C;

  const teamLeadsFromUsers = useMemo(
    () => users.filter((u) => u.role === 'TEAM_LEAD'),
    [users]
  );

  const tabTitle =
    activeTab === TAB_OVERVIEW
      ? 'Overview'
      : activeTab === TAB_USERS
        ? 'User Management'
        : activeTab === TAB_REPORTS
          ? 'Reports Inbox'
          : activeTab === TAB_ANALYTICS
            ? 'Attendance Analytics'
            : 'Leave Overview';

  const navTabs = [
    { id: TAB_OVERVIEW, icon: LayoutDashboard, label: 'Overview' },
    { id: TAB_USERS, icon: Users, label: 'User Management' },
    { id: TAB_REPORTS, icon: Inbox, label: 'Reports Inbox' },
    { id: TAB_ANALYTICS, icon: BarChart2, label: 'Attendance Analytics' },
    { id: TAB_LEAVE, icon: CalendarDays, label: 'Leave Overview' },
  ];

  const filteredUsersTable = useMemo(() => {
    return users
      .filter((u) => activeRoleFilter === 'ALL' || u.role === activeRoleFilter)
      .filter(
        (u) =>
          (u.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.username || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [users, activeRoleFilter, searchQuery]);

  const handleToggleUserStatus = useCallback(async (u) => {
    const prev = u.isActive;
    setUsers((list) =>
      list.map((x) => (x._id === u._id ? { ...x, isActive: !x.isActive } : x))
    );
    try {
      await api.patch(`/admin/users/${u._id}/toggle`);
    } catch (err) {
      setUsers((list) => list.map((x) => (x._id === u._id ? { ...x, isActive: prev } : x)));
      toast.error(err.response?.data?.message || 'Update failed');
    }
  }, []);

  const roleCounts = useMemo(
    () => ({
      ALL: users.length,
      ADMIN: users.filter((u) => u.role === 'ADMIN').length,
      TEAM_LEAD: users.filter((u) => u.role === 'TEAM_LEAD').length,
      FIELD_WORKER: users.filter((u) => u.role === 'FIELD_WORKER').length,
    }),
    [users]
  );

  const rowVariants = {
    hidden: { opacity: 0, y: 8 },
    show: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.04 },
    }),
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#F9FDF7' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      <aside className={`fixed inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition duration-200 ease-in-out w-64 min-w-[256px] bg-white border-r border-[#E0E7DC] flex flex-col z-40`}>
        <div className="p-4 mb-4 bg-white border-b border-[#E0E7DC] flex items-center gap-2">
          <img src="/sahayog_icon.svg" alt="Sahayog" className="w-8 h-8 object-contain" />
          <h1 className="text-2xl font-bold text-[#246427]">Sahayog</h1>
        </div>
        <nav className="flex-1 space-y-1 px-4 overflow-y-auto">
          {navTabs.map(({ id, icon: Icon, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                className={`group flex items-center gap-3 px-[14px] py-[10px] w-full rounded-[10px] transition-all duration-200 text-left ${
                    active
                        ? 'bg-[#E8F5E9] text-[#246427] font-semibold'
                        : 'text-[#616161] hover:bg-[#F1F8E9] hover:text-[#246427]'
                }`}
              >
                <Icon className={`w-5 h-5 transition-colors ${active ? 'text-[#246427]' : 'text-[#9E9E9E] group-hover:text-[#246427]'}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 mt-auto border-t border-[#E0E7DC] bg-[#F9FBF7]">
          <button
              onClick={logout}
              className="flex items-center gap-3 px-[14px] py-[10px] w-full text-[#616161] hover:text-[#246427] hover:bg-[#F1F8E9] rounded-[10px] transition-colors font-medium group"
          >
              <LogOut className="w-5 h-5 text-[#9E9E9E] group-hover:text-[#246427] transition-colors" />
              <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
         <main 
            className="flex-1 overflow-y-auto relative w-full !max-w-none"
            style={{ background: 'linear-gradient(to bottom, #DCE9D5 0%, #F9FDF7 20%, #F9FDF7 100%)' }}
          >
            <header className="flex items-center gap-4 px-4 sm:px-8 z-30 py-4" style={{ background: 'transparent' }}>
                <button 
                  className="lg:hidden p-2 -ml-2 text-[#616161]" 
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-6 h-6" />
                </button>
                {activeTab === TAB_OVERVIEW ? (
                    <div className="flex items-center justify-between w-full">
                        <div>
                            <h1 className="text-[1.5rem] font-bold text-[#212121]">
                                Welcome, <span className="text-[#246427] font-bold">{firstName}!</span>
                            </h1>
                            <p className="text-[0.75rem] text-[#616161] font-medium uppercase tracking-wider">
                                SAHAYOG ADMINISTRATOR
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <h1 className="text-[1.5rem] font-bold text-[#212121] leading-tight">
                            {navTabs.find(t => t.id === activeTab)?.label}
                        </h1>
                    </div>
                )}
            </header>

            <div className="pt-[8px] px-[24px] pb-[24px]">
          {activeTab === TAB_OVERVIEW && (
            <>
          {/* KPI row */}
          <motion.div {...sectionMotion(0)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-[16px] mb-[16px]">
            {[
              {
                label: 'Field Workers',
                value: overviewStats?.totalFieldWorkers || 0,
                sub: `↑ ${overviewStats?.newWorkersThisMonth || 0} this month`,
                Icon: Users,
                load: loadOverview,
                err: errOverview,
              },
              {
                label: 'Team Leads',
                value: overviewStats?.totalTeamLeads || 0,
                sub: `${overviewStats?.teamLeadsActiveToday || 0} active today`,
                Icon: UserCheck,
                load: loadOverview,
                err: errOverview,
              },
              {
                label: 'Tasks done',
                value: overviewStats ? `${overviewStats.tasksCompletedThisMonth}/${overviewStats.tasksThisMonth}` : '0/0',
                sub: overviewStats?.tasksThisMonth > 0
                  ? `${Math.round((overviewStats.tasksCompletedThisMonth / overviewStats.tasksThisMonth) * 100)}% done`
                  : '0% done',
                Icon: CheckSquare,
                load: loadOverview,
                err: errOverview,
              },
              {
                label: 'Attendance Rate',
                value: overviewStats ? `${overviewStats.attendanceRate}%` : '0%',
                sub: 'Verified history',
                Icon: TrendingUp,
                load: loadOverview,
                err: errOverview,
              },
              {
                label: 'NGO Impact',
                value: impactMetrics ? `${impactMetrics.wasteCollectedTonnes}t` : '0t',
                sub: `${wasteDelta >= 0 ? '↑' : '↓'} ${Math.abs(wasteDelta)}t vs last mo`,
                Icon: Leaf,
                load: loadImpact,
                err: errImpact,
              },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#FFFFFF] border border-[#E0E7DC] rounded-[20px] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col gap-2 overflow-visible"
              >
                <div className="flex items-center gap-3">
                  <card.Icon className="w-[22px] h-[22px] text-[#246427]" strokeWidth={2.5} />
                  {card.load ? (
                    <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />
                  ) : card.err ? (
                    <span className="text-xs text-red-500">Error</span>
                  ) : (
                    <p className="text-[1.375rem] font-[700] text-[#212121] leading-tight truncate">
                      {card.value}
                    </p>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[0.75rem] font-[600] tracking-[0.04em] uppercase text-[#616161] truncate line-clamp-1">
                    {card.label}
                  </p>
                  {card.sub ? (
                    <p className="text-[0.65rem] text-[#9E9E9E] mt-0.5 truncate line-clamp-1">{card.sub}</p>
                  ) : null}
                  {card.err && (
                    <button type="button" className="text-[10px] text-[#246427] text-left mt-1" onClick={card.label === 'NGO Impact' ? fetchImpact : fetchOverview}>
                      Retry
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Charts */}
          <motion.div {...sectionMotion(1)} className="grid grid-cols-1 lg:grid-cols-[58%_1fr] gap-[16px] mb-[16px]">
            <div className="bg-[#FFFFFF] border border-[#E0E7DC] rounded-[14px] px-[24px] py-[20px] shadow-[0_2px_12px_rgba(36,100,39,0.07)] overflow-visible">
              <div className="text-[0.9375rem] font-[600] text-[#212121] mb-[16px]">Attendance trend — last 7 days</div>
              {loadTrend ? (
                <div className="min-h-[220px] animate-pulse bg-gray-200 rounded-[14px]" />
              ) : errTrend ? (
                <div className="text-[0.8125rem] text-[#616161] py-8 text-center min-h-[220px]">
                  Failed to load
                  <button type="button" className="block mx-auto mt-1 text-[#246427]" onClick={fetchTrend}>
                    Retry
                  </button>
                </div>
              ) : (
                <div className="min-h-[220px]">
                  <Bar data={barData} options={barOptions} />
                </div>
              )}
            </div>
            <div className="bg-[#FFFFFF] border border-[#E0E7DC] rounded-[14px] px-[24px] py-[20px] shadow-[0_2px_12px_rgba(36,100,39,0.07)] overflow-visible">
              <div className="text-[0.9375rem] font-[600] text-[#212121] mb-[16px]">Tasks by type</div>
              {loadTypes ? (
                <div className="min-h-[220px] animate-pulse bg-gray-200 rounded-[14px]" />
              ) : errTypes ? (
                <div className="text-[0.8125rem] text-[#616161] py-8 text-center min-h-[220px]">
                  Failed to load
                  <button type="button" className="block mx-auto mt-1 text-[#246427]" onClick={fetchTypes}>
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-h-[220px]">
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                  </div>
                  <div className="mt-[16px] space-y-1">
                    {(tasksByType?.types || []).map((t, idx) => (
                      <div key={t.type} className="flex items-center justify-between text-[0.8125rem]">
                        <span className="flex items-center gap-1.5 text-[#616161]">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: ['#246427', '#427A43', '#C0B87A', '#8BA88C'][idx],
                            }}
                          />
                          {doughnutLabels[idx]}
                        </span>
                        <span className="text-[#616161]">{t.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Active team leads */}
          <motion.div {...sectionMotion(2)} className="bg-[#FFFFFF] border border-[#E0E7DC] rounded-[14px] px-[24px] py-[20px] shadow-[0_2px_12px_rgba(36,100,39,0.07)] mb-[16px] overflow-visible">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.9375rem] font-medium text-[#212121]">Active team leads today</span>
              <span className="text-[0.8125rem] text-[#9E9E9E]">
                {activeTeamLeads.length} of {totalTeamLeads} on duty
              </span>
            </div>
            {loadLeads ? (
              <div className="h-32 animate-pulse bg-gray-200 rounded-[14px]" />
            ) : errLeads ? (
              <div className="text-[10px] text-[#616161] py-6 text-center">
                Failed to load
                <button type="button" className="block mx-auto mt-1 text-[#246427]" onClick={fetchLeads}>
                  Retry
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid grid-cols-[2fr_1fr_2fr] divide-x divide-gray-100 min-w-[600px]">
                  <div className="pr-3">
                  {displayedLeads.map((row, idx) => (
                    <motion.div
                      key={row.id + row.todayTask}
                      custom={idx}
                      variants={rowVariants}
                      initial="hidden"
                      animate="show"
                      className="flex items-center gap-2 py-2 border-b border-[var(--color-border)] last:border-0"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.8125rem] font-medium text-white ${rowAvatarColors[idx % rowAvatarColors.length]}`}
                      >
                        {row.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[0.875rem] font-medium text-[#212121] truncate">{row.name}</div>
                        <div className="text-[0.8125rem] text-[#616161] truncate">{row.todayTask}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="px-3">
                  {displayedLeads.map((row, idx) => {
                    const chip = taskTypeChip(row.taskType);
                    return (
                      <motion.div
                        key={`c-${row.id}-${idx}`}
                        custom={idx}
                        variants={rowVariants}
                        initial="hidden"
                        animate="show"
                        className="flex items-center py-2 border-b border-[var(--color-border)] last:border-0 min-h-[52px]"
                      >
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.8125rem] font-medium ${chip.cls}`}
                        >
                          {chip.label}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="pl-3">
                  <div className="text-[0.8125rem] text-[#9E9E9E] mb-1 hidden sm:block">Workers / Hrs / Done</div>
                  {displayedLeads.map((row, idx) => (
                    <motion.div
                      key={`s-${row.id}-${idx}`}
                      custom={idx}
                      variants={rowVariants}
                      initial="hidden"
                      animate="show"
                      className="flex items-center gap-2 py-2 border-b border-[var(--color-border)] last:border-0 min-h-[52px]"
                    >
                      <span className="text-[0.8125rem] text-[#616161] whitespace-nowrap">
                        {row.workersAssigned} workers
                      </span>
                      <span className="text-[#9E9E9E]">·</span>
                      <span className="text-[0.8125rem] text-[#616161]">{row.hoursLogged} hrs</span>
                      <span className="text-[#9E9E9E]">·</span>
                      <div className="w-14 h-1 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                        <div
                          className="h-1 bg-[#246427] rounded-full"
                          style={{ width: `${row.completionRate}%` }}
                        />
                      </div>
                      <span className="text-[0.6875rem] text-[#9E9E9E] text-right w-7">{row.completionRate}%</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              </div>
            )}
            {activeTeamLeads.length > 6 ? (
              <button
                type="button"
                onClick={() => setActiveTab(TAB_USERS)}
                className="text-[0.8125rem] text-[#246427] mt-2"
              >
                View all team leads →
              </button>
            ) : null}
          </motion.div>

          {/* Impact metrics */}
          <motion.div {...sectionMotion(3)} className="grid grid-cols-1 sm:grid-cols-3 gap-[16px] mb-[16px]">
            {[
              {
                key: 'waste',
                label: 'Waste collected',
                icon: Leaf,
                iconBg: 'bg-[#E8F5E9]',
                iconColor: '#246427',
                loading: loadImpact,
                error: errImpact,
                onRetry: fetchImpact,
                content: impactMetrics ? (
                  <>
                    <div className="text-[1.75rem] font-[700] text-[#212121] mb-[6px]">
                      {impactMetrics.wasteCollectedTonnes}t
                    </div>
                    <div className="text-[0.8125rem] text-[#616161]">
                      {wasteDelta >= 0 ? '↑' : '↓'} {Math.abs(wasteDelta)}t vs last month
                    </div>
                  </>
                ) : null,
              },
              {
                key: 'drives',
                label: 'Field drives',
                icon: CheckSquare,
                iconBg: 'bg-[#E3F2FD]',
                iconColor: '#1565C0',
                loading: loadImpact,
                error: errImpact,
                onRetry: fetchImpact,
                content: impactMetrics ? (
                  <>
                    <div className="text-[1.75rem] font-[700] text-[#212121] mb-[6px]">
                      {impactMetrics.drivesCompleted}
                    </div>
                    <div className="text-[0.8125rem] text-[#616161]">
                      {drivesDelta >= 0 ? '↑' : '↓'} {Math.abs(drivesDelta)} vs last month
                    </div>
                  </>
                ) : null,
              },
              {
                key: 'hours',
                label: 'Total field hours',
                icon: Clock,
                iconBg: 'bg-[#F9F3E0]',
                iconColor: '#5D4E00',
                loading: loadImpact,
                error: errImpact,
                onRetry: fetchImpact,
                content: impactMetrics ? (
                  <>
                    <div className="text-[1.75rem] font-[700] text-[#212121] mb-[6px]">
                      {impactMetrics.totalFieldHours.toLocaleString()}
                    </div>
                    <div className="text-[0.8125rem] text-[#616161]">
                      Avg {impactMetrics.avgHoursPerWorker} hrs/worker
                    </div>
                  </>
                ) : null,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className="bg-[#FFFFFF] border border-[#E0E7DC] rounded-[14px] px-[24px] py-[20px] min-h-[100px] shadow-[0_2px_12px_rgba(36,100,39,0.07)] flex flex-col justify-between overflow-visible"
                >
                  <div className="flex items-center justify-between pointer-events-none w-full">
                    <span className="text-[0.6875rem] font-[600] tracking-[0.06em] uppercase text-[#616161]">{card.label}</span>
                      <Icon className="w-[24px] h-[24px] text-[#246427]" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col min-w-0 mt-auto">
                    {card.loading ? (
                      <div className="animate-pulse space-y-1 w-20">
                        <div className="h-4 bg-gray-200 rounded" />
                        <div className="h-2 bg-gray-200 rounded w-2/3" />
                      </div>
                    ) : card.error ? (
                      <div className="text-[10px] text-[#616161]">
                        Error
                        <button type="button" className="block text-[#246427]" onClick={card.onRetry}>
                          Retry
                        </button>
                      </div>
                    ) : (
                      card.content
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Map + alerts */}
          <motion.div {...sectionMotion(4)} className="grid grid-cols-1 lg:grid-cols-[60%_1fr] gap-[16px]">
            <div className="bg-[#FFFFFF] border border-[#E0E7DC] rounded-[14px] px-[24px] py-[20px] shadow-[0_2px_12px_rgba(36,100,39,0.07)] overflow-hidden">
              <div className="flex items-center justify-between mb-[16px]">
                <span className="text-[0.9375rem] font-[600] text-[#212121]">Active task locations today</span>
                <span className="text-[0.8125rem] text-[#9E9E9E]">
                  {mapCounts.inProgress} active · {mapCounts.completed} completed · {mapCounts.pending} pending
                </span>
              </div>
              <iframe
                title="Task locations map"
                src="https://www.openstreetmap.org/export/embed.html?bbox=72.7,18.9,73.0,19.1&layer=mapnik"
                className="w-full min-h-[220px] rounded-[10px] border border-[#E0E7DC]"
              />
              <p className="text-[0.8125rem] text-[#9E9E9E] text-center mt-1">
                Live task pins require map integration
              </p>
              <div className="flex gap-3 mt-2">
                <span className="flex items-center gap-1 text-[0.8125rem] text-[#616161]">
                  <span className="w-2 h-2 rounded-full bg-[#246427]" />
                  In progress
                </span>
                <span className="flex items-center gap-1 text-[0.8125rem] text-[#616161]">
                  <span className="w-2 h-2 rounded-full bg-[#C0B87A]" />
                  Pending start
                </span>
                <span className="flex items-center gap-1 text-[0.8125rem] text-[#616161]">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  Completed
                </span>
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E0E7DC] rounded-[14px] px-[24px] py-[20px] shadow-[0_2px_12px_rgba(36,100,39,0.07)] flex flex-col overflow-visible min-h-[220px]">
              <div className="text-[0.9375rem] font-[600] text-[#212121] mb-[16px]">System alerts</div>
              {loadAlerts ? (
                <div className="space-y-2 flex-1">
                  {[1, 2, 3].map((k) => (
                    <div key={k} className="h-6 animate-pulse bg-gray-200 rounded" />
                  ))}
                </div>
              ) : errAlerts ? (
                <div className="text-[0.8125rem] text-[#616161] py-4">
                  Failed to load
                  <button type="button" className="block mt-1 text-[#246427]" onClick={fetchAlerts}>
                    Retry
                  </button>
                </div>
              ) : systemAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-6 text-center">
                  <CheckCircle className="w-8 h-8 text-[#246427] mb-2" />
                  <span className="text-[0.8125rem] text-[#616161]">All systems normal</span>
                </div>
              ) : (
                <div className="flex flex-col flex-1">
                  {systemAlerts.map((alert) => (
                    <div
                      key={`${alert.type}-${alert.message}`}
                      className="flex items-start gap-2 py-1.5 border-b border-[var(--color-border)] last:border-0"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                          alert.severity === 'critical'
                            ? 'bg-[#C0392B]'
                            : alert.severity === 'warning'
                              ? 'bg-[#E67E22]'
                              : 'bg-gray-400'
                        }`}
                      />
                      <span className="text-[0.8125rem] text-[#212121] leading-snug flex-1">{alert.message}</span>
                      <span className="text-[0.8125rem] text-[#9E9E9E] whitespace-nowrap pl-1">
                        {formatAlertAgo(alert.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-right mt-2">
                <button type="button" className="text-[0.8125rem] text-[#246427]">
                  View all alerts →
                </button>
              </div>
            </div>
          </motion.div>
            </>
          )}

          {activeTab === TAB_USERS && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-4">
                <input
                  type="text"
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-[#E0E7DC] rounded-[10px] px-3 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[#005F02]"
                />
                <div className="flex gap-1">
                  {[
                    { k: 'ALL', l: 'All' },
                    { k: 'ADMIN', l: 'Admins' },
                    { k: 'TEAM_LEAD', l: 'Team Leads' },
                    { k: 'FIELD_WORKER', l: 'Field Workers' },
                  ].map(({ k, l }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActiveRoleFilter(k)}
                      className={`px-3 py-1.5 rounded-[10px] text-xs cursor-pointer ${
                        activeRoleFilter === k
                          ? 'bg-[#246427] text-white'
                          : 'bg-[#F9FBF7] text-[#616161] hover:bg-gray-200'
                      }`}
                    >
                      {l} ({roleCounts[k]})
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-[14px] border border-[#E0E7DC] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-[#F9FBF7] border-b border-[#E0E7DC]">
                    <tr>
                      {['User', 'Username', 'Role', 'Status', 'Team Lead'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-[#616161]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading
                      ? [1, 2, 3, 4, 5].map((i) => (
                          <tr key={i} className="border-b border-[var(--color-border)]">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="h-8 animate-pulse bg-gray-200 rounded" />
                            </td>
                          </tr>
                        ))
                      : filteredUsersTable.length === 0
                        ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-12 text-center">
                                <Users className="w-8 h-8 mx-auto text-[#9E9E9E] mb-2" />
                                <p className="text-sm text-[#9E9E9E]">No users found</p>
                                <p className="text-xs text-[#9E9E9E] mt-1">Try adjusting filters</p>
                              </td>
                            </tr>
                          )
                        : filteredUsersTable.map((u) => {
                            const roleBadge = (role) => {
                              if (role === 'ADMIN')
                                return 'bg-purple-100 text-purple-800';
                              if (role === 'TEAM_LEAD') return 'bg-blue-100 text-blue-800';
                              return 'bg-[#E8F5E9] text-[#1B5E20]';
                            };
                            return (
                              <tr
                                key={u._id}
                                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#F9FBF7]"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setSelectedUser(u);
                                  setEditDrawerOpen(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    setSelectedUser(u);
                                    setEditDrawerOpen(true);
                                  }
                                }}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.9375rem] font-medium ${roleBadge(u.role)}`}
                                    >
                                      {initialsFromName(u.fullName)}
                                    </div>
                                    <span className="text-sm font-medium text-[#212121] ml-2">
                                      {u.fullName}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-[#616161]">{u.username}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(u.role)}`}
                                  >
                                    {u.role}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                      u.isActive
                                        ? 'bg-[#E8F5E9] text-[#1B5E20]'
                                        : 'bg-[#F9FBF7] text-[#616161]'
                                    }`}
                                  >
                                    {u.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {u.role === 'FIELD_WORKER' ? (
                                    u.assignedTeamLead ? (
                                      <span className="text-[10px] font-medium text-[#246427] bg-[#F2E3BB] px-2 py-1 rounded-full">
                                        {u.assignedTeamLead?.fullName || u.assignedTeamLead}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-[#9E9E9E]">—</span>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-[#9E9E9E]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                  </tbody>
                </table>
                </div>
              </div>
              {editDrawerOpen && selectedUser && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 bg-black/20 z-40"
                    aria-label="Close drawer overlay"
                    onClick={() => setEditDrawerOpen(false)}
                  />
                  <div className="fixed right-0 top-0 h-full w-[380px] bg-white z-50 shadow-[var(--shadow-md)] flex flex-col">
                    <div className="p-5 border-b border-[#E0E7DC] flex justify-between items-center">
                      <span className="text-base font-medium text-[#212121]">Edit User</span>
                      <button type="button" onClick={() => setEditDrawerOpen(false)}>
                        <X className="w-5 h-5 text-[#616161]" />
                      </button>
                    </div>
                    <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
                      <div>
                        <label className="text-xs text-[#616161] mb-1 block">Full Name</label>
                        <input
                          type="text"
                          value={selectedUser.fullName || ''}
                          onChange={(e) =>
                            setSelectedUser({ ...selectedUser, fullName: e.target.value })
                          }
                          className="w-full border border-[#E0E7DC] rounded-[10px] px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#616161] mb-1 block">Role</label>
                        <div className="flex gap-2 flex-wrap">
                          {['ADMIN', 'TEAM_LEAD', 'FIELD_WORKER'].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setSelectedUser({ ...selectedUser, role: r })}
                              className={`px-3 py-1 rounded-[10px] text-xs ${
                                selectedUser.role === r
                                  ? 'bg-[#246427] text-white'
                                  : 'bg-[#F9FBF7] text-[#616161]'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      {selectedUser.role === 'FIELD_WORKER' && (
                        <div>
                          <label className="text-xs text-[#616161] mb-1 block">
                            Assign to Team Lead
                          </label>
                          <select
                            value={selectedUser.assignedTeamLead?._id || ''}
                            onChange={(e) => {
                              const id = e.target.value;
                              const lead = teamLeadsFromUsers.find((l) => l._id === id);
                              setSelectedUser({
                                ...selectedUser,
                                assignedTeamLead: id
                                  ? { _id: id, fullName: lead?.fullName }
                                  : null,
                              });
                            }}
                            className="w-full border border-[#E0E7DC] rounded-[10px] px-3 py-2 text-sm"
                          >
                            <option value="">— None —</option>
                            {teamLeadsFromUsers.map((l) => (
                              <option key={l._id} value={l._id}>
                                {l.fullName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#616161]">Account Status</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUser({ ...selectedUser, isActive: !selectedUser.isActive })
                          }
                          className={`relative w-9 h-5 rounded-full transition-colors ${
                            selectedUser.isActive ? 'bg-[#246427]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              selectedUser.isActive ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                      <span className="text-xs text-[#616161]">
                        {selectedUser.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="p-5 border-t border-[#E0E7DC] flex gap-3">
                      <button
                        type="button"
                        onClick={() => setEditDrawerOpen(false)}
                        className="flex-1 border border-[#E0E7DC] rounded-[10px] py-2 text-sm text-[#212121]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.patch(`/admin/users/${selectedUser._id}`, {
                              fullName: selectedUser.fullName,
                              role: selectedUser.role,
                              assignedTeamLead: selectedUser.assignedTeamLead?._id || null,
                              isActive: selectedUser.isActive,
                            });
                            toast.success('User updated');
                            setEditDrawerOpen(false);
                            fetchUsersData();
                          } catch (err) {
                            toast.error(err.response?.data?.message || 'Update failed');
                          }
                        }}
                        className="flex-1 bg-[#246427] text-white rounded-[10px] py-2 text-sm"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === TAB_REPORTS && (
            <ReportsInboxTab
              reports={reports}
              reportsLoading={reportsLoading}
              pendingLeads={pendingLeads}
              selectedReport={selectedReport}
              setSelectedReport={setSelectedReport}
              reportModalOpen={reportModalOpen}
              setReportModalOpen={setReportModalOpen}
              activeReportsTab={activeReportsTab}
              setActiveReportsTab={setActiveReportsTab}
              requestedLeadIds={requestedLeadIds}
              setRequestedLeadIds={setRequestedLeadIds}
              setReports={setReports}
            />
          )}

          {activeTab === TAB_ANALYTICS && (
            <AnalyticsTab
              analyticsFilters={analyticsFilters}
              setAnalyticsFilters={setAnalyticsFilters}
              kpis={kpis}
              analyticsTrend={analyticsTrend}
              verification={verification}
              teamComparison={teamComparison}
              taskTypeData={taskTypeData}
              monthlyCompare={monthlyCompare}
              rawRecords={rawRecords}
              rawTotal={rawTotal}
              rawPage={rawPage}
              setRawPage={setRawPage}
              analyticsLoading={analyticsLoading}
              teamLeadsFromUsers={teamLeadsFromUsers}
              fetchAnalyticsData={fetchAnalyticsData}
            />
          )}

          {activeTab === TAB_LEAVE && (
            <LeaveTab
              leaveCalendar={leaveCalendar}
              leaveSummary={leaveSummary}
              leaveRecords={leaveRecords}
              leaveTotal={leaveTotal}
              leavePage={leavePage}
              setLeavePage={setLeavePage}
              currentCalendarMonth={currentCalendarMonth}
              setCurrentCalendarMonth={setCurrentCalendarMonth}
              selectedCalendarDay={selectedCalendarDay}
              setSelectedCalendarDay={setSelectedCalendarDay}
              calendarPopoverOpen={calendarPopoverOpen}
              setCalendarPopoverOpen={setCalendarPopoverOpen}
              leaveFilters={leaveFilters}
              setLeaveFilters={setLeaveFilters}
              leaveLoading={leaveLoading}
              fetchLeaveData={fetchLeaveData}
              teamLeadsFromUsers={teamLeadsFromUsers}
            />
          )}
            </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;

