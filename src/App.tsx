import { useState, useEffect } from "react";
import { Device, AlertEvent, SystemStats } from "./types.js";
import StatsGrid from "./components/StatsGrid.js";
import HistoryCharts from "./components/HistoryCharts.js";
import AlertsPanel from "./components/AlertsPanel.js";
import DeviceGrid from "./components/DeviceGrid.js";
import DeviceModal from "./components/DeviceModal.js";
import { Plus, RefreshCw, Terminal, Activity, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    averageLatency: 0,
    overallUptime: 100,
    activeAlertsCount: 0
  });
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load initial dashboard state
  const fetchDashboardData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      // Parallelize fetches
      const [devicesRes, statsRes, alertsRes] = await Promise.all([
        fetch("/api/devices"),
        fetch("/api/stats"),
        fetch("/api/alerts")
      ]);

      if (devicesRes.ok && statsRes.ok && alertsRes.ok) {
        const devicesData: Device[] = await devicesRes.json();
        const statsData: SystemStats = await statsRes.json();
        const alertsData: AlertEvent[] = await alertsRes.json();

        setDevices(devicesData);
        setStats(statsData);
        setAlerts(alertsData);

        // Keep selected device reference updated
        if (selectedDevice) {
          const updated = devicesData.find((d) => d.id === selectedDevice.id);
          if (updated) {
            setSelectedDevice(updated);
          } else {
            setSelectedDevice(null);
          }
        } else if (devicesData.length > 0 && !selectedDevice) {
          // Default select first device on load to make graph active
          setSelectedDevice(devicesData[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up continuous 4-second polling for active network state tracking
    const pollInterval = setInterval(() => {
      fetchDashboardData(true);
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [selectedDevice?.id]);

  // Handle adding or editing a device
  const handleFormSubmit = async (deviceData: {
    name: string;
    ipAddress: string;
    type: Device["type"];
    pingInterval: number;
    alertThreshold: number;
  }) => {
    try {
      if (editingDevice) {
        // Edit flow
        const res = await fetch(`/api/devices/${editingDevice.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deviceData)
        });
        if (res.ok) {
          await fetchDashboardData(true);
        }
      } else {
        // Create flow
        const res = await fetch("/api/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deviceData)
        });
        if (res.ok) {
          const created: Device = await res.json();
          await fetchDashboardData(true);
          setSelectedDevice(created); // automatically display charts for the newly created device
        }
      }
    } catch (err) {
      console.error("Failed to submit device form:", err);
    } finally {
      setEditingDevice(null);
    }
  };

  // Toggle device enable/pause state
  const handleToggleEnable = async (device: Device) => {
    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !device.enabled })
      });
      if (res.ok) {
        await fetchDashboardData(true);
      }
    } catch (err) {
      console.error("Failed to toggle enable state:", err);
    }
  };

  // Toggle manual simulated downtime
  const handleToggleSimulation = async (device: Device) => {
    try {
      const res = await fetch(`/api/devices/${device.id}/toggle-simulation`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchDashboardData(true);
      }
    } catch (err) {
      console.error("Failed to toggle simulated downtime:", err);
    }
  };

  // Delete a device monitor
  const handleDeleteDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/devices/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (selectedDevice?.id === id) {
          setSelectedDevice(null);
        }
        await fetchDashboardData(true);
      }
    } catch (err) {
      console.error("Failed to delete device monitor:", err);
    }
  };

  const handleClearResolvedAlerts = async () => {
    try {
      const res = await fetch("/api/alerts/clear", {
        method: "POST"
      });
      if (res.ok) {
        await fetchDashboardData(true);
      }
    } catch (err) {
      console.error("Failed to flush resolved alerts:", err);
    }
  };

  const openAddModal = () => {
    setEditingDevice(null);
    setIsModalOpen(true);
  };

  const openEditModal = (device: Device) => {
    setEditingDevice(device);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500">
        <Activity className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-xs font-mono tracking-widest uppercase font-semibold text-slate-500">Initializing Probe Schedulers...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-blue-500/20">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white/80 sticky top-0 z-30 backdrop-blur-md px-4 sm:px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Terminal className="w-5 h-5 text-white font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800 tracking-tight font-display">
                  PulseGuard
                </h1>
                <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full uppercase">
                  v2.0 Full-Stack
                </span>
              </div>
              <p className="text-xs text-slate-500">Network Latency & Downtime Alerts Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchDashboardData()}
              className={`p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center shadow-sm ${
                isRefreshing ? "opacity-60" : ""
              }`}
              title="Manual Refresh Stats"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition shadow-md shadow-blue-500/10 font-sans"
            >
              <Plus className="w-4 h-4" />
              <span>Add Device Monitor</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Bento Stats Overview */}
        <StatsGrid stats={stats} />

        {/* Dynamic Metrics Charts and Operator Logs Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Trend Panel */}
          <div className="lg:col-span-2">
            <HistoryCharts selectedDevice={selectedDevice} />
          </div>

          {/* Incident Warning Panel */}
          <div className="lg:col-span-1">
            <AlertsPanel alerts={alerts} onClearResolved={handleClearResolvedAlerts} />
          </div>
        </div>

        {/* Registered Devices Grid & Table */}
        <div className="pt-2">
          <DeviceGrid
            devices={devices}
            selectedDeviceId={selectedDevice?.id || null}
            onSelectDevice={setSelectedDevice}
            onEditDevice={openEditModal}
            onDeleteDevice={handleDeleteDevice}
            onToggleEnable={handleToggleEnable}
            onToggleSimulation={handleToggleSimulation}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500 font-mono shadow-inner">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 PulseGuard NetOps, Inc. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Local Probe Engine active on port 3000</span>
          </div>
        </div>
      </footer>

      {/* Register/Edit Dialog */}
      <DeviceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        editingDevice={editingDevice}
      />
    </div>
  );
}
