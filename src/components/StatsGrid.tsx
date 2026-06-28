import { Activity, Server, ShieldAlert, Wifi } from "lucide-react";
import { SystemStats } from "../types.js";
import { motion } from "motion/react";

interface StatsGridProps {
  stats: SystemStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const cards = [
    {
      id: "stat-uptime",
      name: "Overall Network Uptime",
      value: `${stats.overallUptime}%`,
      sub: "Average across active monitors",
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-white border-slate-200 border-l-4 border-l-emerald-500 shadow-sm",
      iconBg: "bg-emerald-50",
    },
    {
      id: "stat-latency",
      name: "Average Latency",
      value: `${stats.averageLatency} ms`,
      sub: "RTT for all responding devices",
      icon: Wifi,
      color: "text-blue-600",
      bg: "bg-white border-slate-200 border-l-4 border-l-blue-500 shadow-sm",
      iconBg: "bg-blue-50",
    },
    {
      id: "stat-monitors",
      name: "Active Monitors",
      value: `${stats.onlineDevices} / ${stats.totalDevices}`,
      sub: `${stats.offlineDevices} offline, ${stats.totalDevices - stats.onlineDevices - stats.offlineDevices} disabled`,
      icon: Server,
      color: "text-indigo-600",
      bg: "bg-white border-slate-200 border-l-4 border-l-indigo-500 shadow-sm",
      iconBg: "bg-indigo-50",
    },
    {
      id: "stat-alerts",
      name: "Active Outages",
      value: stats.activeAlertsCount.toString(),
      sub: stats.activeAlertsCount > 0 ? "Requires immediate troubleshooting" : "All systems functioning normally",
      icon: ShieldAlert,
      color: stats.activeAlertsCount > 0 ? "text-rose-600" : "text-slate-500",
      bg: stats.activeAlertsCount > 0 
        ? "bg-white border-slate-200 border-l-4 border-l-rose-500 shadow-sm shadow-rose-100" 
        : "bg-white border-slate-200 border-l-4 border-l-slate-300 shadow-sm",
      iconBg: stats.activeAlertsCount > 0 ? "bg-rose-50" : "bg-slate-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.id}
            id={card.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`border rounded-lg p-5 ${card.bg} flex items-center justify-between transition-all hover:shadow-md`}
          >
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.name}</span>
              <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{card.value}</h3>
              <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
            </div>
            <div className={`p-3 rounded-lg ${card.iconBg} ${card.color}`}>
              <Icon className="w-6 h-6" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
