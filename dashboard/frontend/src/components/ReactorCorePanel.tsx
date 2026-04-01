import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TelemetryPoint } from "../types";

function levelFromTemp(temp: number): "SAFE" | "WARNING" | "CRITICAL" {
  if (temp > 60) return "CRITICAL";
  if (temp >= 56) return "WARNING";
  return "SAFE";
}

export function ReactorCorePanel({ stream, currentTemp, setpoint }: { stream: TelemetryPoint[]; currentTemp: number; setpoint: number }) {
  const fillPercent = Math.max(0, Math.min(100, (currentTemp / 80) * 100));
  const level = levelFromTemp(currentTemp);
  const motionTemp = useMotionValue(currentTemp);
  const smoothTemp = useSpring(motionTemp, { stiffness: 90, damping: 22 });
  const displayTemp = useTransform(smoothTemp, (v) => `${v.toFixed(2)}C`);

  useEffect(() => {
    motionTemp.set(currentTemp);
  }, [currentTemp, motionTemp]);

  return (
    <section className="panel panel-core">
      <header className="panel-header">
        <h2>Reactor Core Temperature</h2>
        <span className={`badge badge-${level.toLowerCase()}`}>{level}</span>
      </header>

      <div className="core-display">
        <div className="temp-digital">
          <p className="label">Current Temp</p>
          <motion.p className="digital" initial={{ opacity: 0.3, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <motion.span>{displayTemp}</motion.span>
          </motion.p>
          <p className="sub">Setpoint: {setpoint.toFixed(1)}C</p>
        </div>

        <div className="temp-gauge">
          <div className="gauge-rail">
            <div className="gauge-critical-marker" />
            <motion.div className="gauge-fill" animate={{ width: `${fillPercent}%` }} transition={{ type: "spring", stiffness: 110, damping: 20 }} />
          </div>
          <div className="gauge-labels">
            <span>0C</span>
            <span>60C CRIT</span>
            <span>80C</span>
          </div>
        </div>
      </div>

      <div className="chart-shell">
        <div className="chart-sweep" />
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={stream}>
            <defs>
              <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FF88" stopOpacity={0.25} />
                <stop offset="50%" stopColor="#FFC857" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#FF3B3B" stopOpacity={0.18} />
              </linearGradient>
              <linearGradient id="tempStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00FF88" />
                <stop offset="52%" stopColor="#FFC857" />
                <stop offset="100%" stopColor="#FF3B3B" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(0,255,120,0.08)" />
            <XAxis dataKey="timestamp" hide />
            <YAxis domain={["auto", "auto"]} stroke="#9FB3C8" width={44} />
            <Tooltip contentStyle={{ background: "#121A22", border: "1px solid rgba(0,194,255,0.35)", color: "#E6EDF3" }} />
            <ReferenceLine y={56} stroke="#FFC857" strokeDasharray="5 4" />
            <ReferenceLine y={60} stroke="#FF3B3B" strokeDasharray="6 4" />
            <Area
              type="monotone"
              dataKey="temp"
              stroke="url(#tempStroke)"
              strokeWidth={2.8}
              fill="url(#tempFill)"
              isAnimationActive
              animationDuration={450}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
