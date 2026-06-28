import express from "express";
import path from "path";
import fs from "fs";
import net from "net";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import { Device, PingLog, AlertEvent, SystemStats } from "./src/types.js";

const app = express();
const PORT = 3000;
const STORE_PATH = path.join(process.cwd(), "data-store.json");

app.use(express.json());

// Memory-backed store with automatic file flushing
interface DataStore {
  devices: Device[];
  alerts: AlertEvent[];
  history: Record<string, PingLog[]>;
}

let store: DataStore = {
  devices: [],
  alerts: [],
  history: {}
};

// Map to hold active NodeJS timers for each device ping loop
const activeTimers = new Map<string, NodeJS.Timeout>();

// Helper to save store to file
function saveStore() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save data store:", error);
  }
}

// Seed helper: generates realistic historical data for the last 2 hours
function generateHistoricalLogs(deviceId: string, count: number, baseLatency: number, jitter: number, uptimeProb: number): PingLog[] {
  const logs: PingLog[] = [];
  const now = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 1000); // 1 minute intervals
    const isOnline = Math.random() < uptimeProb;
    const latency = isOnline ? Math.max(1, Math.round(baseLatency + (Math.random() - 0.5) * jitter)) : 0;
    
    logs.push({
      id: `${deviceId}-hist-${i}`,
      deviceId,
      timestamp: timestamp.toISOString(),
      status: isOnline ? "online" : "offline",
      latency,
      message: isOnline ? undefined : "Connection timed out"
    });
  }
  return logs;
}

// Initialize and seed the database if it doesn't exist
function initStore() {
  if (fs.existsSync(STORE_PATH)) {
    try {
      const data = fs.readFileSync(STORE_PATH, "utf8");
      store = JSON.parse(data);
      console.log(`Loaded ${store.devices.length} devices from disk.`);
      return;
    } catch (e) {
      console.error("Failed to parse existing data-store.json, creating a fresh one.", e);
    }
  }

  // Seeding default devices for a professional look out-of-the-box
  const defaultDevices: Device[] = [
    {
      id: "dev-router",
      name: "Office Primary Gateway",
      ipAddress: "192.168.1.1",
      type: "router",
      pingInterval: 10,
      status: "online",
      lastPingTime: new Date().toISOString(),
      lastLatency: 4,
      consecutiveFailures: 0,
      alertThreshold: 2,
      enabled: true,
      isSimulatingOffline: false,
      totalChecks: 120,
      successChecks: 120,
      uptimePercentage: 100
    },
    {
      id: "dev-db",
      name: "Production PostgreSQL Database",
      ipAddress: "db.prod.internal",
      type: "database",
      pingInterval: 15,
      status: "online",
      lastPingTime: new Date().toISOString(),
      lastLatency: 14,
      consecutiveFailures: 0,
      alertThreshold: 3,
      enabled: true,
      isSimulatingOffline: false,
      totalChecks: 120,
      successChecks: 118,
      uptimePercentage: 98.33
    },
    {
      id: "dev-google-dns",
      name: "Google Public DNS",
      ipAddress: "8.8.8.8",
      type: "server",
      pingInterval: 10,
      status: "online",
      lastPingTime: new Date().toISOString(),
      lastLatency: 12,
      consecutiveFailures: 0,
      alertThreshold: 3,
      enabled: true,
      isSimulatingOffline: false,
      totalChecks: 120,
      successChecks: 120,
      uptimePercentage: 100
    },
    {
      id: "dev-iot-temp",
      name: "Warehouse Temperature Sensor",
      ipAddress: "192.168.10.45",
      type: "iot",
      pingInterval: 20,
      status: "online",
      lastPingTime: new Date().toISOString(),
      lastLatency: 35,
      consecutiveFailures: 0,
      alertThreshold: 2,
      enabled: true,
      isSimulatingOffline: false,
      totalChecks: 120,
      successChecks: 114,
      uptimePercentage: 95.0
    }
  ];

  store.devices = defaultDevices;
  
  // Seed history
  store.history["dev-router"] = generateHistoricalLogs("dev-router", 30, 4, 2, 1.0);
  store.history["dev-db"] = generateHistoricalLogs("dev-db", 30, 14, 5, 0.98);
  store.history["dev-google-dns"] = generateHistoricalLogs("dev-google-dns", 30, 12, 4, 1.0);
  store.history["dev-iot-temp"] = generateHistoricalLogs("dev-iot-temp", 30, 35, 12, 0.95);

  // Pre-seed some resolved alert history
  store.alerts = [
    {
      id: "alert-1",
      deviceId: "dev-db",
      deviceName: "Production PostgreSQL Database",
      deviceIp: "db.prod.internal",
      type: "downtime",
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45m ago
      message: "Device DB.PROD.INTERNAL failed to respond to 3 consecutive pings.",
      resolved: true,
      resolvedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString() // 42m ago (3 min downtime)
    },
    {
      id: "alert-2",
      deviceId: "dev-iot-temp",
      deviceName: "Warehouse Temperature Sensor",
      deviceIp: "192.168.10.45",
      type: "downtime",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
      message: "Device 192.168.10.45 failed to respond to 2 consecutive pings.",
      resolved: true,
      resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000 - 55 * 60 * 1000).toISOString() // resolved 5 mins later
    }
  ];

  saveStore();
  console.log("Database seeded successfully with default devices and historical logs.");
}

