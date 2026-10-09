import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Plus, Loader2, Check, Star, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const WORK_TYPE_OPTIONS = [
  'Waste Collection',
  'Recycling Drive',
  'Awareness Campaign',
  'Shoreline Cleanup',
  'Tree Plantation',
  'Survey Drive',
  'Other',
];

const SKILL_OPTIONS = [
  'waste segregation',
  'tree plantation',
  'beach cleanup',
  'composting',
  'community awareness',
  'water testing',
  'data collection',
  'first aid',
];

// Mirrors WORK_TYPE_SKILLS in server/utils/constants.js
const WORK_TYPE_SKILLS = {
  'Waste Collection': ['waste segregation'],
  'Recycling Drive': ['waste segregation', 'composting'],
  'Awareness Campaign': ['community awareness'],
  'Shoreline Cleanup': ['beach cleanup', 'waste segregation'],
  'Tree Plantation': ['tree plantation'],
  'Survey Drive': ['data collection'],
  Other: [],
};

const BREAKDOWN_LABELS = {
  skills: 'Skill match',
  rating: 'Performance rating',
  experience: 'Experience',
  reliability: 'Attendance reliability',
  workload: 'Workload',
  proximity: 'Proximity',
};

const RADIUS_PRESETS = [100, 200, 300, 500];

const FIELD_SUGGESTIONS = [
  { label: 'Total weight (kg)', type: 'Number' },
  { label: 'Field workers present', type: 'Number' },
  { label: 'Vehicles deployed', type: 'Number' },
  { label: 'Site photo', type: 'Image' },
  { label: 'Hazards found', type: 'Text' },
  { label: 'Water bodies affected', type: 'Text' },
  { label: 'Task completed?', type: 'Yes/No' },
  { label: 'General remarks', type: 'Text' },
  { label: 'Hours on site', type: 'Number' },
  { label: 'Weather conditions', type: 'Text' },
  { label: 'Waste segregated?', type: 'Yes/No' },
  { label: 'Public feedback', type: 'Text' },
];

