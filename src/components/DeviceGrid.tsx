import { useState } from "react";
import { Device } from "../types.js";
import { 
  Database, Server, Cpu, Router, Network, HardDrive, 
  Trash2, Edit3, Pause, Play, AlertCircle, Grid, List, Activity
} from "lucide-react";
import { motion } from "motion/react";

interface DeviceGridProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (id: string) => void;
  onToggleEnable: (device: Device) => void;
  onToggleSimulation: (device: Device) => void;
}

export default function DeviceGrid({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onEditDevice,
  onDeleteDevice,
  onToggleEnable,
  onToggleSimulation,
}: DeviceGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Helper to resolve device icon
  const getDeviceIcon = (type: Device["type"]) => {
    switch (type) {
      case "router":
        return Router;
      case "server":
        return Server;
      case "database":
        return Database;
      case "switch":
        return Network;
      case "iot":
        return Cpu;
      default:
        return HardDrive;
    }
  };

  const getStatusBadge = (status: Device["status"], enabled: boolean) => {
    if (!enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          PAUSED
        </span>
      );
    }
    switch (status) {
      case "online":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ONLINE
          </span>
        );
      case "offline":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            OUTAGE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 font-mono animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Grid Controls Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-800 font-display">Monitored Devices ({devices.length})</h2>
        </div>
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded transition ${
              viewMode === "grid" ? "bg-white text-slate-800 shadow-sm font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
            title="Card View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded transition ${
              viewMode === "table" ? "bg-white text-slate-800 shadow-sm font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
            title="Table List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices.map((device) => {
            const Icon = getDeviceIcon(device.type);
            const isSelected = selectedDeviceId === device.id;

            return (
              <motion.div
                key={device.id}
                id={`device-card-${device.id}`}
                layoutId={`device-card-${device.id}`}
                whileHover={{ scale: 1.01 }}
                onClick={() => onSelectDevice(device)}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected 
                    ? "bg-blue-50/30 border-blue-500 shadow-md" 
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                } relative overflow-hidden`}
              >
                {/* Latency glow background in case of online */}
                {device.status === "online" && device.enabled && isSelected && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
                )}
                
                <div className="flex items-start justify-between gap-2.5 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg border ${
                      device.status === "online" && device.enabled ? "border-emerald-200 text-emerald-600 bg-emerald-50" :
                      device.status === "offline" && device.enabled ? "border-rose-200 text-rose-600 bg-rose-50" :
                      "border-slate-200 text-slate-400 bg-slate-50"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm line-clamp-1 truncate font-sans">
                        {device.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        {device.ipAddress}
                      </p>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {getStatusBadge(device.status, device.enabled)}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-100 mb-3.5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Latency</span>
                    <strong className="text-slate-700 mt-0.5 block">
                      {device.enabled && device.status === "online" && device.lastLatency !== undefined
                        ? `${device.lastLatency} ms`
                        : "--"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Uptime Rate</span>
                    <strong className="text-slate-700 mt-0.5 block">
                      {device.totalChecks > 0 ? `${device.uptimePercentage}%` : "Calculating..."}
                    </strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div 
                  className="flex items-center justify-between pt-1 border-t border-slate-100 mt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-1.5">
                    {/* Toggle enabled / disabled */}
                    <button
                      onClick={() => onToggleEnable(device)}
                      className={`p-1.5 rounded transition ${
                        device.enabled
                          ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                          : "text-amber-600 bg-amber-50 hover:bg-amber-100"
                      }`}
                      title={device.enabled ? "Pause monitoring checks" : "Resume monitoring checks"}
                    >
                      {device.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>

                    {/* Simulation downtime trigger */}
                    {device.enabled && (
                      <button
                        onClick={() => onToggleSimulation(device)}
                        className={`p-1.5 rounded transition border text-xs font-mono ${
                          device.isSimulatingOffline
                            ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                            : "border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                        }`}
                        title={device.isSimulatingOffline ? "Stop downtime simulation" : "Force downtime alert simulation"}
                      >
                        <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                        <span>{device.isSimulatingOffline ? "Resume" : "Kill"}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    {/* Edit device */}
                    <button
                      onClick={() => onEditDevice(device)}
                      className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      title="Edit settings"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete device */}
                    <button
                      onClick={() => onDeleteDevice(device.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Monitor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Table List View */
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono">
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Latency</th>
                  <th className="py-3 px-4">Uptime Rate</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const Icon = getDeviceIcon(device.type);
                  const isSelected = selectedDeviceId === device.id;

                  return (
                    <tr
                      key={device.id}
                      onClick={() => onSelectDevice(device)}
                      className={`border-b border-slate-100 cursor-pointer transition ${
                        isSelected 
                          ? "bg-blue-50/40 text-slate-800 font-semibold" 
                          : "hover:bg-slate-50/50 text-slate-600"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isSelected ? "text-blue-600" : "text-slate-400"}`} />
                          <span className="font-semibold text-slate-700">{device.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{device.ipAddress}</td>
                      <td className="py-3 px-4 capitalize font-mono text-slate-500">{device.type}</td>
                      <td className="py-3 px-4">
                        {getStatusBadge(device.status, device.enabled)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {device.enabled && device.status === "online" && device.lastLatency !== undefined
                          ? `${device.lastLatency} ms`
                          : "--"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {device.totalChecks > 0 ? `${device.uptimePercentage}%` : "N/A"}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onToggleEnable(device)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition"
                            title={device.enabled ? "Pause Monitor" : "Resume Monitor"}
                          >
                            {device.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          
                          {device.enabled && (
                            <button
                              onClick={() => onToggleSimulation(device)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                device.isSimulatingOffline
                                  ? "bg-rose-50 border-rose-250 text-rose-700"
                                  : "border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-250"
                              }`}
                              title={device.isSimulatingOffline ? "Stop downtime simulation" : "Simulate Outage Alert"}
                            >
                              Kill
                            </button>
                          )}

                          <button
                            onClick={() => onEditDevice(device)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => onDeleteDevice(device.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {devices.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400 shadow-sm">
          <Activity className="w-12 h-12 mx-auto text-slate-300 mb-3 animate-pulse" />
          <h4 className="text-slate-700 font-semibold font-display">No network device profiles found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Click the "Add Device Monitor" button on the dashboard to register IP addresses and schedule intervals.
          </p>
        </div>
      )}
    </div>
  );
}
