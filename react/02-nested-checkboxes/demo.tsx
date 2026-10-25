import { useState } from 'react';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

const nodes: Mod.TreeNode[] = [
  {
    id: 'repo',
    label: 'Repository',
    children: [
      { id: 'repo.read', label: 'Read code' },
      { id: 'repo.write', label: 'Push commits' },
      {
        id: 'repo.admin',
        label: 'Administration',
        children: [
          { id: 'repo.admin.settings', label: 'Change settings' },
          { id: 'repo.admin.delete', label: 'Delete repository' },
        ],
      },
    ],
  },
  {
    id: 'issues',
    label: 'Issues',
    children: [
      { id: 'issues.read', label: 'Read issues' },
      { id: 'issues.write', label: 'Create and edit issues' },
    ],
  },
  { id: 'billing', label: 'Billing' },
];

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  const [ids, setIds] = useState<string[]>(['repo.read']);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: 16 }}>
      <impl.CheckboxTree nodes={nodes} defaultChecked={['repo.read']} onChange={setIds} />
      <pre style={{ fontSize: 12, margin: 0 }}>{JSON.stringify(ids, null, 2)}</pre>
    </div>
  );
}
