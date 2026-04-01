import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const BOOT_LINES = [
  "REACTOR SENTINEL INITIALIZING...",
  "CHECKING SENSOR ARRAY...",
  "ESTABLISHING DATA LINK...",
  "CALIBRATING THERMAL CONTROLLER...",
  "SYSTEM ONLINE",
];

export function BootOverlay({ visible }: { visible: boolean }) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setLineIndex(0);
    setCharIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (lineIndex >= BOOT_LINES.length) return;

    const current = BOOT_LINES[lineIndex];
    if (charIndex < current.length) {
      const t = window.setTimeout(() => setCharIndex((v) => v + 1), 22);
      return () => window.clearTimeout(t);
    }

    const next = window.setTimeout(() => {
      setLineIndex((v) => v + 1);
      setCharIndex(0);
    }, 260);
    return () => window.clearTimeout(next);
  }, [charIndex, lineIndex, visible]);

  const renderedLines = useMemo(() => {
    return BOOT_LINES.map((line, idx) => {
      if (idx < lineIndex) return line;
      if (idx === lineIndex) return line.slice(0, charIndex);
      return "";
    });
  }, [charIndex, lineIndex]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="boot-overlay"
          initial={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.6 }}
        >
          <div className="boot-terminal">
            {renderedLines.map((line, idx) => (
              <p key={BOOT_LINES[idx]} className={idx === BOOT_LINES.length - 1 ? "boot-last" : ""}>
                {line}
                {idx === lineIndex ? <span className="boot-cursor">_</span> : null}
              </p>
            ))}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
