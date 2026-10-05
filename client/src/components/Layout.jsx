import { useState } from 'react';
import {
    LayoutDashboard,
    MapPin,
    CheckSquare,
    Clock,
    Flag,
    Calendar,
    Users,
    FileText,
    Bell,
    LogOut,
    Menu,
    X,
    User,
    ClipboardList,
    ArrowLeft,
    Plus,
} from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PAGE_META = {
    '/worker/tasks': { title: 'My Tasks', subtitle: 'All your assigned tasks' },
    '/worker/attendance': { title: 'Attendance', subtitle: 'Manage your daily presence' },
    '/worker/attendance/history': { title: 'Attendance', subtitle: 'Manage your daily presence' },
    '/worker/leave': { title: 'Leave Requests', subtitle: 'Manage and request leaves' },
    '/worker/reports': { title: 'Activity Reports', subtitle: 'Review your submitted evidence' },
    '/worker/report/': { title: 'Submit Report', subtitle: 'Provide task evidence and outcomes' },
    '/worker/attendance/': { title: 'Mark Attendance', subtitle: 'Verify your presence at the task site' },
    '/teamlead/tasks': { title: 'Task Management', subtitle: 'Oversee and assign field projects' },
    '/teamlead/tasks/': { title: 'Task Details', subtitle: 'Review task configuration and workers' },
    '/teamlead/tasks/create': { title: 'Create Task', subtitle: 'Assign new work to field workers' },
    '/teamlead/attendance': { title: 'Team Attendance', subtitle: 'Monitor field worker activities' },
    '/teamlead/flags': { title: 'Flagged Records', subtitle: 'Review and resolve inconsistencies' },
    '/teamlead/leave': { title: 'Leave Requests', subtitle: 'Approve or decline field worker leaves' },
    '/teamlead/reports': { title: 'Field Reports', subtitle: 'Review submitted reports and evidence' },
    '/admin/users': { title: 'User Management', subtitle: 'Manage platform accounts and roles' },
    '/admin/reports': { title: 'System Analytics', subtitle: 'Review organizational performance' },
};

const SidebarLink = ({ to, icon: Icon, label, active, onClick }) => (
    <Link
        to={to}
        onClick={onClick}
        className={`group flex items-center gap-3 px-[14px] py-[10px] rounded-[10px] transition-all duration-200 border-l-[3px] ${active
                ? 'bg-[#E8F5E9] text-[#246427] font-semibold border-[#246427]'
                : 'text-[#616161] border-transparent hover:bg-[#F1F8E9] hover:text-[#246427]'
            }`}
    >
        <Icon className={`w-5 h-5 transition-colors ${active ? 'text-[#246427]' : 'text-[#9E9E9E] group-hover:text-[#246427]'}`} />
        <span>{label}</span>
    </Link>
);

