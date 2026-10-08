import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import '../utils/leafletIconFix';
import { fetchMapData } from '../utils/mapApi';
import TaskMapPopup from './TaskMapPopup';

const markerIcon = (color) =>
  new L.DivIcon({
    className: '',
    html: `<div style="
      width: 16px; height: 16px; border-radius: 50%;
      background:${color}; border: 2px solid white;
      box-shadow: 0 0 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const statusHex = {
  COMPLETED: '#246427',
  IN_PROGRESS: '#F8AC3B',
  PENDING: '#9CA3AF',
  FLAGGED: '#EF4444',
};

const filters = [
  { label: 'All', value: 'ALL' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Flagged', value: 'FLAGGED' },
];

export default function AdminTaskMap() {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    loadData();
  }, [activeFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchMapData({ status: activeFilter });
      setPins(data);
    } catch (err) {
      console.error('Failed to load map data', err);
    } finally {
      setLoading(false);
    }
  };

  // Default center — fallback to first pin or a default city center
  const center = pins.length > 0 ? [pins[0].lat, pins[0].lng] : [19.076, 72.8777];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-800">Active task locations today</h3>
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                activeFilter === f.value
                  ? 'bg-[#246427] text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden" style={{ height: '420px' }}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <span className="text-sm text-gray-400">Loading map data...</span>
          </div>
        ) : pins.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <span className="text-sm text-gray-400">No task activity to show yet</span>
          </div>
        ) : (
          <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© OpenStreetMap contributors'
            />
            {pins.map((pin, idx) => (
              <Marker
                key={`${pin.taskId}-${idx}`}
                position={[pin.lat, pin.lng]}
                icon={markerIcon(statusHex[pin.status] || statusHex.PENDING)}
                eventHandlers={{
                  click: () => setSelectedPin(pin),
                }}
              />
            ))}
          </MapContainer>
        )}

        {selectedPin && (
          <TaskMapPopup pin={selectedPin} onClose={() => setSelectedPin(null)} />
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#246427] inline-block" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#F8AC3B] inline-block" /> In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Flagged
        </span>
      </div>
    </div>
  );
}