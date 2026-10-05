import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { FileText, Camera, Send, Loader, ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'react-toastify';

const SubmitReport = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [description, setDescription] = useState('');
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (images.length + files.length > 5) {
            toast.warning('Max 5 images allowed');
            return;
        }

        setImages([...images, ...files]);

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviews([...previews, ...newPreviews]);
    };

    const removeImage = (index) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);

        const newPreviews = [...previews];
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description) {
            toast.error('Please add a description');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('taskId', taskId);
            formData.append('description', description);
            images.forEach(img => formData.append('images', img));

            await api.post('/attendance/report', formData);

            toast.success('Report submitted successfully!');
            navigate('/worker');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">


            <div className="bg-[#FFFFFF] rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E0E7DC] p-4 sm:p-8">


                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[0.875rem] font-semibold text-[#212121] mb-2">Work Description</label>
                        <textarea
                            className="w-full px-4 py-3 border border-[#E0E7DC] rounded-[14px] outline-none focus:ring-2 focus:ring-[#246427] h-40 resize-none transition-all placeholder-[#BDBDBD]"
                            placeholder="Describe the tasks completed and any issues encountered..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[0.875rem] font-semibold text-[#212121] mb-3">Onsite Photos (Max 5)</label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            {previews.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden border border-[#E0E7DC] group">
                                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(i)}
                                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {previews.length < 5 && (
                                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-[#E0E7DC] rounded-[10px] hover:border-[#246427] hover:bg-[#F1F8E9] cursor-pointer transition-all">
                                    <Camera className="w-6 h-6 text-[#9E9E9E]" />
                                    <span className="text-[10px] font-bold text-[#9E9E9E] mt-1 uppercase">Add</span>
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                                </label>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#246427] text-white rounded-[14px] font-bold hover:bg-[#1a4d1c] transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Submit Final Report</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SubmitReport;
