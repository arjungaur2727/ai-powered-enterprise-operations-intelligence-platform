/**
 * src/components/sql/CronExpressionBuilder.jsx
 *
 * Two-mode cron builder: Simple (dropdowns) and Advanced (raw input).
 *
 * Props:
 *   value      {string}  — raw cron expression
 *   onChange   {(cron: string) => void}
 */

import React, { useState } from "react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 30, 45];

// Simple cron human-readable (without npm dep)
function cronToHuman(expr) {
  try {
    const [min, hour, dom, month, dow] = expr.trim().split(/\s+/);
    if (min.startsWith("*/")) return `Every ${min.slice(2)} minutes`;
    if (hour.startsWith("*/") && min === "0") return `Every ${hour.slice(2)} hours`;
    if (dow !== "*" && dom === "*" && month === "*") {
      const day = DAYS[parseInt(dow)] || dow;
      return `Every ${day} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
    }
    if (dom !== "*" && month === "*" && dow === "*") {
      const suffix = { "1": "st", "2": "nd", "3": "rd" }[dom] || "th";
      return `${dom}${suffix} of each month at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
    }
    if (dom === "*" && month === "*" && dow === "*") {
      return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
    }
    return expr;
  } catch {
    return expr;
  }
}

function simpleToExpression({ freq, interval, hour, minute, dayOfWeek, dayOfMonth }) {
  switch (freq) {
    case "minutes":   return `*/${interval} * * * *`;
    case "hourly":    return `${minute} * * * *`;
    case "daily":     return `${minute} ${hour} * * *`;
    case "weekly":    return `${minute} ${hour} * * ${dayOfWeek}`;
    case "monthly":   return `${minute} ${hour} ${dayOfMonth} * *`;
    default:          return "0 9 * * *";
  }
}

export default function CronExpressionBuilder({ value = "0 9 * * *", onChange }) {
  const [mode, setMode] = useState("simple");
  const [rawInput, setRawInput] = useState(value);
  const [simple, setSimple] = useState({
    freq: "daily",
    interval: 15,
    hour: 9,
    minute: 0,
    dayOfWeek: 1,
    dayOfMonth: 1,
  });

  const updateSimple = (key, val) => {
    const next = { ...simple, [key]: val };
    setSimple(next);
    const expr = simpleToExpression(next);
    setRawInput(expr);
    onChange?.(expr);
  };

  const handleRawChange = (e) => {
    setRawInput(e.target.value);
    onChange?.(e.target.value);
  };

  const isValidCron = (expr) => {
    const parts = expr.trim().split(/\s+/);
    return parts.length === 5;
  };

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-surface-border rounded-lg p-0.5 w-fit">
        {["simple", "advanced"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
              mode === m
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "simple" ? (
        <div className="space-y-3">
          {/* Frequency */}
          <div>
            <label className="label text-xs">Frequency</label>
            <select
              value={simple.freq}
              onChange={(e) => updateSimple("freq", e.target.value)}
              className="input text-sm"
            >
              <option value="minutes">Every N Minutes</option>
              <option value="hourly">Every N Hours (on the hour)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Conditional fields */}
          {simple.freq === "minutes" && (
            <div>
              <label className="label text-xs">Interval (minutes)</label>
              <select
                value={simple.interval}
                onChange={(e) => updateSimple("interval", e.target.value)}
                className="input text-sm"
              >
                {[5, 10, 15, 30, 60].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {["daily", "weekly", "monthly"].includes(simple.freq) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Hour (UTC)</label>
                <select
                  value={simple.hour}
                  onChange={(e) => updateSimple("hour", Number(e.target.value))}
                  className="input text-sm"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs">Minute</label>
                <select
                  value={simple.minute}
                  onChange={(e) => updateSimple("minute", Number(e.target.value))}
                  className="input text-sm"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {simple.freq === "weekly" && (
            <div>
              <label className="label text-xs">Day of Week</label>
              <select
                value={simple.dayOfWeek}
                onChange={(e) => updateSimple("dayOfWeek", Number(e.target.value))}
                className="input text-sm"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {simple.freq === "monthly" && (
            <div>
              <label className="label text-xs">Day of Month</label>
              <select
                value={simple.dayOfMonth}
                onChange={(e) => updateSimple("dayOfMonth", Number(e.target.value))}
                className="input text-sm"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="label text-xs">Cron Expression</label>
          <input
            type="text"
            value={rawInput}
            onChange={handleRawChange}
            placeholder="0 9 * * 1"
            className={`input font-mono text-sm ${!isValidCron(rawInput) ? "border-red-400" : ""}`}
          />
          {!isValidCron(rawInput) && (
            <p className="text-xs text-red-500 mt-1">Must have exactly 5 fields.</p>
          )}
        </div>
      )}

      {/* Human-readable preview */}
      <div className="rounded-lg bg-surface border border-surface-border px-3 py-2">
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text-secondary">Schedule: </span>
          {cronToHuman(rawInput)}
        </p>
        <p className="text-xs text-text-muted mt-0.5 font-mono">{rawInput}</p>
      </div>
    </div>
  );
}
