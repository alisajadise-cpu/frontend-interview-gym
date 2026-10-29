import { useEffect, useRef, useState } from "react";

export type ProgressBarsProps = {
  durationMs?: number;
  concurrency?: number;
};

interface ProgressBar {
  id: number;
  passedTime: number;
}
/** Returns the ids of the bars that are allowed to fill right now. */
function fillingIds(bars: ProgressBar[], durationMs: number, concurrency: number): Set<number> {
  const ids = new Set<number>();
  for (const bar of bars) {
    if (ids.size >= concurrency) break;
    if (bar.passedTime < durationMs) ids.add(bar.id);
  }
  return ids;
}

export function ProgressBars({ durationMs = 2000, concurrency = 3 }: ProgressBarsProps) {
  const runningProgresses = useRef(0);

  const [progressBars, setProgressBars] = useState<ProgressBar[]>([]);

  const [paused, setPaused] = useState(false);

  const completed = progressBars.every((item) => item.passedTime === durationMs);

  useEffect(() => {
    if (completed || paused) {
      return;
    }
    let id = setInterval(() => {
      setProgressBars((prev) => {
        const toUpdateBars = fillingIds(prev, durationMs, concurrency);
        return prev.map((item) => {
          if (toUpdateBars.has(item.id)) {
            return {
              ...item,
              passedTime: item.passedTime + 50,
            };
          }
          return item;
        });
      });
    }, 50);
    return () => {
      clearInterval(id);
    };
  }, [completed, durationMs, concurrency, paused]);

  const handleAdd = () => {
    const newProgressBar: ProgressBar = {
      id: Math.random(),
      passedTime: 0,
    };
    setProgressBars((prev) => [...prev, newProgressBar]);
  };

  const handlePause = () => {
    setPaused((prev) => !prev);
  };
  const handleReset = () => {
    setPaused(false);
    setProgressBars([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <button onClick={handleAdd}>Add</button>
        <button onClick={handlePause}>{paused ? "Resume" : "Pause"}</button>
        <button onClick={handleReset}>Reset</button>
      </div>
      {progressBars.map(({ id, passedTime }) => {
        const ratio = Math.min(1, passedTime / durationMs); // 0 → 1, never above 1
        const percent = Math.round(ratio * 100); // integer 0 → 100

        return (
          <div
            key={id}
            style={{ width: "100%", height: 24, background: "lightgrey" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "red",
                transform: `scaleX(${ratio})`,
                transformOrigin: "left",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
