import L from 'leaflet';

export function createSvgPinIcon(fillColor: string, strokeColor = '#ffffff'): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
      <path d="M14 1C6.82 1 1 6.82 1 14c0 9.75 13 24.5 13 24.5S27 23.75 27 14C27 6.82 21.18 1 14 1z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="#ffffff"/>
    </svg>
  `;

  return L.divIcon({
    className: 'custom-svg-pin',
    html: svg,
    iconSize: [28, 40],
    iconAnchor: [14, 39],
    popupAnchor: [0, -34],
  });
}

export const interestMapIcons = {
  Alto: createSvgPinIcon('#ef4444'),   // Red
  Medio: createSvgPinIcon('#3b82f6'),  // Blue
  Bajo: createSvgPinIcon('#eab308'),   // Amber/Yellow
};

export const userLocationIcon = createSvgPinIcon('#1e293b', '#38bdf8');
export const defaultSelectedIcon = createSvgPinIcon('#e07a5f');
