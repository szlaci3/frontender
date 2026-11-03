import { useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Style } from '../../shared/style.ts';
import { SampleWebsite } from './SampleWebsite.tsx';
import { compileLocks, type Snapshot } from '../../shared/constraints.ts';
import { readEffective, type InspectionGroup } from './inspection.ts';
import sampleCss from './sample.css?inline';
import boundaryCss from './boundary.css?inline';

function updateIllustrationBackground(root: ShadowRoot) {
  const page = root.querySelector<HTMLElement>('.sample-page');
  if (!page) return;
  const background = getComputedStyle(page).backgroundColor;
  const channels = background.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) return;
  const alpha = channels[3] ?? 1;
  const linear = channels.slice(0, 3).map(channel => {
    const value = (channel * alpha + 255 * (1 - alpha)) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = .2126 * linear[0]! + .7152 * linear[1]! + .0722 * linear[2]!;
  if (luminance < .179) page.style.setProperty('--dark-illustration-background', background);
  else page.style.removeProperty('--dark-illustration-background');
}

export function Preview({ style, savedLayers, constraints, groups, onInspect, onRoot }: { style: Style; savedLayers?: readonly Style[]; constraints: Snapshot; groups: readonly InspectionGroup[]; onInspect: (values: Record<string, string>) => void; onRoot: (root: ShadowRoot) => void }) {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const attach = useCallback((host: HTMLDivElement | null) => {
    if (host) setRoot(host.shadowRoot ?? host.attachShadow({ mode: 'open' }));
  }, []);

  useEffect(() => {
    if (!root) return;
    onRoot(root);
    const update = () => {
      updateIllustrationBackground(root);
      onInspect(readEffective(root, groups));
    };
    update();
    const timer = setTimeout(update, 380);
    root.addEventListener('transitionend', update);
    root.addEventListener('change', update);
    return () => { clearTimeout(timer); root.removeEventListener('transitionend', update); root.removeEventListener('change', update); };
  }, [root, style, constraints, groups, onInspect, onRoot]);

  // Reuse the same root/portal across selection updates and StrictMode ref replays.
  // Never key the portal or sample component by the selected style ID.
  return <>
    <div className="preview-host" ref={attach} />
    {root && createPortal(<>
      <style>{`@layer baseline, selected, locks; @layer baseline { ${boundaryCss}\n${sampleCss} }`}</style>
      <style data-preview-locks>{`@layer locks { ${compileLocks(constraints)} }`}</style>
      <SampleWebsite style={style} savedLayers={savedLayers} />
    </>, root)}
  </>;
}
