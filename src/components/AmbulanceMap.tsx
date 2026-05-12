import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Ambulance } from '../types';
import { TRIAGE_COLORS } from '../types';

// ── Fix Leaflet default icon image paths broken by Vite bundling ──
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// ── Custom DivIcon helpers ──
function makeAmbIcon(color: string, pulse: boolean) {
  return L.divIcon({
    className: '',
    html: `
      <div class="amb-map-marker${pulse ? ' pulse' : ''}" style="--mc:${color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1"/>
          <path d="M16 8h4l3 4v4h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function makeHospitalIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div class="hospital-map-marker">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
      </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  });
}

// ── Auto-fit map bounds to all markers ──
function AutoFit({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [positions.map(p => p.join(',')).join('|')]);
  return null;
}

// ── ETA countdown helper ──
function etaCountdown(amb: Ambulance, now: Date): string {
  const elapsed = (now.getTime() - new Date(amb.dispatchedAt).getTime()) / 60000;
  const remaining = Math.max(0, amb.eta - elapsed);
  if (remaining < 1) return 'Arriving now';
  return `~${Math.ceil(remaining)} min`;
}

// ── Props ──
interface Props {
  ambulances: Ambulance[];
  hospitalPos: [number, number];
  now: Date;
  mini?: boolean;
  singlePos?: [number, number]; // for check-in mini-map
  singleLabel?: string;
}

export default function AmbulanceMap({ ambulances, hospitalPos, now, mini = false, singlePos, singleLabel }: Props) {
  const mapRef = useRef<L.Map | null>(null);

  const ambsWithGps = ambulances.filter(a => a.lat != null && a.lng != null && a.status === 'en-route');
  const allPositions: [number, number][] = [
    hospitalPos,
    ...ambsWithGps.map(a => [a.lat!, a.lng!] as [number, number]),
    ...(singlePos ? [singlePos] : []),
  ];

  const center = singlePos ?? (ambsWithGps.length > 0 ? ([ambsWithGps[0].lat!, ambsWithGps[0].lng!] as [number, number]) : hospitalPos);

  return (
    <MapContainer
      center={center}
      zoom={13}
      className={mini ? 'leaflet-mini' : 'leaflet-full'}
      ref={mapRef}
      attributionControl={!mini}
      zoomControl={!mini}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Hospital pin */}
      {!singlePos && (
        <Marker position={hospitalPos} icon={makeHospitalIcon()}>
          <Popup>
            <strong>🏥 MediQ Hospital</strong><br />
            ER headquarters
          </Popup>
        </Marker>
      )}

      {/* Ambulance markers */}
      {ambsWithGps.map(amb => {
        const color = TRIAGE_COLORS[amb.priority];
        const pos: [number, number] = [amb.lat!, amb.lng!];
        return (
          <Marker key={amb.id} position={pos} icon={makeAmbIcon(color, true)}>
            {/* Pulse ring */}
            <CircleMarker
              center={pos}
              radius={22}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 1.5, opacity: 0.5 }}
            />
            <Popup>
              <div className="amb-map-popup">
                <div className="amp-popup-header" style={{ borderLeft: `3px solid ${color}` }}>
                  <strong>🚑 {amb.unitNumber}</strong>
                  <span className="amp-popup-priority" style={{ background: color }}>{amb.priority}</span>
                </div>
                <p><b>Patient:</b> {amb.patientName}{amb.sex ? ` (${amb.sex[0]})` : ''}{amb.age != null ? `, ${amb.age}y` : ''}</p>
                <p><b>Complaint:</b> {amb.chiefComplaint}</p>
                <p><b>ETA:</b> {etaCountdown(amb, now)}</p>
                {amb.lastLocationUpdate && (
                  <p className="amp-popup-gps">
                    📍 {amb.lat!.toFixed(5)}, {amb.lng!.toFixed(5)}
                  </p>
                )}
                {amb.notes && <p><b>Notes:</b> {amb.notes}</p>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Single device position (for check-in mini-map) */}
      {singlePos && (
        <CircleMarker
          center={singlePos}
          radius={10}
          pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.85, weight: 3 }}
        >
          <Popup>{singleLabel ?? 'Your location'}</Popup>
        </CircleMarker>
      )}

      <AutoFit positions={allPositions} />
    </MapContainer>
  );
}
