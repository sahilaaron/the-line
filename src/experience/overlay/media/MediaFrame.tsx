'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import type {
  AssetRecord,
  TreatmentPreset,
  YearVisualIdentity,
} from '@/src/data/identity';

/**
 * Reusable media presentation for historical imagery. The treatment (how an
 * image sits in the world: halftone print, diagram plate, contact sheet…)
 * comes from the asset manifest / the year identity — never ad hoc per
 * section. Captions and provenance labelling are STRUCTURAL identity: the
 * same convention in every year.
 *
 * Rules honoured here:
 * - alt text always present (from the manifest);
 * - generated/reconstructed media is labelled as such, never as archival;
 * - no readable text baked into images — captions are DOM.
 */

const SOURCE_LABEL: Record<AssetRecord['sourceType'], string> = {
  archival: 'archival',
  generated: 'generated illustration',
  reconstructed: 'illustrative reconstruction',
  placeholder: 'placeholder — awaiting imagery',
};

export interface MediaFrameProps {
  asset: AssetRecord;
  identity: YearVisualIdentity;
  /** override the manifest's treatment when composition needs it */
  treatment?: TreatmentPreset;
  /** render the typed caption + provenance line (default true) */
  captioned?: boolean;
  className?: string;
}

export function MediaFrame({
  asset,
  identity,
  treatment,
  captioned = true,
  className,
}: MediaFrameProps) {
  /** missing files degrade to a labelled empty plate, never a broken img */
  const [failed, setFailed] = useState(false);
  const t = treatment ?? asset.treatment ?? 'captioned';
  const focal = asset.focal
    ? `${Math.round(asset.focal.x * 100)}% ${Math.round(asset.focal.y * 100)}%`
    : undefined;
  const sub = asset.section ? identity.themes[asset.section] : undefined;

  return (
    <figure
      className={`mf mf-${t}${className ? ` ${className}` : ''}`}
      data-source={asset.sourceType}
      data-state={asset.assetState}
      data-crop={asset.crop}
      data-motif={sub?.motif}
    >
      <div className={`mf-media${failed ? ' mf-missing' : ''}`}>
        {failed ? (
          <div className="mf-missing-plate" role="img" aria-label={asset.alt} />
        ) : (
          <img
            src={asset.path}
            alt={asset.alt}
            loading="lazy"
            style={focal ? { objectPosition: focal } : undefined}
            onError={() => setFailed(true)}
          />
        )}
        <i className="mf-grain" aria-hidden />
        {t === 'halftone' && <i className="mf-dots" aria-hidden />}
        {sub?.motif === 'scanlines' && <i className="mf-scan" aria-hidden />}
      </div>
      {captioned && (
        <figcaption className="mf-caption">
          {asset.caption && <span className="mf-cap-text">{asset.caption}</span>}
          <span className="mf-cap-src">{SOURCE_LABEL[asset.sourceType]}</span>
        </figcaption>
      )}
    </figure>
  );
}