// Perform a real network ping (via TCP connect) or fallback to realistic simulation
function performPing(device: Device): Promise<{ success: boolean; latency: number; message?: string }> {
  return new Promise((resolve) => {
    // 1. If user simulated offline manually in UI
    if (device.isSimulatingOffline) {
      return resolve({ success: false, latency: 0, message: "Manual simulation downtime" });
    }

    // 2. Fallback check for simulated/private/local IPs that aren't routable
    const isLocalIP = 
      device.ipAddress.startsWith("192.168.") || 
      device.ipAddress.startsWith("10.") || 
      device.ipAddress.endsWith(".local") || 
      device.ipAddress.startsWith("172.") ||
      device.ipAddress.startsWith("127.") ||
      device.ipAddress === "localhost";

    if (isLocalIP) {
      // Simulate real ping behavior with 1.5% chance of packet loss under normal operation
      const simulatedLoss = Math.random() < 0.015;
      if (simulatedLoss) {
        return resolve({ success: false, latency: 0, message: "Connection request timed out (Simulated)" });
      }

      // Base latencies depending on device type
      let base = 5;
      let jitter = 3;
      if (device.type === "router") { base = 3; jitter = 1.5; }
      else if (device.type === "database") { base = 12; jitter = 4; }
      else if (device.type === "iot") { base = 42; jitter = 15; }
      else if (device.type === "server") { base = 15; jitter = 6; }

      // Random spikes sometimes
      const spike = Math.random() < 0.05 ? Math.random() * 40 : 0;
      const latency = Math.max(1, Math.round(base + (Math.random() - 0.5) * jitter + spike));
      return resolve({ success: true, latency });
    }

    // 3. Real network check for public IPs/domains
    let host = device.ipAddress;
    let port: number | null = null;
    
    if (host.includes(":")) {
      const parts = host.split(":");
      host = parts[0];
      port = parseInt(parts[1], 10) || null;
    }

    // Perform DNS lookup first to guarantee the IP or Domain is valid
    dns.lookup(host, (dnsErr) => {
      if (dnsErr) {
        return resolve({ 
          success: false, 
          latency: 0, 
          message: `DNS lookup failed (Host not found): ${dnsErr.message}` 
        });
      }

      // Determine smart target port if not specified
      const targetPort = port !== null ? port : (
        ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9"].includes(host) ? 53 : (
          /[a-zA-Z]/.test(host) ? 443 : 80
        )
      );

      const startTime = process.hrtime();
      const socket = new net.Socket();
      socket.setTimeout(2500); // 2.5 seconds timeout

      const handleSuccess = () => {
        const diff = process.hrtime(startTime);
        const latency = Math.round(diff[0] * 1000 + diff[1] / 1000000);
        socket.destroy();
        resolve({ success: true, latency });
      };

      const handleFailure = (errMessage: string) => {
        socket.destroy();
        resolve({ success: false, latency: 0, message: errMessage });
      };

      socket.connect(targetPort, host, () => {
        handleSuccess();
      });

      socket.on("error", (err: any) => {
        // ECONNREFUSED implies the host is active and responded (refusing a closed port), so it is ONLINE!
        if (err.code === "ECONNREFUSED") {
          handleSuccess();
        } else if (port === null && targetPort === 443) {
          // Fall back to port 80 if 443 failed and no port was specified
          const fallbackSocket = new net.Socket();
          fallbackSocket.setTimeout(2000);
          fallbackSocket.connect(80, host, () => {
            const diff = process.hrtime(startTime);
            const latency = Math.round(diff[0] * 1000 + diff[1] / 1000000);
            fallbackSocket.destroy();
            resolve({ success: true, latency });
          });
          fallbackSocket.on("error", (fallbackErr: any) => {
            fallbackSocket.destroy();
            if (fallbackErr.code === "ECONNREFUSED") {
              const diff = process.hrtime(startTime);
              const latency = Math.round(diff[0] * 1000 + diff[1] / 1000000);
              resolve({ success: true, latency });
            } else {
              resolve({ success: false, latency: 0, message: `Connection failed: ${fallbackErr.message}` });
            }
          });
          fallbackSocket.on("timeout", () => {
            fallbackSocket.destroy();
            resolve({ success: false, latency: 0, message: "Connection timed out on fallback port 80" });
          });
        } else {
          handleFailure(`Connection failed: ${err.message}`);
        }
      });

      socket.on("timeout", () => {
        if (port === null && targetPort === 443) {
          // Fall back to port 80 on 443 timeout as well
          const fallbackSocket = new net.Socket();
          fallbackSocket.setTimeout(2000);
          fallbackSocket.connect(80, host, () => {
            const diff = process.hrtime(startTime);
            const latency = Math.round(diff[0] * 1000 + diff[1] / 1000000);
            fallbackSocket.destroy();
            resolve({ success: true, latency });
          });
          fallbackSocket.on("error", (fallbackErr: any) => {
            fallbackSocket.destroy();
            if (fallbackErr.code === "ECONNREFUSED") {
              const diff = process.hrtime(startTime);
              const latency = Math.round(diff[0] * 1000 + diff[1] / 1000000);
              resolve({ success: true, latency });
            } else {
              resolve({ success: false, latency: 0, message: `Connection failed: ${fallbackErr.message}` });
            }
          });
          fallbackSocket.on("timeout", () => {
            fallbackSocket.destroy();
            resolve({ success: false, latency: 0, message: "Connection timed out on fallback port 80" });
          });
        } else {
          handleFailure("Connection timed out");
        }
      });
    });
  });
}

