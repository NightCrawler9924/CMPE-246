export function OpsTutorialPanel() {
  return (
    <section className="panel">
      <header className="panel-header">
        <h3>Operational Tutorial</h3>
      </header>
      <div className="tutorial-grid">
        <article>
          <h4>1. Data pipeline</h4>
          <p>`Version1.py` handles sensor + relay + buzzer + LEDs and writes runtime state; FastAPI exposes it and this UI streams it live.</p>
        </article>
        <article>
          <h4>2. Pi + Arduino heartbeat</h4>
          <p>`RaspiTransmitV1.py` sends UART heartbeat and `AurdinoRecieveV1.ino` watches timeout to trigger Arduino-side fail-safe.</p>
        </article>
        <article>
          <h4>3. Cooling logic</h4>
          <p>Blue LED indicates cooling/water-pump active state. UI mirrors cooling state instead of warning wording.</p>
        </article>
        <article>
          <h4>4. Failure trigger</h4>
          <p>Red-screen lock engages if temperature stays above 60C and rising for more than 10 seconds until manual shutdown/reset.</p>
        </article>
      </div>
    </section>
  );
}
