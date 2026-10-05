import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import api from '../../utils/api';
import { Camera, MapPin, Loader, CheckCircle2, AlertTriangle, ArrowLeft, LogOut, LogIn, FileText } from 'lucide-react';
import { toast } from 'react-toastify';

const MarkAttendance = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const webcamRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [location, setLocation] = useState(null);
    const [error, setError] = useState('');
    const [attendance, setAttendance] = useState(null);
    const [result, setResult] = useState(null);

    useEffect(() => {
        fetchStatus();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                (err) => setError('Please allow location access to mark attendance.')
            );
        }
    }, [taskId]);

    const fetchStatus = async () => {
        try {
            const response = await api.get(`/attendance/current/${taskId}`);
            setAttendance(response.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setInitialLoading(false);
        }
    };

    const capture = useCallback(async () => {
        if (!location) {
            toast.error('Waiting for GPS location...');
            return;
        }

        const imageSrc = webcamRef.current.getScreenshot();
        const hasOpenSession =
            attendance && !attendance.checkOutTime && !attendance.check_out_time;
        const mode = hasOpenSession ? 'check-out' : 'check-in';

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            if (imageSrc) {
                const blob = await (await fetch(imageSrc)).blob();
                formData.append('face', new File([blob], "face.jpg", { type: "image/jpeg" }));
            }
            formData.append('taskId', taskId);
            formData.append('lat', location.lat);
            formData.append('lon', location.lon);

            const path = mode === 'check-in' ? '/attendance/check-in' : '/attendance/check-out';
            const response = await api.post(path, formData);

            setResult(response.data.data);
            toast.success(`${mode === 'check-in' ? 'Check-in' : 'Check-out'} recorded!`);
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [webcamRef, location, taskId, attendance]);

    if (initialLoading) return <div className="text-center py-10"><Loader className="animate-spin inline mr-2" /> Initializing...</div>;

    if (result) {
        return (
            <div className="max-w-md mx-auto bg-[#FFFFFF] rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC] p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${result.status === 'VERIFIED' ? 'bg-[#E8F5E9] text-[#246427]' : 'bg-[#FFF8E1] text-[#B07D00]'
                    }`}>
                    {result.status === 'VERIFIED' ? <CheckCircle2 className="w-12 h-12" /> : <AlertTriangle className="w-12 h-12" />}
                </div>
                <h2 className="text-[1.5rem] font-bold text-[#212121] mb-2">
                    {attendance ? 'Check-out' : 'Check-in'} {result.status}
                </h2>
                <p className="text-[#616161] mb-8">
                    {result.status === 'VERIFIED'
                        ? 'Your attendance has been verified automatically.'
                        : 'Your record has been flagged for supervisor review.'}
                </p>

                {result.flags?.length > 0 && (
                    <div className="bg-[#FFF8E1] p-4 rounded-[14px] text-left text-[0.875rem] text-[#B07D00] mb-8">
                        <ul className="list-disc pl-4 space-y-1">
                            {result.flags.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                    </div>
                )}

                <div className="space-y-3">
                    {(attendance || (result.status && !attendance)) && (
                        <button
                            onClick={() => navigate(`/worker/report/${taskId}`)}
                            className="w-full py-3 bg-[#246427] text-white rounded-[14px] font-bold hover:bg-[#1a4d1c] flex items-center justify-center gap-2"
                        >
                            <FileText className="w-5 h-5" /> Submit Full Report
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/worker')}
                        className="w-full py-3 bg-[#F9FBF7] text-[#616161] rounded-[14px] font-bold hover:bg-[#F1F8E9]"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const isCheckout = !!attendance;

    return (
        <div className="max-w-2xl mx-auto space-y-6">


            <div className="bg-[#FFFFFF] rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC] overflow-hidden">
                <div className="p-6 border-b border-[#E0E7DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isCheckout ? 'bg-[#FFF8E1] text-[#B07D00]' : 'bg-[#E8F5E9] text-[#246427]'}`}>
                            {isCheckout ? <LogOut className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-[1.125rem] font-bold text-[#212121]">{isCheckout ? 'End of Work' : 'Start of Work'}</h2>
                            <p className="text-[0.875rem] text-[#616161]">{isCheckout ? 'Perform face check-out' : 'Verify face to begin task'}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-[10px] text-[0.75rem] font-bold w-full sm:w-auto justify-center sm:justify-start ${location ? 'bg-[#E8F5E9] text-[#246427]' : 'bg-[#F9FBF7] text-[#9E9E9E]'
                        }`}>
                        <MapPin className="w-3 h-3" />
                        {location ? 'GPS Fixed' : 'Acquiring GPS...'}
                    </div>
                </div>

                <div className="relative aspect-video bg-black">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                        videoConstraints={{ facingMode: "user" }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center">
                        <button
                            onClick={capture}
                            disabled={loading || !location}
                            className={`group relative flex items-center justify-center w-20 h-20 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-95 border-4 border-white ${isCheckout ? 'bg-[#B07D00]' : 'bg-[#246427]'
                                } text-white disabled:opacity-50`}
                        >
                            {loading ? (
                                <Loader className="w-10 h-10 animate-spin" />
                            ) : (
                                <Camera className="w-10 h-10" />
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-[#FFEBEE] text-[#C62828] text-[0.875rem] border-t border-[#EF9A9A] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {error}
                    </div>
                )}
            </div>

            <div className="bg-[#E8F5E9] p-4 rounded-[20px] border border-[#A5D6A7] text-[0.875rem] text-[#246427] flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                <p className="font-medium">
                    Remember: Your location and face are verified against the task assignment.
                    Mismatches will flag your attendance for supervisor approval.
                </p>
            </div>
        </div>
    );
};

export default MarkAttendance;