// Centralized device checker that runs on schedule
async function runDeviceCheck(deviceId: string) {
  const deviceIndex = store.devices.findIndex((d) => d.id === deviceId);
  if (deviceIndex === -1) return;

  const device = store.devices[deviceIndex];
  if (!device.enabled) return;

  const result = await performPing(device);
  const now = new Date();

  // Create ping log
  const newLog: PingLog = {
    id: `${device.id}-${Date.now()}`,
    deviceId: device.id,
    timestamp: now.toISOString(),
    status: result.success ? "online" : "offline",
    latency: result.latency,
    message: result.message
  };

  // Keep history bounded at last 50 logs per device
  if (!store.history[device.id]) {
    store.history[device.id] = [];
  }
  store.history[device.id].push(newLog);
  if (store.history[device.id].length > 50) {
    store.history[device.id].shift();
  }

  // Update checks counters
  device.totalChecks += 1;
  if (result.success) {
    device.successChecks += 1;
  }
  device.uptimePercentage = parseFloat(
    ((device.successChecks / device.totalChecks) * 100).toFixed(2)
  );

  device.lastPingTime = now.toISOString();
  device.lastLatency = result.success ? result.latency : undefined;

  const previousStatus = device.status;

  if (result.success) {
    device.consecutiveFailures = 0;
    
    // Recovery trigger
    if (previousStatus === "offline") {
      device.status = "online";
      
      // Resolve any previous active downtime alerts
      store.alerts = store.alerts.map((alert) => {
        if (alert.deviceId === device.id && !alert.resolved && alert.type === "downtime") {
          return {
            ...alert,
            resolved: true,
            resolvedAt: now.toISOString()
          };
        }
        return alert;
      });

      // Log recovery alert event
      const recoveryAlert: AlertEvent = {
        id: `alert-${Date.now()}`,
        deviceId: device.id,
        deviceName: device.name,
        deviceIp: device.ipAddress,
        type: "recovery",
        timestamp: now.toISOString(),
        message: `Device '${device.name}' (${device.ipAddress}) recovered and is online.`,
        resolved: true
      };
      store.alerts.unshift(recoveryAlert);
    } else {
      device.status = "online";
    }
  } else {
    device.consecutiveFailures += 1;

    // Downtime trigger
    if (device.consecutiveFailures >= device.alertThreshold) {
      if (previousStatus !== "offline") {
        device.status = "offline";

        // Log downtime alert event
        const downtimeAlert: AlertEvent = {
          id: `alert-${Date.now()}`,
          deviceId: device.id,
          deviceName: device.name,
          deviceIp: device.ipAddress,
          type: "downtime",
          timestamp: now.toISOString(),
          message: `Device '${device.name}' (${device.ipAddress}) has failed ${device.consecutiveFailures} consecutive ping checks. Reason: ${result.message || "Timeout"}`,
          resolved: false
        };
        store.alerts.unshift(downtimeAlert);
      }
    }
  }

  // Cap alerts list to 100 events
  if (store.alerts.length > 100) {
    store.alerts.pop();
  }

  saveStore();
}

