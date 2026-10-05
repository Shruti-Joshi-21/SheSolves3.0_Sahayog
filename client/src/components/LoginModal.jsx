import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, User, Lock, Loader, Shield, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../utils/api';

// Map landing-page display role → backend role constant
const ROLE_MAP = {
  'Field Worker': 'FIELD_WORKER',
  'Team Lead': 'TEAM_LEAD',
  'Administrator': 'ADMIN',
};

// Human-readable label used in the mismatch message
const ROLE_LABEL = {
  'Field Worker': 'Field Worker',
  'Team Lead': 'Team Lead',
  'Administrator': 'Administrator',
};

const LoginModal = ({ isOpen, onClose, role }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [roleMismatch, setRoleMismatch] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Reset form state whenever the modal opens / role changes
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setError('');
      setRoleMismatch(false);
    }
  }, [isOpen, role]);

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setError('');
    setRoleMismatch(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setRoleMismatch(false);

    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, role: userRole, name, id } = response.data.data;

      // ── Role mismatch guard ──────────────────────────────────────────────
      const expectedRole = ROLE_MAP[role];
      if (expectedRole && userRole !== expectedRole) {
        // Show mismatch popup — do NOT persist token or navigate
        setRoleMismatch(true);
        return;
      }
      // ────────────────────────────────────────────────────────────────────

      localStorage.setItem('sahayog_token', token);
      localStorage.setItem('sahayog_role', userRole);

      login({ token, role: userRole, name, id });

      toast.success(`Welcome back, ${name || userRole}!`);

      if (userRole === 'ADMIN') navigate('/admin');
      else if (userRole === 'TEAM_LEAD') navigate('/teamlead');
      else if (userRole === 'FIELD_WORKER') navigate('/worker');
      else navigate('/');

      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getRoleIcon = () => {
    switch (role) {
      case 'Field Worker':
        return <User className="text-[#427A43]" />;
      case 'Team Lead':
        return <Users className="text-[#246427]" />;
      case 'Administrator':
        return <Shield className="text-[#F8AC3B]" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FFFFFF] rounded-[20px] w-full max-w-sm overflow-hidden relative shadow-[0_8px_32px_rgba(0,0,0,0.14)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="bg-[#F1F8E9] px-[24px] py-[16px] flex justify-between items-center border-b border-[#E0E7DC]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white shadow-sm">{getRoleIcon()}</div>
            <div>
              <h2 className="text-[1rem] font-semibold text-[#212121]">Login as {role}</h2>
              <p className="text-xs text-[#616161]">Access your Sahayog dashboard</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full text-[#616161] hover:text-[#246427] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-[24px] space-y-5 bg-[#FFFFFF]">
          {roleMismatch && (
            <div className="flex items-start gap-3 bg-[#FFF8E1] border border-[#F8AC3B] text-[#7A5400] px-4 py-3 rounded-xl text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[#F8AC3B]" />
              <p>
                <span className="font-semibold">Access denied.</span> This {ROLE_LABEL[role]} does not exist.
                Please use the correct login portal for your role.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-in shake-in duration-300">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[0.875rem] font-medium text-[#212121] mb-[6px]">Username</label>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#246427] transition-colors">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-[14px] py-[10px] bg-[#FFFFFF] border border-[#E0E7DC] rounded-[10px] text-[0.875rem] text-[#212121] focus:ring-0 focus:border-[#246427] focus:shadow-[0_0_0_3px_rgba(36,100,39,0.1)] outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-[#9E9E9E]"
                placeholder="Username / Email"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[0.875rem] font-medium text-[#212121] mb-[6px]">Password</label>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#246427] transition-colors">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-[14px] py-[10px] bg-[#FFFFFF] border border-[#E0E7DC] rounded-[10px] text-[0.875rem] text-[#212121] focus:ring-0 focus:border-[#246427] focus:shadow-[0_0_0_3px_rgba(36,100,39,0.1)] outline-none transition-[border-color,box-shadow] duration-180 placeholder:text-[#9E9E9E]"
                placeholder="Password"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`w-full px-[20px] py-[10px] rounded-[10px] font-semibold text-[0.875rem] text-[#FFFFFF] shadow-sm transition-[background-color,shadow] duration-180 flex items-center justify-center gap-3 ${
                loading ? 'bg-[#9E9E9E] cursor-not-allowed' : 'bg-[#246427] hover:bg-[#1a4d1c] hover:shadow'
              }`}
            >
              {loading ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
              By signing in, you agree to the Sahayog Terms & Privacy Policy
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
