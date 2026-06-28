import { useState } from "react";
import { AlertEvent } from "../types.js";
import { AlertTriangle, CheckCircle2, ShieldCheck, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AlertsPanelProps {
  alerts: AlertEvent[];
  onClearResolved: () => void;
}

type FilterType = "all" | "outages" | "resolved";

export default function AlertsPanel({ alerts, onClearResolved }: AlertsPanelProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "outages") return alert.type === "downtime" && !alert.resolved;
    if (filter === "resolved") return alert.resolved;
    return true;
  });

  const activeOutages = alerts.filter((a) => a.type === "downtime" && !a.resolved);
  const resolvedCount = alerts.filter((a) => a.resolved).length;

  return (
    <div id="alerts-panel" className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm h-[440px] flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div>
          <span className="text-[10px] font-bold text-rose-600 tracking-wider uppercase font-mono">Operations Alarms</span>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            System Alerts
            {activeOutages.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                {activeOutages.length} Active
              </span>
            )}
          </h3>
        </div>
        
        {resolvedCount > 0 && (
          <button
            onClick={onClearResolved}
            className="flex items-center gap-1 text-xs font-mono text-slate-600 hover:text-slate-900 transition bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200"
            title="Clear resolved warnings from history log"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Flush Resolved</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-3.5 text-xs font-mono">
        {(["all", "outages", "resolved"] as FilterType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded transition capitalize ${
              filter === tab
                ? "bg-slate-100 text-slate-800 border border-slate-200 font-bold"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab === "all" ? "All History" : tab === "outages" ? "Active Outages" : "Resolved"}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
        <AnimatePresence initial={false}>
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`p-3 rounded-lg border flex items-start gap-3 text-xs ${
                alert.type === "downtime" && !alert.resolved
                  ? "bg-rose-50 border-rose-100 text-rose-900"
                  : "bg-emerald-50 border-emerald-100 text-emerald-900"
              }`}
            >
              <div className="mt-0.5">
                {alert.type === "downtime" && !alert.resolved ? (
                  <div className="relative">
                    <span className="absolute inline-flex h-2 w-2 rounded-full bg-rose-400 opacity-75 animate-ping"></span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-slate-800 truncate font-sans">
                    {alert.deviceName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">{alert.message}</p>
                {alert.resolved && alert.resolvedAt && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-600 font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>
                      Resolved at {new Date(alert.resolvedAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredAlerts.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
            <ShieldCheck className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-mono">No alert entries found matching filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