// Start and coordinate individual interval loops
function startSchedulerForDevice(device: Device) {
  // Clear any existing timer first
  if (activeTimers.has(device.id)) {
    clearInterval(activeTimers.get(device.id)!);
    activeTimers.delete(device.id);
  }

  if (!device.enabled) return;

  // Run immediate initial check, then schedule recurring checks
  runDeviceCheck(device.id);

  const timer = setInterval(() => {
    runDeviceCheck(device.id);
  }, device.pingInterval * 1000);

  activeTimers.set(device.id, timer);
}

function startAllSchedulers() {
  store.devices.forEach((device) => {
    startSchedulerForDevice(device);
  });
}

// --- REST API ENDPOINTS ---

// Fetch overall Stats
app.get("/api/stats", (req, res) => {
  const totalDevices = store.devices.length;
  const onlineDevices = store.devices.filter((d) => d.enabled && d.status === "online").length;
  const offlineDevices = store.devices.filter((d) => d.enabled && d.status === "offline").length;
  
  const enabledDevicesWithPing = store.devices.filter((d) => d.enabled && d.lastLatency !== undefined);
  const averageLatency = enabledDevicesWithPing.length > 0
    ? Math.round(enabledDevicesWithPing.reduce((sum, d) => sum + (d.lastLatency || 0), 0) / enabledDevicesWithPing.length)
    : 0;

  const enabledDevicesWithChecks = store.devices.filter((d) => d.enabled && d.totalChecks > 0);
  const overallUptime = enabledDevicesWithChecks.length > 0
    ? parseFloat((enabledDevicesWithChecks.reduce((sum, d) => sum + d.uptimePercentage, 0) / enabledDevicesWithChecks.length).toFixed(2))
    : 100.0;

  const activeAlertsCount = store.alerts.filter((a) => !a.resolved).length;

  const stats: SystemStats = {
    totalDevices,
    onlineDevices,
    offlineDevices,
    averageLatency,
    overallUptime,
    activeAlertsCount
  };

  res.json(stats);
});

// Fetch all devices
app.get("/api/devices", (req, res) => {
  res.json(store.devices);
});