function isWorkerNavActive(pathname, to) {
    const p = pathname.replace(/\/$/, '') || '/';
    if (to === '/worker') return p === '/worker';
    if (to === '/worker/attendance') return p.startsWith('/worker/attendance');
    return p === to || p.startsWith(`${to}/`);
}

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const hour = new Date().getHours();
    let greetingMessage = 'evening';
    if (hour < 12) greetingMessage = 'morning';
    else if (hour < 17) greetingMessage = 'afternoon';
    const firstName = user?.fullName ? user.fullName.split(' ')[0] : '';

    const isHome = ['/worker', '/teamlead', '/admin'].includes(location.pathname);
    
    const getMeta = () => {
        if (PAGE_META[location.pathname]) return PAGE_META[location.pathname];
        const entries = Object.entries(PAGE_META);
        for (const [path, meta] of entries) {
            if (path.endsWith('/') && location.pathname.startsWith(path)) return meta;
        }
        return { title: '', subtitle: '' };
    };
    const meta = getMeta();

    const adminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/admin/users', icon: Users, label: 'User Management' },
        { to: '/admin/reports', icon: FileText, label: 'Analytics' },
    ];

    const teamLeadLinks = [
        { to: '/teamlead', icon: LayoutDashboard, label: 'Overview' },
        { to: '/teamlead/tasks', icon: CheckSquare, label: 'Tasks' },
        { to: '/teamlead/tasks/create', icon: CheckSquare, label: 'Create Task' },
        { to: '/teamlead/attendance', icon: Clock, label: 'Attendance' },
        { to: '/teamlead/flags', icon: Flag, label: 'Flagged records' },
        { to: '/teamlead/leave', icon: Calendar, label: 'Leave requests' },
        { to: '/teamlead/reports', icon: FileText, label: 'Field reports' },
      ];

    const workerLinks = [
        { to: '/worker', icon: LayoutDashboard, label: 'Home' },
        { to: '/worker/tasks', icon: ClipboardList, label: 'My Tasks' },
        { to: '/worker/attendance', icon: CheckSquare, label: 'Attendance' },
        { to: '/worker/leave', icon: FileText, label: 'Leave Requests' },
        { to: '/worker/reports', icon: ClipboardList, label: 'My Reports' },
    ];

    const getLinks = () => {
        switch (user?.role) {
            case 'ADMIN': return adminLinks;
            case 'TEAM_LEAD': return teamLeadLinks;
            case 'FIELD_WORKER': return workerLinks;
            default: return [];
        }
    };

    return (
        <div className="min-h-screen flex" style={{ backgroundColor: '#F9FDF7' }}>
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E0E7DC] fixed h-full z-20">
                <div className="p-4 mb-4 bg-white border-b border-[#E0E7DC] flex items-center gap-2">
                    <img src="/sahayog_icon.svg" alt="Sahayog" className="w-7 h-7" />
                    <h1 className="text-xl font-bold text-[#246427]" style={{ fontFamily: "'Merriweather', serif" }}>Sahayog</h1>
                </div>

                <nav className="flex-1 space-y-1 px-4 overflow-y-auto">
                    {getLinks().map(link => (
                        <SidebarLink
                            key={link.to}
                            {...link}
                            active={
                                user?.role === 'FIELD_WORKER'
                                    ? isWorkerNavActive(location.pathname, link.to)
                                    : location.pathname === link.to
                            }
                        />
                    ))}
                </nav>

                <div className="p-4 mt-auto border-t border-[#E0E7DC] bg-[#F9FBF7]">
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 px-[14px] py-[10px] w-full text-[#616161] hover:text-[#246427] hover:bg-[#F1F8E9] rounded-[10px] transition-colors font-medium group"
                    >
                        <LogOut className="w-5 h-5 text-[#9E9E9E] group-hover:text-[#246427] transition-colors" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main 
                className="flex-1 md:ml-64 relative min-h-screen flex flex-col"
                style={{ background: 'linear-gradient(to bottom, #DCE9D5 0%, #F9FDF7 20%, #F9FDF7 100%)' }}
            >
                {/* Header Mobile */}
                <header className="md:hidden flex items-center gap-3 px-4 z-30 py-4" style={{ background: 'transparent' }}>
                    <button onClick={() => setSidebarOpen(true)} className="text-[#616161] hover:text-[#246427] flex-shrink-0">
                        <Menu className="w-6 h-6" />
                    </button>
                    {isHome ? (
                        <div className="flex-1 flex items-center justify-between">
                            <div>
                                <h1 className="text-[1.25rem] font-bold text-[#212121]">
                                    Welcome, <span className="text-[#246427] font-bold">{firstName}!</span>
                                </h1>
                                <p className="text-[0.7rem] text-[#616161] font-medium uppercase tracking-wider">
                                    {user?.role === 'ADMIN' ? 'SAHAYOG ADMINISTRATOR' :
                                     user?.role === 'TEAM_LEAD' ? 'SAHAYOG TEAM LEAD' :
                                     'SAHAYOG FIELD WORKER'}
                                </p>
                            </div>
                            {user?.role === 'TEAM_LEAD' && ['/teamlead', '/teamlead/tasks'].includes(location.pathname) && (
                                <button
                                    onClick={() => navigate('/teamlead/tasks/create')}
                                    className="flex items-center gap-1.5 rounded-[10px] bg-[#246427] px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-[#1a4d1c] transition-all flex-shrink-0"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Create Task</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {!getLinks().some(l => l.to === location.pathname) && (
                                <button onClick={() => navigate(-1)} className="text-[#246427] flex-shrink-0">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                                <h1 className="text-[1.125rem] font-bold text-[#212121] leading-tight truncate">{meta.title}</h1>
                                {meta.subtitle && (
                                    <p className="text-[0.7rem] text-[#616161] truncate">{meta.subtitle}</p>
                                )}
                            </div>
                            {user?.role === 'TEAM_LEAD' && location.pathname === '/teamlead/tasks' && (
                                <button
                                    onClick={() => navigate('/teamlead/tasks/create')}
                                    className="flex items-center gap-1.5 rounded-[10px] bg-[#246427] px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-[#1a4d1c] transition-all flex-shrink-0"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Create Task</span>
                                </button>
                            )}
                        </div>
                    )}
                </header>

                {/* Header Desktop */}
                <header className="hidden md:flex items-center px-8 sticky top-0 z-30 py-4" style={{ background: 'transparent', backdropFilter: 'blur(8px)' }}>
                    {isHome ? (
                        <div className="flex items-center justify-between w-full">
                            <div>
                                <h1 className="text-[1.5rem] font-bold text-[#212121]">
                                    Welcome, <span className="text-[#246427] font-bold">{firstName}!</span>
                                </h1>
                                <p className="text-[0.75rem] text-[#616161] font-medium uppercase tracking-wider">
                                    {user?.role === 'ADMIN' ? 'SAHAYOG ADMINISTRATOR' : 
                                     user?.role === 'TEAM_LEAD' ? 'SAHAYOG TEAM LEAD' : 
                                     'SAHAYOG FIELD WORKER'}
                                </p>
                            </div>
                            {user?.role === 'TEAM_LEAD' && ['/teamlead', '/teamlead/tasks'].includes(location.pathname) && (
                                <button
                                    onClick={() => navigate('/teamlead/tasks/create')}
                                    className="flex items-center gap-2 rounded-[12px] bg-[#246427] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#1a4d1c] transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Create Task</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-6">
                                {!getLinks().some(l => l.to === location.pathname) && (
                                    <button
                                        onClick={() => navigate(-1)}
                                        className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#E0E7DC] text-[#246427] hover:bg-[#E8F5E9] transition-colors shadow-sm"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <div className="flex flex-col">
                                    <h1 className="text-[1.5rem] font-bold text-[#212121] leading-tight">
                                        {meta.title}
                                    </h1>
                                    {meta.subtitle && (
                                        <p className="text-[0.75rem] text-[#616161] font-medium">
                                            {meta.subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {user?.role === 'TEAM_LEAD' && location.pathname === '/teamlead/tasks' && (
                                <button
                                    onClick={() => navigate('/teamlead/tasks/create')}
                                    className="flex items-center gap-2 rounded-[12px] bg-[#246427] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#1a4d1c] transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Create Task</span>
                                </button>
                            )}
                        </div>
                    )}
                </header>

                {/* Page Content */}
                <div className="p-4 md:pt-[22px] md:px-8 md:pb-8 flex-1">
                    {children}
                </div>
            </main>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
                    <div className="w-64 bg-white h-full flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 mb-4 bg-white border-b border-[#E0E7DC] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src="/sahayog_icon.svg" alt="Sahayog" className="w-7 h-7" />
                                <h1 className="text-xl font-bold text-[#246427]" style={{ fontFamily: "'Merriweather', serif" }}>Sahayog</h1>
                            </div>
                            <button onClick={() => setSidebarOpen(false)} className="text-[#616161] hover:text-[#246427]"><X className="w-6 h-6" /></button>
                        </div>
                        <nav className="flex-1 space-y-1 px-4 overflow-y-auto">
                            {getLinks().map(link => (
                                <SidebarLink
                                    key={link.to}
                                    {...link}
                                    active={
                                        user?.role === 'FIELD_WORKER'
                                            ? isWorkerNavActive(location.pathname, link.to)
                                            : location.pathname === link.to
                                    }
                                    onClick={() => setSidebarOpen(false)}
                                />
                            ))}
                        </nav>
                        <div className="p-4 mt-auto border-t border-[#E0E7DC] bg-[#F9FBF7]">
                            <button onClick={logout} className="flex items-center gap-3 px-[14px] py-[10px] w-full text-[#616161] hover:text-[#246427] hover:bg-[#F1F8E9] rounded-[10px] transition-colors font-medium group">
                                <LogOut className="w-5 h-5 text-[#9E9E9E] group-hover:text-[#246427] transition-colors" /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
