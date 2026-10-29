import { ProbeCounter } from '../../shared/ProbeCounter';
import type { DemoProps } from '../../shared/demo';
import type * as Mod from './index';

export default function Demo({ impl }: DemoProps<typeof Mod>) {
  return (
    <div>
      <p style={{ fontSize: 13 }}>
        <ProbeCounter names={{ 'ThemedButton renders': 'ThemedButton', Clock: 'Clock', UserBadge: 'UserBadge' }} interval={500} />
      </p>
      <impl.AppProvider>
        <impl.Dashboard buttonCount={200} />
      </impl.AppProvider>
    </div>
  );
}
