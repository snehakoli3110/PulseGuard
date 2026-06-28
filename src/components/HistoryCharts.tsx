import { useState, useEffect } from "react";
import { Device, PingLog } from "../types.js";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Calendar, Clock, RefreshCw, Zap } from "lucide-react";
import { motion } from "motion/react";

interface HistoryChartsProps {
  selectedDevice: Device | null;
}

export default function HistoryCharts({ selectedDevice }: HistoryChartsProps) {
  const [history, setHistory] = useState<PingLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedDevice) {
      setHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/devices/${selectedDevice.id}/history`);
        if (res.ok) {
          const data = await res.json();
          // Sort chronologically
          const sorted = data.sort((a: PingLog, b: PingLog) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setHistory(sorted);
        }
      } catch (err) {
        console.error("Error fetching device history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    // Set up rapid updates for active charts
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [selectedDevice]);

  if (!selectedDevice) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center h-[340px] shadow-sm">
        <Zap className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
        <h4 className="text-slate-700 font-semibold font-display">Select a device to view connection trends</h4>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Click any active device card below to view detailed latency history, success rates, and live response statistics.
        </p>
      </div>
    );
  }

  // Format timestamps nicely for chart label (hh:mm:ss)
  const chartData = history.map((log) => {
    const d = new Date(log.timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return {
      time: timeStr,
      latency: log.status === "online" ? log.latency : 0,
      status: log.status,
      timestamp: log.timestamp
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xl text-xs font-mono">
          <p className="text-slate-600 font-sans flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> {data.time}
          </p>
          <div className="space-y-1">
            <p className="flex justify-between gap-6">
              <span className="text-slate-400">Status:</span>
              <span className={data.status === "online" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                {data.status.toUpperCase()}
              </span>
            </p>
            {data.status === "online" && (
              <p className="flex justify-between gap-6">
                <span className="text-slate-400">Latency:</span>
                <span className="text-blue-600 font-bold">{data.latency} ms</span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="chart-panel" className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <span className="text-[10px] font-bold text-blue-600 tracking-wider uppercase font-mono">Real-time Connection Metrics</span>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            {selectedDevice.name}
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {selectedDevice.ipAddress}
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span>Live Interval: {selectedDevice.pingInterval}s</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Success Rate: <strong className="text-emerald-600">{selectedDevice.uptimePercentage}%</strong></span>
          </div>
        </div>
      </div>

      {/* Latency Trend Area Chart */}
      <div className="h-[200px] w-full relative">
        {loading && history.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-10">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
            Awaiting check history... Once pinged, latency analytics will render here.
          </div>
        ) : null}

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              unit="ms"
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="latency" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#latencyGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Grid of last 50 pings */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider font-mono">
          Packet Verification Log (Recent 50 pings)
        </h4>
        <div className="flex flex-wrap gap-1">
          {history.map((log) => (
            <div
              key={log.id}
              className={`w-3.5 h-6 rounded-sm border cursor-help transition-all duration-200 hover:scale-125 ${
                log.status === "online"
                  ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-500"
                  : "bg-rose-50 border-rose-200 hover:bg-rose-500"
              }`}
              title={`${new Date(log.timestamp).toLocaleTimeString()} - ${
                log.status === "online" ? `${log.latency}ms` : "Offline (Timeout)"
              }`}
            />
          ))}
          {history.length === 0 && (
            <p className="text-xs text-slate-400 italic">No packet log data recorded yet.</p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2.5 text-[10px] text-slate-400 font-mono">
          <span>Oldest Check</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-200 inline-block"></span> Success
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-50 border border-rose-200 inline-block"></span> Timeout
            </span>
          </div>
          <span>Most Recent</span>
        </div>
      </div>
    </div>
  );
}
