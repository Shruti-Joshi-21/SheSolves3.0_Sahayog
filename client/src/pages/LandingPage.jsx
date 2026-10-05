import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  MapPin, 
  BarChart3, 
  ClipboardList, 
  Users, 
  User, 
  CalendarDays,
  Twitter, 
  Instagram, 
  Github
} from 'lucide-react';
import RegisterModal from '../components/RegisterModal';
import LoginModal from '../components/LoginModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  const handleOpenRegister = (role) => {
    setSelectedRole(role);
    setIsRegisterModalOpen(true);
  };

  const handleOpenLogin = (role) => {
    setSelectedRole(role);
    setIsLoginModalOpen(true);
  };

  useEffect(() => {
    // Inject fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Merriweather:wght@400;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Scroll listener for navbar shadow
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    
    // Hero fade-in animation trigger
    const timer = setTimeout(() => setVisible(true), 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, []);

  const scrollToFeatures = (e) => {
    e.preventDefault();
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="font-sans min-h-screen flex flex-col pt-16" style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F1F8E9' }}>
      {/* 1. NAVBAR */}
      <nav 
        className={`fixed top-0 left-0 w-full z-50 bg-[#F1F8E9] transition-all duration-300 border-b border-[#E0D9C8] ${
          scrolled ? 'shadow-md py-3' : 'py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/sahayog_icon.svg" alt="Sahayog" className="w-11 h-11 object-contain" />
            <div className="flex flex-col">
              <span className="font-bold text-[#005F02] text-[1.1rem] leading-none" style={{ fontFamily: "'Merriweather', serif" }}>
                Sahayog
              </span>
              <span className="text-[0.65rem] text-[#616161] tracking-wide mt-1">
                Field Operations Management
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-[#1A1A1A] font-medium hover:text-[#F8AC3B] transition-colors relative group">
              Home
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#F8AC3B] transition-all group-hover:w-full"></span>
            </a>
            <a href="#features" onClick={scrollToFeatures} className="text-[#1A1A1A] font-medium hover:text-[#F8AC3B] transition-colors relative group">
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#F8AC3B] transition-all group-hover:w-full"></span>
            </a>
            <a href="#" className="text-[#1A1A1A] font-medium hover:text-[#F8AC3B] transition-colors relative group">
              About
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#F8AC3B] transition-all group-hover:w-full"></span>
            </a>
            <a href="#" className="text-[#1A1A1A] font-medium hover:text-[#F8AC3B] transition-colors relative group">
              Contact
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#F8AC3B] transition-all group-hover:w-full"></span>
            </a>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="bg-[#005F02] w-full min-h-[520px] py-[80px] px-6 lg:px-12 flex items-center overflow-hidden">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* LEFT COLUMN */}
          <div className="flex flex-col">
            <h1 
              className={`text-white font-bold leading-[1.2] text-[clamp(2rem,4vw,3rem)] transition-all duration-700 transform ${
                visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
              style={{ fontFamily: "'Merriweather', serif" }}
            >
              Streamline Your <span className="text-[#F8AC3B]">Field</span><br />
              Operations
            </h1>
            
            <p 
              className={`text-white/60 mt-4 text-base max-w-[420px] leading-relaxed transition-all duration-700 delay-100 transform ${
                visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
            >
              Comprehensive attendance tracking, leave management, task
              planning, and reporting system designed specifically for
              environmental NGOs and field operations.
            </p>

            <div 
              className={`flex flex-wrap gap-3 mt-6 transition-all duration-700 delay-200 transform ${
                visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/40 bg-white/10 text-white text-sm backdrop-blur-sm">
                <MapPin size={14} /> Location Tracking
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/40 bg-white/10 text-white text-sm backdrop-blur-sm">
                <BarChart3 size={14} /> Real-time Analytics
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/40 bg-white/10 text-white text-sm backdrop-blur-sm">
                <ClipboardList size={14} /> Task Management
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="relative w-full h-[380px] flex items-center justify-center">
            <img 
              src="/OBJECTS.svg" 
              alt="Sahayog illustration" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </section>

      {/* 3. DASHBOARD ACCESS SECTION */}
      <section className="bg-white py-[80px] px-6 md:px-[40px] w-full shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#212121] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
              Access Your Dashboard
            </h2>
            <p className="text-[#616161]">Choose your role to get started with Sahayog</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Card 1 - Volunteer */}
            <div className="bg-[#F9F9F5] border border-[#E0D9C8] rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-[#427A43] hover:-translate-y-1 transition-all duration-250 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mb-6">
                <User size={32} color="#427A43" />
              </div>
              <h3 className="text-[1.2rem] font-bold text-[#1A1A1A] mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
                Field Worker
              </h3>
              <p className="text-center text-[#555] text-[0.875rem] mb-6 min-h-[60px]">
                Access your attendance records, submit daily reports, and manage your field activities.
              </p>
              <ul className="w-full space-y-2 mb-8 text-[0.875rem] text-[#333]">
                <li className="flex items-center gap-2"><span className="text-[#427A43] font-bold">✓</span> Check-in with location</li>
                <li className="flex items-center gap-2"><span className="text-[#427A43] font-bold">✓</span> Submit daily reports</li>
                <li className="flex items-center gap-2"><span className="text-[#427A43] font-bold">✓</span> Request leave</li>
                <li className="flex items-center gap-2"><span className="text-[#427A43] font-bold">✓</span> View assigned tasks</li>
              </ul>
              <button
                onClick={() => handleOpenLogin('Field Worker')}
                className="w-full bg-[#427A43] hover:bg-[#005F02] text-white rounded-lg py-2.5 transition-colors font-medium mt-auto"
              >
                Login as Field Worker
              </button>
              <p className="mt-4 text-[0.8rem] text-gray-500">
                Don't have an account?{' '}
                <button 
                  onClick={() => handleOpenRegister('Field Worker')}
                  className="text-[#427A43] font-bold hover:underline"
                >
                  Sign up
                </button>
              </p>
            </div>

            {/* Card 2 - Team Lead */}
            <div className="bg-[#F9F9F5] border border-[#E0D9C8] rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-[#427A43] hover:-translate-y-1 transition-all duration-250 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#005F02] flex items-center justify-center mb-6 mt-2">
                <Users size={32} color="#ffffff" />
              </div>
              <h3 className="text-[1.2rem] font-bold text-[#1A1A1A] mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
                Team Lead
              </h3>
              <p className="text-center text-[#555] text-[0.875rem] mb-6 min-h-[60px]">
                Manage your team, assign tasks, approve leave requests, and monitor field attendance.
              </p>
              <ul className="w-full space-y-2 mb-8 text-[0.875rem] text-[#333]">
                <li className="flex items-center gap-2"><span className="text-[#005F02] font-bold">✓</span> Team attendance overview</li>
                <li className="flex items-center gap-2"><span className="text-[#005F02] font-bold">✓</span> Task assignment & tracking</li>
                <li className="flex items-center gap-2"><span className="text-[#005F02] font-bold">✓</span> Leave approval workflow</li>
                <li className="flex items-center gap-2"><span className="text-[#005F02] font-bold">✓</span> Team performance reports</li>
              </ul>
              <button
                onClick={() => handleOpenLogin('Team Lead')}
                className="w-full bg-[#005F02] hover:bg-[#003D01] text-white rounded-lg py-2.5 transition-colors font-medium mt-auto"
              >
                Login as Team Lead
              </button>
              <p className="mt-4 text-[0.8rem] text-gray-500">
                Don't have an account?{' '}
                <button 
                  onClick={() => handleOpenRegister('Team Lead')}
                  className="text-[#005F02] font-bold hover:underline"
                >
                  Sign up
                </button>
              </p>
            </div>

            {/* Card 3 - Admin */}
            <div className="bg-[#F9F9F5] border border-[#E0D9C8] rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-[#427A43] hover:-translate-y-1 transition-all duration-250 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF8E1] flex items-center justify-center mb-6">
                <Shield size={32} color="#F8AC3B" />
              </div>
              <h3 className="text-[1.2rem] font-bold text-[#1A1A1A] mb-3" style={{ fontFamily: "'Merriweather', serif" }}>
                Administrator
              </h3>
              <p className="text-center text-[#555] text-[0.875rem] mb-6 min-h-[60px]">
                Full system access with analytics, user management, and organizational oversight.
              </p>
              <ul className="w-full space-y-2 mb-8 text-[0.875rem] text-[#333]">
                <li className="flex items-center gap-2"><span className="text-[#F8AC3B] font-bold">✓</span> Organization-wide analytics</li>
                <li className="flex items-center gap-2"><span className="text-[#F8AC3B] font-bold">✓</span> User & role management</li>
                <li className="flex items-center gap-2"><span className="text-[#F8AC3B] font-bold">✓</span> System configuration</li>
                <li className="flex items-center gap-2"><span className="text-[#F8AC3B] font-bold">✓</span> Advanced reporting</li>
              </ul>
              <button
                onClick={() => handleOpenLogin('Administrator')}
                className="w-full bg-[#F8AC3B] hover:bg-[#a89a5e] text-[#1A1A1A] rounded-lg py-2.5 transition-colors font-medium mt-auto"
              >
                Login as Admin
              </button>
              <p className="mt-4 text-[0.8rem] text-gray-500">
                Don't have an account?{' '}
                <button 
                  onClick={() => handleOpenRegister('Administrator')}
                  className="text-[#F8AC3B] font-bold hover:underline"
                >
                  Sign up
                </button>
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. FEATURES SECTION */}
      <section id="features" className="bg-[#f9f9f5] py-[80px] px-6 md:px-[40px] w-full shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#212121] mb-2" style={{ fontFamily: "'Merriweather', serif" }}>
              Powerful Features for Field Operations
            </h2>
            <p className="text-[#616161]">Everything you need to manage environmental field work efficiently</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
            
            {/* Tile 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white border border-[#E0D9C8] rounded-full flex items-center justify-center shadow-sm mb-4">
                <MapPin size={24} color="#005F02" />
              </div>
              <h4 className="font-bold text-[#212121] mb-2 text-lg">Location Tracking</h4>
              <p className="text-[#616161] text-sm leading-relaxed">
                GPS-enabled attendance with real-time location verification for field activities.
              </p>
            </div>

            {/* Tile 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white border border-[#E0D9C8] rounded-full flex items-center justify-center shadow-sm mb-4">
                <CalendarDays size={24} color="#005F02" />
              </div>
              <h4 className="font-bold text-[#212121] mb-2 text-lg">Leave Management</h4>
              <p className="text-[#616161] text-sm leading-relaxed">
                Streamline leave requests, approvals, and balance tracking for all team members.
              </p>
            </div>

            {/* Tile 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white border border-[#E0D9C8] rounded-full flex items-center justify-center shadow-sm mb-4">
                <ClipboardList size={24} color="#005F02" />
              </div>
              <h4 className="font-bold text-[#212121] mb-2 text-lg">Task Planning</h4>
              <p className="text-[#616161] text-sm leading-relaxed">
                Assign, track, and manage daily tasks with progress monitoring and deadlines.
              </p>
            </div>

            {/* Tile 4 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white border border-[#E0D9C8] rounded-full flex items-center justify-center shadow-sm mb-4">
                <BarChart3 size={24} color="#005F02" />
              </div>
              <h4 className="font-bold text-[#212121] mb-2 text-lg">Analytics Dashboard</h4>
              <p className="text-[#616161] text-sm leading-relaxed">
                Comprehensive insights and automated reports for performance tracking.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="bg-[#005F02] w-full shrink-0 pt-[48px] pb-[24px] px-6 md:px-[40px] mt-auto">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            
            {/* Column 1 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <img src="/sahayog_tab_icon.svg" alt="Sahayog" className="w-8 h-8 object-contain" />
                <span className="text-white font-bold text-lg" style={{ fontFamily: "'Merriweather', serif" }}>Sahayog</span>
              </div>
              <p className="text-white/80 text-[0.85rem] max-w-[220px] leading-relaxed">
                Empowering environmental organizations with smart field operations management.
              </p>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col">
              <h4 className="text-white font-bold mb-4 font-sans">Product</h4>
              <div className="flex flex-col gap-2">
                <a href="#" className="text-white/70 hover:text-white transition-opacity text-sm">Features</a>
                <a href="#" className="text-white/70 hover:text-white transition-opacity text-sm">Pricing</a>
                <a href="#" className="text-white/70 hover:text-white transition-opacity text-sm">Security</a>
              </div>
            </div>

            {/* Column 3 */}
            <div className="flex flex-col">
              <h4 className="text-white font-bold mb-4 font-sans">Support</h4>
              <div className="flex flex-col gap-2">
                <a href="#" className="text-white/70 hover:text-white transition-opacity text-sm">Documentation</a>
                <a href="#" className="text-white/70 hover:text-white transition-opacity text-sm">Help Center</a>
                <a href="#" className="text-white/70 hover:text-white transition-opacity text-sm">Contact</a>
              </div>
            </div>

            {/* Column 4 */}
            <div className="flex flex-col">
              <h4 className="text-white font-bold mb-4 font-sans">Connect</h4>
              <div className="flex gap-4">
                <a href="#" className="text-white/70 hover:text-white transition-opacity"><Twitter size={20} /></a>
                <a href="#" className="text-white/70 hover:text-white transition-opacity"><Instagram size={20} /></a>
                <a href="#" className="text-white/70 hover:text-white transition-opacity"><Github size={20} /></a>
              </div>
            </div>

          </div>

          <div className="w-full border-t border-white/20 pt-6 text-center">
            <p className="text-white/60 text-sm">© 2026 Sahayog. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <RegisterModal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)} 
        role={selectedRole} 
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        role={selectedRole}
      />
    </div>
  );
}
