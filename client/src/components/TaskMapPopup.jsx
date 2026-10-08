import { format } from 'date-fns';
import { X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const statusColors = {
  COMPLETED: { bg: 'bg-[#246427]/10', text: 'text-[#246427]', dot: 'bg-[#246427]' },
  IN_PROGRESS: { bg: 'bg-[#F8AC3B]/10', text: 'text-[#F8AC3B]', dot: 'bg-[#F8AC3B]' },
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
  FLAGGED: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
};

export default function TaskMapPopup({ pin, onClose }) {
  const navigate = useNavigate();
  const colors = statusColors[pin.status] || statusColors.PENDING;

  return (
    <div
      className={`absolute z-[1000] right-4 top-4 w-[340px] bg-white rounded-2xl shadow-xl border 
      ${pin.isFlagged ? 'border-red-400' : 'border-gray-100'} p-5 font-[Outfit]`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-base">{pin.taskName}</h3>
          <p className="text-xs text-gray-500 mt-0.5">📍 {pin.locationAddress || 'No address available'}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      {/* Workers */}
      <div className="flex items-center gap-2 mb-3">
        {pin.workers.length > 0 ? (
          pin.workers.map((w) => (
            <div key={w.id} className="flex items-center gap-1.5 bg-[#246427]/5 px-2 py-1 rounded-full">
              <div className="w-5 h-5 rounded-full bg-[#246427] text-white text-[10px] flex items-center justify-center font-medium">
                {w.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-gray-700">{w.name}</span>
            </div>
          ))
        ) : (
          <span className="text-xs text-gray-400 italic">No worker assigned</span>
        )}
      </div>

      {/* Time */}
      <div className="text-xs text-gray-500 mb-3">
        🕐{' '}
        {pin.checkIn
          ? `${format(new Date(pin.checkIn), 'd MMM, h:mm a')} ${
              pin.checkOut ? `– ${format(new Date(pin.checkOut), 'h:mm a')}` : '(still active)'
            }`
          : 'Not checked in yet'}
      </div>

      {/* Photos */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-gray-400 mb-1">BEFORE</p>
          {pin.beforePhoto ? (
            <img
              src={pin.beforePhoto}
              alt="before"
              className="w-full h-24 object-cover rounded-lg"
              onError={(e) => (e.target.src = '/placeholder-image.png')}
            />
          ) : (
            <div className="w-full h-24 rounded-lg bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center px-2">
              No report submitted yet
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-1">AFTER</p>
          {pin.afterPhoto ? (
            <img
              src={pin.afterPhoto}
              alt="after"
              className="w-full h-24 object-cover rounded-lg"
              onError={(e) => (e.target.src = '/placeholder-image.png')}
            />
          ) : (
            <div className="w-full h-24 rounded-lg bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center px-2">
              Awaiting submission
            </div>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {pin.status.replace('_', ' ')}
        </span>

        {pin.fieldReportId && (
          <button
            onClick={() => navigate(`/admin/reports/${pin.fieldReportId}`)} 
            // 🔧 ADJUST: match your actual field report detail route path
            className="flex items-center gap-1 text-xs font-medium text-[#246427] hover:underline"
          >
            View Full Report <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}