// Create new device
app.post("/api/devices", (req, res) => {
  const { name, ipAddress, type, pingInterval, alertThreshold } = req.body;

  if (!name || !ipAddress) {
    return res.status(400).json({ error: "Name and IP address are required" });
  }

  const newDevice: Device = {
    id: `dev-${Date.now()}`,
    name,
    ipAddress,
    type: type || "other",
    pingInterval: Math.max(5, parseInt(pingInterval, 10) || 10),
    status: "unknown",
    consecutiveFailures: 0,
    alertThreshold: Math.max(1, parseInt(alertThreshold, 10) || 3),
    enabled: true,
    isSimulatingOffline: false,
    totalChecks: 0,
    successChecks: 0,
    uptimePercentage: 100
  };

  store.devices.push(newDevice);
  store.history[newDevice.id] = [];
  
  saveStore();
  startSchedulerForDevice(newDevice);

  res.status(201).json(newDevice);
});

// Edit existing device
app.put("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  const { name, ipAddress, type, pingInterval, alertThreshold, enabled } = req.body;

  const deviceIndex = store.devices.findIndex((d) => d.id === id);
  if (deviceIndex === -1) {
    return res.status(404).json({ error: "Device not found" });
  }

  const dev = store.devices[deviceIndex];
  
  if (name !== undefined) dev.name = name;
  if (ipAddress !== undefined) dev.ipAddress = ipAddress;
  if (type !== undefined) dev.type = type;
  if (alertThreshold !== undefined) dev.alertThreshold = Math.max(1, alertThreshold);
  
  // If interval or enablement changed, restart timer
  let intervalChanged = false;
  if (pingInterval !== undefined) {
    const newInterval = Math.max(5, parseInt(pingInterval, 10) || 10);
    if (dev.pingInterval !== newInterval) {
      dev.pingInterval = newInterval;
      intervalChanged = true;
    }
  }

  if (enabled !== undefined) {
    if (dev.enabled !== enabled) {
      dev.enabled = enabled;
      intervalChanged = true;
      if (!enabled) {
        dev.status = "unknown";
      }
    }
  }

  saveStore();

  if (intervalChanged) {
    startSchedulerForDevice(dev);
  }

  res.json(dev);
});

// Delete device
app.delete("/api/devices/:id", (req, res) => {
  const { id } = req.params;
  
  const deviceIndex = store.devices.findIndex((d) => d.id === id);
  if (deviceIndex === -1) {
    return res.status(404).json({ error: "Device not found" });
  }

  // Clear interval
  if (activeTimers.has(id)) {
    clearInterval(activeTimers.get(id)!);
    activeTimers.delete(id);
  }

  // Remove device and history
  store.devices.splice(deviceIndex, 1);
  delete store.history[id];
  // Filter alerts for deleted device so user screen cleans up
  store.alerts = store.alerts.filter((a) => a.deviceId !== id);

  saveStore();
  res.json({ success: true, message: "Device deleted successfully" });
});

// Toggle simulation offline
app.post("/api/devices/:id/toggle-simulation", (req, res) => {
  const { id } = req.params;
  const deviceIndex = store.devices.findIndex((d) => d.id === id);
  if (deviceIndex === -1) {
    return res.status(404).json({ error: "Device not found" });
  }

  const dev = store.devices[deviceIndex];
  dev.isSimulatingOffline = !dev.isSimulatingOffline;
  
  // Force an immediate check execution to show result instantly in the frontend UI
  runDeviceCheck(dev.id);

  saveStore();
  res.json(dev);
});

// Fetch detailed ping logs for a device (recharts trends)
app.get("/api/devices/:id/history", (req, res) => {
  const { id } = req.params;
  const history = store.history[id] || [];
  res.json(history);
});

// Fetch active alerts
app.get("/api/alerts", (req, res) => {
  res.json(store.alerts);
});

// Clear resolved alerts
app.post("/api/alerts/clear", (req, res) => {
  // Filter to keep only unresolved/active alerts
  store.alerts = store.alerts.filter((alert) => !alert.resolved);
  saveStore();
  res.json({ success: true, alerts: store.alerts });
});

// Initialize database
initStore();

// Start ping schedulers for all enabled devices
startAllSchedulers();

// Handle Vite assets and routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Network Device Monitor running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
