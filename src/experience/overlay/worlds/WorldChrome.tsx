'use client';

/**
 * Restrained orientation chrome for the world stack: a breadcrumb of the
 * depths entered (each level clickable to return there), a Back control,
 * and the machine-readable depth. Deliberately quiet — a wayfinding
 * instrument inside the world, not a website header.
 */
import { useExperience } from '../../store';
import { breadcrumbLabels } from '../../worlds';

export function WorldChrome() {
  const stack = useExperience((s) => s.worldStack);
  const mode = useExperience((s) => s.mode);
  if (mode !== 'yol' || stack.length < 2) return null;
  const labels = breadcrumbLabels(stack);
  const depth = stack.length - 1;

  return (
    <nav className="wc-chrome" aria-label="World depth">
      <button
        className="wc-back"
        data-testid="world-back"
        aria-label="Back one level"
        onClick={() => useExperience.getState().popWorld()}
      >
        ← Back
      </button>
      <ol className="wc-crumbs" data-testid="world-depth" data-depth={depth}>
        {labels.map((label, i) => (
          <li key={`${i}-${label}`}>
            {i < labels.length - 1 ? (
              <button
                className="wc-crumb"
                onClick={() => {
                  const s = useExperience.getState();
                  if (i === 0) s.returnToDepth(0);
                  else s.returnToDepth(i);
                }}
              >
                {label}
              </button>
            ) : (
              <span className="wc-crumb current" aria-current="location">
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
