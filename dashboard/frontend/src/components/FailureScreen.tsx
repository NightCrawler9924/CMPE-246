import { AlertTriangle, Siren } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  active: boolean;
  onShutdown: () => Promise<void>;
}

export function FailureScreen({ active, onShutdown }: Props) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          className="failure-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="failure-card"
            animate={{ x: [0, -2, 2, -1, 1, 0] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.45 }}
          >
            <p className="fail-kicker">Critical Temperature Breach</p>
            <h2 className="glitch" data-text="SYSTEM FAILURE">SYSTEM FAILURE</h2>
            <h3>IMMEDIATE SHUTDOWN REQUIRED</h3>
            <div className="fail-icons">
              <AlertTriangle size={46} />
              <Siren size={46} />
              <AlertTriangle size={46} />
            </div>
            <button
              className="shutdown-btn"
              onClick={() => {
                if (window.confirm("Execute emergency shutdown and force mode OFF?")) {
                  void onShutdown();
                }
              }}
            >
              Execute Emergency Shutdown
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
