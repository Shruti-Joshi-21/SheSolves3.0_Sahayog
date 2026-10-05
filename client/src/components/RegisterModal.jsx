import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { X, Camera, User, Lock, Mail, Shield, Users, CheckCircle2, Loader } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';

const RegisterModal = ({ isOpen, onClose, role }) => {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [faceImage, setFaceImage] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [loading, setLoading] = useState(false);
    const webcamRef = useRef(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setFaceImage(imageSrc);
        setIsCapturing(false);
        toast.success("Face captured successfully!");
    }, [webcamRef]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name || !username || !password) {
            toast.error('Please fill in all fields.');
            return;
        }

        if (role === 'Field Worker' && !faceImage) {
            toast.error('Please capture your face for verification.');
            return;
        }

        setLoading(true);

        try {
            if (role === 'Field Worker') {
                const res = await fetch(faceImage);
                const blob = await res.blob();
                const formData = new FormData();
                formData.append('fullName', name);
                formData.append('username', username);
                formData.append('password', password);
                formData.append('faceImage',
                    new File([blob], 'face.jpg', { type: 'image/jpeg' }));
                await api.post('/auth/signup/field-worker', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else if (role === 'Team Lead') {
                await api.post('/auth/signup/team-lead',
                    { fullName: name, username, password });
            } else if (role === 'Administrator') {
                await api.post('/auth/signup/admin',
                    { fullName: name, username, password });
            }

            toast.success(`${role} registered successfully!`);
            setName('');
            setUsername('');
            setPassword('');
            setFaceImage(null);
            onClose();

        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                error.message ||
                'Registration failed. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const getRoleIcon = () => {
        switch (role) {
            case 'Field Worker': return <User className="text-[#427A43]" />;
            case 'Team Lead': return <Users className="text-[#246427]" />;
            case 'Administrator': return <Shield className="text-[#F8AC3B]" />;
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#FFFFFF] rounded-[20px] w-full max-w-md overflow-hidden relative shadow-[0_8px_32px_rgba(0,0,0,0.14)] p-0 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                
                {/* Header */}
                <div className="bg-[#F1F8E9] px-[24px] py-[16px] flex justify-between items-center border-b border-[#E0E7DC]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white shadow-sm">
                            {getRoleIcon()}
                        </div>
                        <div>
                            <h2 className="text-[1rem] font-semibold text-[#212121]">Register as {role}</h2>
                            <p className="text-xs text-[#616161]">Create your Sahayog account</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full text-[#616161] hover:text-[#246427] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-[24px] bg-[#FFFFFF] space-y-4 max-h-[70vh] overflow-y-auto">
                    
                    {/* Role Warning / Context */}
                    {(role === 'Field Worker') && (
                        <div className="bg-[#FFF8E1] border border-[#FFE082] p-3 rounded-[10px] flex gap-3 text-xs text-[#B07D00]">
                            <Camera size={16} className="shrink-0" />
                            <p>For Field Workers, face capture is mandatory for attendance verification during work.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-[0.875rem] font-medium text-[#212121] mb-[6px]">Full Name</label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#246427] transition-colors">
                                <User size={16} />
                            </span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-10 pr-[14px] py-[10px] bg-[#FFFFFF] border border-[#E0E7DC] rounded-[10px] text-[0.875rem] text-[#212121] focus:ring-0 focus:border-[#246427] focus:shadow-[0_0_0_3px_rgba(36,100,39,0.1)] outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-[#9E9E9E]"
                                placeholder="Enter your full name"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[0.875rem] font-medium text-[#212121] mb-[6px]">Username</label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#246427] transition-colors">
                                <Mail size={16} />
                            </span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-[14px] py-[10px] bg-[#FFFFFF] border border-[#E0E7DC] rounded-[10px] text-[0.875rem] text-[#212121] focus:ring-0 focus:border-[#246427] focus:shadow-[0_0_0_3px_rgba(36,100,39,0.1)] outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-[#9E9E9E]"
                                placeholder="Choose a username"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[0.875rem] font-medium text-[#212121] mb-[6px]">Password</label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#246427] transition-colors">
                                <Lock size={16} />
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-[14px] py-[10px] bg-[#FFFFFF] border border-[#E0E7DC] rounded-[10px] text-[0.875rem] text-[#212121] focus:ring-0 focus:border-[#246427] focus:shadow-[0_0_0_3px_rgba(36,100,39,0.1)] outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-[#9E9E9E]"
                                placeholder="Min 8 characters"
                                required
                                minLength={8}
                            />
                        </div>
                    </div>

                    {/* Face Capture Section - only for Volunteer */}
                    {(role === 'Field Worker') && (
                        <div className="pt-4 border-t border-gray-100">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Verification Photo</label>
                            
                            {faceImage ? (
                                <div className="relative rounded-2xl overflow-hidden border-2 border-green-500 shadow-inner">
                                    <img src={faceImage} alt="Captured" className="w-full aspect-video object-cover" />
                                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setIsCapturing(true)}
                                        className="absolute bottom-2 inset-x-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs py-2 rounded-lg font-bold hover:bg-white transition-colors"
                                    >
                                        Retake Photo
                                    </button>
                                </div>
                            ) : isCapturing ? (
                                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-[#005F02]">
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        className="w-full h-full object-cover"
                                        videoConstraints={{ facingMode: "user" }}
                                    />
                                    <div className="absolute bottom-4 inset-x-0 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={capture}
                                            className="w-12 h-12 rounded-full bg-[#005F02] text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                                        >
                                            <Camera size={24} />
                                        </button>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setIsCapturing(false)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsCapturing(true)}
                                    className="w-full aspect-video border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-gray-50 hover:border-[#005F02] hover:text-[#005F02] transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-green-50 flex items-center justify-center transition-colors">
                                        <Camera className="text-gray-400 group-hover:text-[#005F02]" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-500 group-hover:text-[#005F02]">Capture Reference Image</span>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="pt-4 border-t border-[#E0E7DC]">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full px-[20px] py-[10px] rounded-[10px] font-semibold text-[0.875rem] text-[#FFFFFF] shadow-sm transition-[background-color,shadow] duration-180 flex items-center justify-center gap-2 ${
                                loading ? 'bg-[#9E9E9E] cursor-not-allowed' : 'bg-[#246427] hover:bg-[#1a4d1c] hover:shadow'
                            }`}
                        >
                            {loading ? (
                                <>
                                    <Loader size={20} className="animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                "Sign Up"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterModal;
