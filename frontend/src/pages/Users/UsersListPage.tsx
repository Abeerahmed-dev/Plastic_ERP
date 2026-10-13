import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  ShieldAlert,
  Users,
  Briefcase,
  AlertTriangle,
  Calendar,
  Clock,
  Key,
} from 'lucide-react';
import { usersService } from '../../services/users.service';
import { UserFormModal } from './UserFormModal';
import { User, CreateUserData, UpdateUserData } from '../../types/user.types';
import { useAuthStore } from '../../store/auth.store';
import { toast, handleApiError } from '../../utils/handleApiError';

function getPayrollStatus(user: User) {
  if (user.pay_frequency === 'CONTRACT') {
    return {
      isContract: true,
      displayDate: 'Milestone Based',
      badge: {
        text: 'Milestone Based',
        className: 'bg-purple-50 text-purple-700 border-purple-200/80 font-medium',
      },
    };
  }

  // Baseline: If last_paid_date is null, use joining_date as the baseline.
  const baselineRaw = user.last_paid_date || user.joining_date || user.created_at;
  const baseline = baselineRaw ? new Date(baselineRaw) : new Date();

  // Normalize baseline to midnight local time
  const baselineDate = new Date(baseline.getFullYear(), baseline.getMonth(), baseline.getDate());

  let nextPayDate: Date;
  if (user.pay_frequency === 'WEEKLY') {
    nextPayDate = new Date(baselineDate.getTime());
    nextPayDate.setDate(nextPayDate.getDate() + 7);
  } else {
    // Monthly: nextPayDate = baseline + 1 month
    nextPayDate = new Date(baselineDate.getTime());
    nextPayDate.setMonth(nextPayDate.getMonth() + 1);
  }

  // Today normalized to midnight local time
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Difference in calendar days: (nextPayDate - today)
  const diffMs = nextPayDate.getTime() - today.getTime();
  const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = nextPayDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let badgeText = '';
  let badgeClassName = '';

  if (daysUntilDue > 3) {
    badgeText = `In ${daysUntilDue} days`;
    badgeClassName = 'bg-slate-100 text-slate-700 border-slate-200/80 font-medium';
  } else if (daysUntilDue <= 3 && daysUntilDue > 0) {
    badgeText = `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
    badgeClassName = 'bg-amber-50 text-amber-800 border-amber-300 font-semibold shadow-xs';
  } else {
    // daysUntilDue <= 0
    if (daysUntilDue === 0) {
      badgeText = 'Due today';
    } else {
      const overdue = Math.abs(daysUntilDue);
      badgeText = `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}`;
    }
    badgeClassName = 'bg-rose-100 text-rose-800 border-rose-300 font-bold shadow-xs';
  }

  return {
    isContract: false,
    displayDate: formattedDate,
    daysUntilDue,
    badge: {
      text: badgeText,
      className: badgeClassName,
    },
  };
}

export default function UsersListPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const canWrite = hasPermission('users:write');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.getUsers,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: usersService.getRoles,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserData) => usersService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      toast.success('Employee created successfully');
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) =>
      usersService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalOpen(false);
      setEditingUser(null);
      toast.success('Employee updated successfully');
    },
    onError: (error: any) => {
      handleApiError(error);
    },
  });

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    const nameMatch = u.name.toLowerCase().includes(q);
    const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
    const titleMatch = u.job_title ? u.job_title.toLowerCase().includes(q) : false;
    return nameMatch || emailMatch || titleMatch;
  });

  // KPI Calculations
  const totalEmployees = users.length;
  const activeCount = users.filter((u) => u.is_active).length;
  const systemUsersCount = users.filter((u) => !!u.email).length;
  const dueOrOverdueCount = users.filter((u) => {
    const status = getPayrollStatus(u);
    return !status.isContract && status.daysUntilDue !== null && status.daysUntilDue <= 3;
  }).length;

  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSubmit = (data: any) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Team Members & Payroll
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track employee profiles, salary schedules, pay deadlines, and ERP system access.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Employee
          </button>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Staff</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {totalEmployees} <span className="text-xs font-normal text-slate-400">({activeCount} active)</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">ERP Logins</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {systemUsersCount} <span className="text-xs font-normal text-slate-400">assigned</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pay Due / Overdue</p>
            <p className={`text-xl font-bold mt-0.5 ${dueOrOverdueCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {dueOrOverdueCount} <span className="text-xs font-normal text-slate-400">employees</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Status</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">
              {activeCount} / {totalEmployees}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors shadow-xs"
            placeholder="Search by name, email, or job title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/75">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Employee Info
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Job Title / Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Salary
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Next Pay Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span className="mt-2">Loading team & payroll records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const payroll = getPayrollStatus(user);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Column 1: Employee Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 font-bold border border-blue-200/50">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3.5">
                            <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                            {user.email ? (
                              <div className="text-xs text-slate-500">{user.email}</div>
                            ) : (
                              <div className="text-xs text-slate-400 italic">No ERP Login</div>
                            )}
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Joined:{' '}
                              {user.joining_date
                                ? new Date(user.joining_date).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : new Date(user.created_at).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Job Title / Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-slate-800">
                            {user.job_title || 'Staff'}
                          </div>
                          <div>
                            {user.role_name ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200/60">
                                <ShieldAlert className="h-3 w-3 text-blue-500" />
                                {user.role_name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500 border border-slate-200/50">
                                Non-login Employee
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Salary */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-slate-900">
                          Rs {Number(user.base_salary || 0).toLocaleString('en-PK', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-xs text-slate-500 capitalize">
                          {user.pay_frequency === 'WEEKLY'
                            ? 'Weekly'
                            : user.pay_frequency === 'CONTRACT'
                            ? 'Contract'
                            : 'Monthly'}
                        </div>
                      </td>

                      {/* Column 4: Next Pay Date & Countdown Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payroll.isContract ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200/80">
                            Milestone Based
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {payroll.displayDate}
                            </div>
                            <div>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs border ${payroll.badge.className}`}
                              >
                                {payroll.badge.text}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 5: Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            user.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {canWrite && (
                          <button
                            onClick={() => handleOpenEdit(user)}
                            title="Edit Employee"
                            className="inline-flex items-center text-slate-400 hover:text-blue-600 transition-colors bg-white p-2 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        initialData={editingUser}
        roles={roles}
      />
    </div>
  );
}
