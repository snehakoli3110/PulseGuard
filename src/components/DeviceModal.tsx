import React, { useState, useEffect } from "react";
import { Device } from "../types.js";
import { X, Save, PlusCircle, Laptop, HelpCircle } from "lucide-react";

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (deviceData: {
    name: string;
    ipAddress: string;
    type: Device["type"];
    pingInterval: number;
    alertThreshold: number;
  }) => void;
  editingDevice: Device | null;
}

export default function DeviceModal({ isOpen, onClose, onSubmit, editingDevice }: DeviceModalProps) {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [type, setType] = useState<Device["type"]>("server");
  const [pingInterval, setPingInterval] = useState(10);
  const [alertThreshold, setAlertThreshold] = useState(3);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingDevice) {
      setName(editingDevice.name);
      setIpAddress(editingDevice.ipAddress);
      setType(editingDevice.type);
      setPingInterval(editingDevice.pingInterval);
      setAlertThreshold(editingDevice.alertThreshold);
    } else {
      setName("");
      setIpAddress("");
      setType("server");
      setPingInterval(10);
      setAlertThreshold(3);
    }
    setErrors({});
  }, [editingDevice, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Device name is required";
    if (!ipAddress.trim()) {
      newErrors.ipAddress = "IP Address or Domain is required";
    } else {
      // Basic IP or domain check
      const trimmed = ipAddress.trim();
      const ipOrDomainRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+(:\d+)?$/;
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
      if (!ipv4Regex.test(trimmed) && !ipOrDomainRegex.test(trimmed)) {
        newErrors.ipAddress = "Please enter a valid IP address or domain (e.g. 8.8.8.8 or google.com)";
      }
    }
    if (pingInterval < 5) newErrors.pingInterval = "Interval must be at least 5 seconds";
    if (alertThreshold < 1) newErrors.alertThreshold = "Threshold must be at least 1 check";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    onSubmit({
      name: name.trim(),
      ipAddress: ipAddress.trim(),
      type,
      pingInterval: Number(pingInterval),
      alertThreshold: Number(alertThreshold)
    });
    onClose();
  };

  return (
    <div id="device-modal-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div 
        id="device-modal-content"
        className="bg-white border border-slate-200 rounded-lg max-w-md w-full shadow-2xl relative overflow-hidden text-slate-800"
      >
        {/* Modal blue highlight top bar */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-blue-600"></div>

        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            {editingDevice ? <Save className="w-5 h-5 text-blue-600" /> : <PlusCircle className="w-5 h-5 text-blue-600" />}
            {editingDevice ? "Edit Device Monitor" : "Register Device Monitor"}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Device Name */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Friendly Device Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary Edge Router"
              className={`w-full bg-slate-50 border rounded-lg px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition ${
                errors.name ? "border-rose-500 focus:border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.name && <p className="text-xs text-rose-500 font-mono mt-1">{errors.name}</p>}
          </div>

          {/* IP Address / Hostname */}
          <div>
            <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              IP Address or Domain Name
            </label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168.1.1 or google.com"
              className={`w-full bg-slate-50 border rounded-lg px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition ${
                errors.ipAddress ? "border-rose-500 focus:border-rose-500" : "border-slate-200"
              }`}
            />
            {errors.ipAddress && <p className="text-xs text-rose-500 font-mono mt-1">{errors.ipAddress}</p>}
            <p className="text-[10px] text-slate-400 font-mono mt-1.5 leading-relaxed">
              Note: Local IP addresses use a simulated high-fidelity network loop, while external domains execute real TCP connection checks.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Device Type */}
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Device Class
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Device["type"])}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              >
                <option value="router">Router / Gateway</option>
                <option value="server">App Server</option>
                <option value="database">Database Host</option>
                <option value="switch">Switch / Hub</option>
                <option value="iot">IoT Device / Sensor</option>
                <option value="other">Other Node</option>
              </select>
            </div>

            {/* Ping Interval */}
            <div>
              <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Ping Rate (Seconds)
              </label>
              <input
                type="number"
                min="5"
                max="3600"
                value={pingInterval}
                onChange={(e) => setPingInterval(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition font-mono"
              />
              {errors.pingInterval && <p className="text-xs text-rose-500 font-mono mt-1">{errors.pingInterval}</p>}
            </div>
          </div>

          {/* Downtime Alert Threshold */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
                Consecutive Outage Threshold
              </label>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-400" />
                <span>Pings failed before firing alarms</span>
              </div>
            </div>
            <input
              type="number"
              min="1"
              max="20"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 transition font-mono"
            />
            {errors.alertThreshold && <p className="text-xs text-rose-500 font-mono mt-1">{errors.alertThreshold}</p>}
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-slate-600 hover:text-slate-800 transition bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-mono font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingDevice ? "Save Changes" : "Register Node"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
