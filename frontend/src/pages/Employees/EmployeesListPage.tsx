import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Edit2, Trash2, Users, Clock, DollarSign,
  Briefcase, Phone, CheckCircle2, Sparkles,
} from 'lucide-react';
import { employeesService } from '../../services/employees.service';
import { Employee, CreateEmployeeData } from '../../types/employee.types';
import { EmployeeFormModal } from './EmployeeFormModal';

export default function EmployeesListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [designationFilter, setDesignationFilter] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Query Employees
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesService.getEmployees(),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeData) => employeesService.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to register worker');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEmployeeData> }) =>
      employeesService.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      setEditingEmployee(null);
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to update worker');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesService.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      alert(error?.response?.data?.error || error.message || 'Failed to remove worker');
    },
  });

  const designations = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.designation) set.add(e.designation);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered List
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const s = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !s ||
        emp.name.toLowerCase().includes(s) ||
        emp.employee_id.toLowerCase().includes(s) ||
        (emp.phone && emp.phone.includes(s)) ||
        emp.designation.toLowerCase().includes(s);

      const matchesStatus = statusFilter === 'ALL' || emp.status === statusFilter;
      const matchesDesignation = designationFilter === 'ALL' || emp.designation === designationFilter;

      return matchesSearch && matchesStatus && matchesDesignation;
    });
  }, [employees, searchTerm, statusFilter, designationFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalWorkers = employees.length;
    const activeWorkers = employees.filter((e) => e.status === 'ACTIVE').length;
    const onLeaveWorkers = employees.filter((e) => e.status === 'ON_LEAVE').length;
    const totalPayroll = employees.reduce((acc, e) => acc + Number(e.salary || 0), 0);
    const avgSalary = totalWorkers > 0 ? Math.round(totalPayroll / totalWorkers) : 0;

    return { totalWorkers, activeWorkers, onLeaveWorkers, totalPayroll, avgSalary };
  }, [employees]);

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleSubmit = (data: CreateEmployeeData) => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Store Employees</h1>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                Physical store, factory & warehouse workers directory (timings, designation & salaries)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-5 w-5 text-slate-950" />
          Add Worker
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{metrics.totalWorkers}</p>
          <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block">Store & warehouse workforce</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active on Duty</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">{metrics.activeWorkers}</p>
          <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block">
            {metrics.onLeaveWorkers > 0 ? `${metrics.onLeaveWorkers} on leave` : 'All available'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Payroll</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            Rs. {metrics.totalPayroll.toLocaleString()}
          </p>
          <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block">Total salary obligation</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Salary</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            Rs. {metrics.avgSalary.toLocaleString()}
          </p>
          <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block">Per employee average</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
            placeholder="Search by worker name, ID (EMP-001), phone, or designation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Designation filter */}
          {designations.length > 0 && (
            <select
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Designations</option>
              {designations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {(searchTerm || statusFilter !== 'ALL' || designationFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setDesignationFilter('ALL');
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
              title="Reset filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  ID & Worker Name
                </th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Store Timing
                </th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Monthly Salary
                </th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-5 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span className="mt-2.5 font-medium">Loading store workers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No store workers found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Click "+ Add Worker" to register physical store & warehouse employees.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* ID & Worker Name */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 font-black text-sm shadow-2xs">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{emp.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                              {emp.employee_id}
                            </span>
                            {emp.cnic && (
                              <span className="text-[11px] text-slate-400">
                                • {emp.cnic}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone Number */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {emp.phone ? (
                        <a
                          href={`tel:${emp.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{emp.phone}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No phone</span>
                      )}
                    </td>

                    {/* Designation */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                        <Briefcase className="w-3 h-3 text-amber-600" />
                        {emp.designation}
                      </span>
                    </td>

                    {/* Store Timing */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{emp.store_timing || 'Standard Hours'}</span>
                      </div>
                    </td>

                    {/* Monthly Salary */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-black font-mono text-slate-900">
                        Rs. {Number(emp.salary || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-medium">/ month</span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : emp.status === 'ON_LEAVE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-500'
                              : emp.status === 'ON_LEAVE'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        {emp.status === 'ACTIVE'
                          ? 'Active'
                          : emp.status === 'ON_LEAVE'
                          ? 'On Leave'
                          : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit worker"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(emp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete worker"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      <EmployeeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        initialData={editingEmployee}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center">Remove Store Worker?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Are you sure you want to remove this employee record? This action cannot be undone.
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 shadow-sm transition active:scale-[0.98] disabled:bg-slate-300"
              >
                {deleteMutation.isPending ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