const CreateTask = () => {
  useAuth();
  const navigate = useNavigate();
  const debounceRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [availableWorkers, setAvailableWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [isLocFetching, setIsLocFetching] = useState(false);
  const [isWorkerFetching, setIsWorkerFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    workType: '',
    locationName: '',
    latitude: '',
    longitude: '',
    allowedRadius: 200,
    date: '',
    startTime: '',
    endTime: '',
    checkInBuffer: 15,
    checkOutBuffer: 15,
    requiredSkills: [],
  });
  const [expandedWorker, setExpandedWorker] = useState(null);
  const [topCount, setTopCount] = useState(0); // 0 = show all workers
  const [reportFields, setReportFields] = useState([
    { fieldName: 'Waste collected (kg)', fieldType: 'Number' },
    { fieldName: 'Area covered (sq m)', fieldType: 'Number' },
    { fieldName: 'Issues encountered', fieldType: 'Text' },
  ]);

  useEffect(() => {
    if (locationQuery.trim().length < 3) return setLocationSuggestions([]);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLocFetching(true);
      try {
        const response = await api.get(`/teamlead/location-search?q=${encodeURIComponent(locationQuery)}`);
        const { data } = response.data;
        setLocationSuggestions(data || []);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setIsLocFetching(false);
      }
    }, 500);
  }, [locationQuery]);

  useEffect(() => {
    const loadWorkers = async () => {
      if (currentStep !== 2 || !formData.date || !formData.startTime || !formData.endTime) return;
      setIsWorkerFetching(true);
      try {
        const params = new URLSearchParams({
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          workType: formData.workType,
          requiredSkills: formData.requiredSkills.join(','),
        });
        if (formData.latitude !== '' && formData.longitude !== '') {
          params.set('latitude', formData.latitude);
          params.set('longitude', formData.longitude);
        }
        const response = await api.get(`/teamlead/available-workers?${params.toString()}`);
        const { data } = response.data;
        setAvailableWorkers(data || []);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to fetch workers');
      } finally {
        setIsWorkerFetching(false);
      }
    };
    loadWorkers();
  }, [currentStep, formData.date, formData.startTime, formData.endTime, formData.workType, formData.requiredSkills, formData.latitude, formData.longitude]);

  const visibleWorkers = topCount ? availableWorkers.slice(0, topCount) : availableWorkers;

  const changeTopCount = (count) => {
    setTopCount(count);
    // Workers hidden by the Top-N filter must not stay assigned
    if (count) {
      const visibleIds = new Set(availableWorkers.slice(0, count).map((w) => w._id));
      setSelectedWorkers((prev) => prev.filter((id) => visibleIds.has(id)));
    }
  };

  const autoAssignTop = () => {
    const top = visibleWorkers.map((w) => w._id);
    setSelectedWorkers(top);
    toast.success(`Assigned top ${top.length} recommended worker${top.length === 1 ? '' : 's'}`);
  };

  const toggleSkill = (skill) =>
    setFormData((prev) => ({
      ...prev,
      requiredSkills: prev.requiredSkills.includes(skill)
        ? prev.requiredSkills.filter((s) => s !== skill)
        : [...prev.requiredSkills, skill],
    }));

  const submit = async () => {
    if (!reportFields.length) return;
    setIsSubmitting(true);
    try {
      const response = await api.post('/teamlead/tasks', {
        ...formData,
        assignedWorkers: selectedWorkers,
        reportFields,
      });
      const { data } = response.data;
      if (data) toast.success('Task created successfully!');
      navigate('/teamlead/tasks');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
      setIsSubmitting(false);
    }
  };

  const stepLabels = ['Task details', 'Assign workers', 'Report fields'];

  return (
    <div className="bg-transparent  p-6 space-y-5">


      <div className="bg-white rounded-xl border border-[#e8e0d0] p-6 space-y-6">
        <div>
          <div className="flex items-center px-4">
            {[1, 2, 3].map((s, idx) => (
              <React.Fragment key={s}>
                {/* Step Circle & Label Group */}
                <div className="flex flex-col items-center relative z-10 w-24">
                  <StepCircle step={s} currentStep={currentStep} />
                  <span
                    className={`text-[10px] uppercase tracking-wider mt-2 whitespace-nowrap ${
                      currentStep === s
                        ? 'text-[#1a4a1a] font-bold'
                        : currentStep > s
                          ? 'text-[#2d6b2d] font-medium'
                          : 'text-gray-400 font-normal'
                    }`}
                  >
                    {stepLabels[idx]}
                  </span>
                </div>
                
                {/* Connector Line */}
                {idx < 2 ? (
                  <div
                    className={`h-px flex-1 -mt-6 transition-all duration-300 ${
                      currentStep > s ? 'bg-[#2d6b2d]' : 'bg-gray-200'
                    }`}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>

        {currentStep === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Task title</label>
              <input
                className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors placeholder:text-gray-300"
                placeholder="Task title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Work type</label>
              <select
                className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
                value={formData.workType}
                onChange={(e) =>
                  setFormData({ ...formData, workType: e.target.value, requiredSkills: WORK_TYPE_SKILLS[e.target.value] || [] })
                }
              >
                <option value="">Select work type</option>
                {WORK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            {formData.workType ? (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Skills needed (used to rank workers)</label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map((skill) => {
                    const on = formData.requiredSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={
                          on
                            ? 'bg-[#1a4a1a] text-white text-xs font-medium px-3 py-1.5 rounded-full'
                            : 'border border-dashed border-[#c5deb0] text-[#2d6b2d] bg-[#f9fbf6] text-xs px-3 py-1.5 rounded-full hover:bg-[#eaf3de] transition-colors font-normal'
                        }
                      >
                        {on ? '✓ ' : ''}
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Field location</label>
              <input
                className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors placeholder:text-gray-300"
                placeholder="Field location"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
              />
              {isLocFetching ? <div className="h-8 w-full bg-gray-200 rounded-lg animate-pulse mt-1.5" /> : null}
              {locationSuggestions.map((loc, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full text-left bg-white border border-[#e8e0d0] rounded-lg p-2 mt-1 text-sm flex gap-2 items-center text-gray-800 font-normal hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      locationName: loc.displayName,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    });
                    setLocationQuery(loc.displayName);
                    setLocationSuggestions([]);
                  }}
                >
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  {loc.displayName}
                </button>
              ))}
            </div>
            {formData.locationName && formData.latitude !== '' && formData.longitude !== '' ? (
              <div className="bg-[#eaf3de] border border-[#c5deb0] rounded-lg px-3 py-2 text-xs text-[#27500A] flex items-center gap-2 mt-1.5">
                <span>Confirmed: {formData.locationName}</span>
              </div>
            ) : null}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Allowed radius (m)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {RADIUS_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFormData({ ...formData, allowedRadius: r })}
                    className={
                      formData.allowedRadius === r
                        ? 'bg-[#1a4a1a] text-white text-sm font-medium px-4 py-1.5 rounded-lg'
                        : 'bg-white border border-[#e8e0d0] text-gray-500 text-sm font-normal px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors'
                    }
                  >
                    {r}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={50}
                max={2000}
                className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
                value={formData.allowedRadius}
                onChange={(e) => setFormData({ ...formData, allowedRadius: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Task date</label>
                <input
                  type="date"
                  className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Start time</label>
                <input
                  type="time"
                  className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">End time</label>
                <input
                  type="time"
                  className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Check-in buffer (mins)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
                  value={formData.checkInBuffer}
                  onChange={(e) => setFormData({ ...formData, checkInBuffer: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Check-out buffer (mins)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors"
                  value={formData.checkOutBuffer}
                  onChange={(e) => setFormData({ ...formData, checkOutBuffer: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Description (optional)</label>
              <textarea
                className="w-full border border-[#e8e0d0] rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a] transition-colors placeholder:text-gray-300"
                rows={3}
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="bg-[#1a4a1a] hover:bg-[#2d6b2d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              onClick={() => setCurrentStep(2)}
            >
              Next: Assign workers →
            </button>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-4">
            {isWorkerFetching ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 w-full bg-gray-200 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : availableWorkers.length === 0 ? (
              <div className="border border-[#e8e0d0] rounded-xl p-6 text-center text-sm text-gray-400">
                No workers are free in this time window
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f9fbf6] border border-[#c5deb0] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-[#27500A]">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>
                      Ranked by skills, ratings, experience, reliability, workload and distance
                      {formData.workType ? ` for ${formData.workType}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border border-[#e8e0d0] rounded-lg px-2 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a]"
                      value={topCount}
                      onChange={(e) => changeTopCount(Number(e.target.value))}
                    >
                      <option value={0}>All workers</option>
                      {availableWorkers.map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Top {i + 1}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={autoAssignTop}
                      disabled={!topCount}
                      title={topCount ? `Assign the top ${topCount}` : 'Pick Top 1, 2, 3… first'}
                      className="bg-[#1a4a1a] hover:bg-[#2d6b2d] text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Auto-assign
                    </button>
                  </div>
                </div>

                <div className="border border-[#e8e0d0] rounded-xl overflow-hidden">
                  {visibleWorkers.map((w) => (
                    <WorkerMatchCard
                      key={w._id}
                      worker={w}
                      selected={selectedWorkers.includes(w._id)}
                      expanded={expandedWorker === w._id}
                      onToggle={() =>
                        setSelectedWorkers((prev) =>
                          prev.includes(w._id) ? prev.filter((id) => id !== w._id) : [...prev, w._id]
                        )
                      }
                      onExpand={() => setExpandedWorker((prev) => (prev === w._id ? null : w._id))}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="bg-white border border-[#e8e0d0] text-gray-600 text-sm font-normal px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setCurrentStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="bg-[#1a4a1a] hover:bg-[#2d6b2d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                onClick={() => setCurrentStep(3)}
              >
                Next: Report fields →
              </button>
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <div className="space-y-3">
              <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                <div className="min-w-[400px]">
                  <div className="bg-transparent rounded-t-lg px-4 py-2 grid grid-cols-[1fr_120px_40px] gap-2 text-[10px] uppercase tracking-widest text-gray-400 font-normal">
                    <span>Field name</span>
                    <span>Type</span>
                    <span />
                  </div>
                  <div id="report-fields-list" className="border border-[#e8e0d0] rounded-b-lg overflow-hidden">
                    {reportFields.map((f, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_120px_40px] items-center gap-2 px-4 py-2 border-b border-[#e8e0d0] last:border-0 bg-white"
                      >
                        <input
                          className="w-full border border-[#e8e0d0] rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-[#1a4a1a] transition-colors placeholder:text-gray-300"
                          placeholder="Field name"
                          value={f.fieldName}
                          onChange={(e) =>
                            setReportFields((prev) => prev.map((x, idx) => (idx === i ? { ...x, fieldName: e.target.value } : x)))
                          }
                        />
                        <select
                          className="border border-[#e8e0d0] rounded-lg px-2 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#1a4a1a]"
                          value={f.fieldType}
                          onChange={(e) =>
                            setReportFields((prev) => prev.map((x, idx) => (idx === i ? { ...x, fieldType: e.target.value } : x)))
                          }
                        >
                          <option>Number</option>
                          <option>Text</option>
                          <option>Image</option>
                          <option>Yes/No</option>
                          <option>Date</option>
                        </select>
                        <button
                          type="button"
                          className="w-6 h-6 border border-red-200 text-red-400 rounded-full text-sm leading-none hover:bg-red-50 font-normal"
                          onClick={() => setReportFields((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="border border-dashed border-[#c5deb0] text-[#2d6b2d] text-sm rounded-lg py-2 w-full hover:bg-[#eaf3de] transition-colors font-normal flex items-center justify-center gap-2"
                onClick={() => setReportFields((prev) => [...prev, { fieldName: '', fieldType: 'Text' }])}
              >
                <Plus className="w-3 h-3" />
                Add custom field
              </button>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-4 mb-2">Suggested fields</p>
              <div className="flex flex-wrap gap-2">
                {FIELD_SUGGESTIONS.map((s) => {
                  const exists = reportFields.some((rf) => rf.fieldName === s.label);
                  return (
                    <button
                      key={s.label}
                      type="button"
                      disabled={exists}
                      onClick={() => {
                        if (!exists) setReportFields((prev) => [...prev, { fieldName: s.label, fieldType: s.type }]);
                      }}
                      className={
                        exists
                          ? 'bg-gray-100 text-gray-300 text-xs px-3 py-1.5 rounded-full cursor-not-allowed font-normal'
                          : 'border border-dashed border-[#c5deb0] text-[#2d6b2d] bg-[#f9fbf6] text-xs px-3 py-1.5 rounded-full hover:bg-[#eaf3de] cursor-pointer transition-colors font-normal'
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                className="bg-white border border-[#e8e0d0] text-gray-600 text-sm font-normal px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setCurrentStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submit}
                className="bg-[#1a4a1a] hover:bg-[#2d6b2d] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create task
              </button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

function scoreColor(score) {
  if (score >= 30) return 'bg-[#246427]';
  if (score >= 15) return 'bg-[#F8AC3B]';
  return 'bg-[#C62828]';
}

function WorkerMatchCard({ worker: w, selected, expanded, onToggle, onExpand }) {
  const score = Math.max(0, Math.min(100, w.matchScore ?? 0));
  const rs = w.ratingSummary || {};
  const ratingValue = rs.countForWorkType ? rs.avgForWorkType : rs.avgOverall;
  const ratingCount = rs.countForWorkType || rs.countOverall || 0;
  const initialsText =
    String(w.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .reduce((acc, part, i, arr) => (i === 0 || i === arr.length - 1 ? acc + part[0].toUpperCase() : acc), '')
      .slice(0, 2) || '?';

  return (
    <div className={`border-b border-[#e8e0d0] last:border-0 ${selected ? 'bg-[#f9fbf6]' : 'bg-white'}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? `Unassign ${w.name}` : `Assign ${w.name}`}
          className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            selected ? 'bg-[#1a4a1a] border-[#1a4a1a]' : 'border-gray-300 bg-white hover:border-[#1a4a1a]'
          }`}
        >
          {selected ? <Check className="w-4 h-4 text-white" /> : null}
        </button>

        <div className="w-8 h-8 rounded-full bg-[#eaf3de] text-[#27500A] text-xs font-medium flex items-center justify-center shrink-0">
          {initialsText}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{w.name}</span>
            {w.recommended ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold bg-[#1a4a1a] text-white px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                Recommended
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              {ratingCount ? (
                <>
                  <Star className="w-3.5 h-3.5 fill-[#F8AC3B] text-[#F8AC3B]" />
                  {ratingValue} <span className="text-gray-400">({ratingCount})</span>
                </>
              ) : (
                <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">No ratings yet</span>
              )}
            </span>
            <span
              className={`text-xs ml-auto shrink-0 ${(w.weeklyHours || 0) > 35 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}
            >
              {(w.weeklyHours || 0) > 35 ? '⚠ ' : ''}
              {w.weeklyHours || 0}h/wk
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-800 w-14 text-right">{score}/100</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {(w.reasons || []).slice(0, expanded ? undefined : 4).map((r) => (
              <span
                key={r}
                className={`text-xs px-2 py-0.5 rounded-full font-normal ${
                  r.startsWith('⚠') || r.startsWith('Only') ? 'bg-[#faeeda] text-[#633806]' : 'bg-[#eaf3de] text-[#27500A]'
                }`}
              >
                {r}
              </span>
            ))}
          </div>

          {expanded && w.breakdown ? (
            <div className="mt-2 space-y-1.5 bg-white border border-[#e8e0d0] rounded-lg p-3">
              {Object.entries(w.breakdown).map(([key, b]) => (
                <div key={key} className="grid grid-cols-[110px_1fr_48px] sm:grid-cols-[150px_1fr_52px] items-center gap-2 text-xs">
                  <span className="text-gray-600">{BREAKDOWN_LABELS[key] || key}</span>
                  <div className="min-w-0">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2d6b2d] rounded-full" style={{ width: `${(b.score / b.max) * 100}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-400">{b.detail}</span>
                  </div>
                  <span className="text-gray-700 text-right font-medium">
                    {b.score}/{b.max}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onExpand}
            className="text-xs text-[#1a4a1a] hover:underline inline-flex items-center gap-1"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Hide score breakdown' : 'Why this score?'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCircle({ step, currentStep }) {
  const done = currentStep > step;
  const active = currentStep === step;
  return (
    <div className="relative">
      {active && (
        <motion.div
          className="absolute inset-0 rounded-full bg-[#1a4a1a]"
          initial={{ scale: 1, opacity: 0.4 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut"
          }}
        />
      )}
      <div
        className={`w-9 h-9 rounded-full text-sm flex items-center justify-center shrink-0 relative z-10 ${
          done
            ? 'bg-[#2d6b2d] text-white'
            : active
              ? 'bg-[#1a4a1a] text-white'
              : 'bg-white border border-gray-300 text-gray-400'
        }`}
      >
        {done ? '✓' : step}
      </div>
    </div>
  );
}

export default CreateTask;
