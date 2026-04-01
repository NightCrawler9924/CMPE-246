import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { LogEntry } from "../types";

export function AlertsLogPanel({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section className="panel panel-log">
      <header className="panel-header">
        <h3>Alerts & Logs</h3>
      </header>
      <div ref={ref} className="log-terminal">
        {logs.map((log) => (
          <motion.p key={log.id} className={`log-${log.level.toLowerCase()}`} initial={{ opacity: 0, x: -7 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }}>
            [{log.timestamp}] {log.level.padEnd(4, " ")} :: {log.message}
          </motion.p>
        ))}
      </div>
    </section>
  );
}
