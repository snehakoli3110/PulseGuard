export interface Device {
  id: string;
  name: string;
  ipAddress: string;
  type: 'router' | 'server' | 'database' | 'switch' | 'iot' | 'other';
  pingInterval: number; // in seconds
  status: 'online' | 'offline' | 'unknown';
  lastPingTime?: string; // ISO string
  lastLatency?: number; // ms
  consecutiveFailures: number;
  alertThreshold: number; // consecutive failures before alerting
  enabled: boolean;
  isSimulatingOffline: boolean; // allow manual downtime simulation
  totalChecks: number;
  successChecks: number;
  uptimePercentage: number;
}

export interface PingLog {
  id: string;
  deviceId: string;
  timestamp: string; // ISO string
  status: 'online' | 'offline';
  latency: number; // ms
  message?: string;
}

export interface AlertEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  type: 'downtime' | 'recovery';
  timestamp: string; // ISO string
  message: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface SystemStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  averageLatency: number; // ms
  overallUptime: number; // %
  activeAlertsCount: number;
}
