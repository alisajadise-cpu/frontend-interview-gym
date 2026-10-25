import { useMemo, useState } from 'react';

export type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[];
};

export type CheckboxTreeProps = {
  nodes: TreeNode[];
  defaultChecked?: string[];
  onChange?: (checkedLeafIds: string[]) => void;
};

type NodeState = 'checked' | 'unchecked' | 'mixed';

const isLeaf = (node: TreeNode) => !node.children || node.children.length === 0;

/** All leaf ids under a node (the node itself if it is a leaf), in tree order. */
function leavesOf(node: TreeNode, out: string[] = []): string[] {
  if (isLeaf(node)) out.push(node.id);
  else for (const child of node.children!) leavesOf(child, out);
  return out;
}

/**
 * One post-order pass computes the state of every node: O(n) per render,
 * instead of asking "are all my leaves checked?" separately for each parent.
 */
function computeStates(nodes: TreeNode[], checked: Set<string>): Map<string, NodeState> {
  const states = new Map<string, NodeState>();
  const visit = (node: TreeNode): { total: number; on: number } => {
    if (isLeaf(node)) {
      const on = checked.has(node.id) ? 1 : 0;
      states.set(node.id, on ? 'checked' : 'unchecked');
      return { total: 1, on };
    }
    let total = 0;
    let on = 0;
    for (const child of node.children!) {
      const r = visit(child);
      total += r.total;
      on += r.on;
    }
    states.set(node.id, on === 0 ? 'unchecked' : on === total ? 'checked' : 'mixed');
    return { total, on };
  };
  nodes.forEach(visit);
  return states;
}

export function CheckboxTree({ nodes, defaultChecked = [], onChange }: CheckboxTreeProps) {
  // The ONLY source of truth: which leaves are checked. Parents are derived.
  const [checked, setChecked] = useState(() => new Set(defaultChecked));
  const [collapsed, setCollapsed] = useState(() => new Set<string>());

  const states = useMemo(() => computeStates(nodes, checked), [nodes, checked]);
  const allLeavesInOrder = useMemo(() => nodes.flatMap((n) => leavesOf(n)), [nodes]);

  function toggle(node: TreeNode) {
    const leaves = leavesOf(node);
    const turnOn = states.get(node.id) !== 'checked'; // unchecked or mixed → check all
    const next = new Set(checked);
    for (const id of leaves) {
      if (turnOn) next.add(id);
      else next.delete(id);
    }
    setChecked(next);
    // Called from the event handler (not an effect), with ids in tree order.
    onChange?.(allLeavesInOrder.filter((id) => next.has(id)));
  }

  function toggleExpanded(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const renderNodes = (list: TreeNode[]) =>
    list.map((node) => {
      const state = states.get(node.id)!;
      const leaf = isLeaf(node);
      const expanded = !collapsed.has(node.id);
      return (
        <li key={node.id}>
          {!leaf ? (
            <button
              type="button"
              aria-label={`Toggle ${node.label}`}
              aria-expanded={expanded}
              onClick={() => toggleExpanded(node.id)}
              style={{ width: 24, border: 0, background: 'none', cursor: 'pointer' }}
            >
              {expanded ? '▾' : '▸'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: 24 }} />
          )}
          <label>
            <Checkbox state={state} onToggle={() => toggle(node)} />
            {node.label}
          </label>
          {!leaf && expanded ? (
            <ul role="group" aria-label={node.label} style={{ listStyle: 'none', paddingLeft: 24 }}>
              {renderNodes(node.children!)}
            </ul>
          ) : null}
        </li>
      );
    });

  return <ul style={{ listStyle: 'none', paddingLeft: 0 }}>{renderNodes(nodes)}</ul>;
}

function Checkbox({ state, onToggle }: { state: NodeState; onToggle: () => void }) {
  return (
    <input
      type="checkbox"
      checked={state === 'checked'}
      aria-checked={state === 'mixed' ? 'mixed' : state === 'checked'}
      // `indeterminate` is a DOM property only (no HTML attribute), so set it via a ref callback.
      ref={(el: HTMLInputElement | null) => {
        if (el) el.indeterminate = state === 'mixed';
      }}
      onChange={onToggle}
    />
  );
}
