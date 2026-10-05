import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Users, UserPlus, Search, MoreVertical, Shield, UserX, UserCheck, Trash2, Loader } from 'lucide-react';
import { toast } from 'react-toastify';
import DeleteConfirmationModal from '../../components/shared/DeleteConfirmationModal';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserForDelete, setSelectedUserForDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/admin/users');
            const d = response.data.data;
            setUsers(Array.isArray(d) ? d : d.users || []);
        } catch (error) {
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            await api.patch(`/admin/users/${id}/status`, { is_active: !currentStatus });
            toast.success('User status updated');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleDeleteUser = async (id) => {
        setIsDeleting(true);
        try {
            await api.delete(`/admin/users/${id}`);
            toast.success('User deleted');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to delete user');
        } finally {
            setIsDeleting(false);
            setSelectedUserForDelete(null);
        }
    };

    const filteredUsers = users.filter(user =>
        (user.fullName || user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.username || user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="flex justify-center py-10"><Loader className="animate-spin text-[#005F02]" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#005F02]">User Management</h2>
                    <p className="text-gray-500">Manage all staff members and their roles.</p>
                </div>
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-[#005F02] text-white rounded-xl font-bold hover:bg-[#427A43] transition-all shadow-md w-full md:w-auto">
                    <UserPlus className="w-5 h-5" /> Add New User
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#005F02] text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">User</th>
                                <th className="px-6 py-4 font-semibold">Role</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold">Phone</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => {
                                const uid = user._id || user.id;
                                const displayName = user.fullName || user.name || '';
                                const displayLogin = user.username || user.email || '';
                                const roleName = user.role || user.role_name;
                                const isActive = user.isActive ?? user.is_active;
                                return (
                                <tr key={uid} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-[#F2E3BB] text-[#005F02] flex items-center justify-center font-bold">
                                                {(displayName.charAt(0) || '?').toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-800 text-sm">{displayName}</div>
                                                <div className="text-gray-500 text-xs">{displayLogin}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                            <Shield className={`w-3.5 h-3.5 ${roleName === 'ADMIN' ? 'text-red-500' :
                                                    roleName === 'TEAM_LEAD' ? 'text-blue-500' : 'text-green-500'
                                                }`} />
                                            <span className="text-gray-700 uppercase">{roleName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                                        {user.phone || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleToggleStatus(uid, isActive)}
                                                className={`p-2 rounded-lg transition-colors ${isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'
                                                    }`}
                                                title={isActive ? 'Deactivate' : 'Activate'}
                                            >
                                                {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => setSelectedUserForDelete(uid)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <DeleteConfirmationModal
                isOpen={!!selectedUserForDelete}
                onClose={() => setSelectedUserForDelete(null)}
                onConfirm={() => handleDeleteUser(selectedUserForDelete)}
                loading={isDeleting}
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone."
            />
        </div>
    );
};

export default UserManagement;
