import type { CSSProperties } from "react";
import type { Panel } from "../spec/schema";

const TASK_STATES = { ok: "succès", run: "en cours", wait: "en attente", fail: "échec" } as const;

const LAYER_NAMES = { bronze: "Bronze", silver: "Silver", gold: "Gold" } as const;

function Title({ panel }: { panel: Panel }) {
  const layer = panel.type === "table" ? panel.layer : undefined;
  return (
    <p className="plabel">
      {layer && (
        <span className="chip" style={{ "--c": `var(--${layer})` } as CSSProperties}>
          {LAYER_NAMES[layer]}
        </span>
      )}
      {panel.title}
    </p>
  );
}

function Body({ panel }: { panel: Panel }) {
  switch (panel.type) {
    case "table": {
      const numeric = new Set(panel.numericColumns);
      const style = panel.layer ? ({ "--c": `var(--${panel.layer})` } as CSSProperties) : undefined;
      return (
        <>
          <div className="tw" style={style}>
            <table>
              <thead>
                <tr>
                  {panel.columns.map((name, c) => (
                    <th key={c} scope="col" className={numeric.has(c) ? "n" : undefined}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {panel.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className={numeric.has(c) ? "n" : undefined}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {panel.note && <p className="note">{panel.note}</p>}
        </>
      );
    }
    case "code":
      return (
        <>
          <pre data-language={panel.language}>
            <code>{panel.content}</code>
          </pre>
          {panel.note && <p className="note">{panel.note}</p>}
        </>
      );
    case "list":
      return (
        <ul className="facts">
          {panel.items.map((item, i) => (
            <li key={i}>
              <b>{item.label}.</b> {item.text}
            </li>
          ))}
        </ul>
      );
    case "dag":
      return (
        <ol className="dag">
          {panel.tasks.map((task, i) => (
            <li key={i} className="dag-item">
              {i > 0 && (
                <span className="sep" aria-hidden="true">
                  ›
                </span>
              )}
              <span className={`task ${task.state}`}>
                {task.name}
                <small>{TASK_STATES[task.state]}</small>
              </span>
            </li>
          ))}
        </ol>
      );
  }
}

export function DataPanels({ panels }: { panels: Panel[] | undefined }) {
  if (!panels?.length) return null;
  return (
    <div className="panels">
      {panels.map((panel, i) => (
        <section key={i} className="panel" aria-label={panel.title}>
          <Title panel={panel} />
          <Body panel={panel} />
        </section>
      ))}
    </div>
  );
}
