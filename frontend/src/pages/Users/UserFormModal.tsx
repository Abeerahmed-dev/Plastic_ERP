import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Briefcase, KeyRound, Calendar, DollarSign } from 'lucide-react';
import { User, Role, PayFrequency } from '../../types/user.types';

const employeeFormSchema = z.object({
  name: z.string().min(2, 'Full name is required (at least 2 characters)').max(100),
  job_title: z.string().max(100).optional().nullable(),
  joining_date: z.string().min(1, 'Joining date is required'),
  pay_frequency: z.enum(['WEEKLY', 'MONTHLY', 'CONTRACT'] as const),
  base_salary: z.coerce.number().min(0, 'Base salary must be 0 or greater'),
  last_paid_date: z.string().optional().nullable(),
  grant_access: z.boolean().default(false),
  email: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  role_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.grant_access) {
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A valid email address is required for system login access',
        path: ['email'],
      });
    }
    if (!data.role_id || data.role_id.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select an ERP role for system access',
        path: ['role_id'],
      });
    }
  }
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  initialData?: User | null;
  roles: Role[];
}

export const UserFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
  roles,
}: UserFormModalProps) => {
  const [grantAccess, setGrantAccess] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      job_title: '',
      joining_date: todayStr,
      pay_frequency: 'MONTHLY',
      base_salary: 0,
      last_paid_date: '',
      grant_access: false,
      email: '',
      password: '',
      role_id: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const hasAccess = Boolean(initialData.email || initialData.role_id);
        setGrantAccess(hasAccess);
        reset({
          name: initialData.name || '',
          job_title: initialData.job_title || '',
          joining_date: initialData.joining_date
            ? initialData.joining_date.substring(0, 10)
            : todayStr,
          pay_frequency: initialData.pay_frequency || 'MONTHLY',
          base_salary: initialData.base_salary ?? 0,
          last_paid_date: initialData.last_paid_date
            ? initialData.last_paid_date.substring(0, 10)
            : '',
          grant_access: hasAccess,
          email: initialData.email || '',
          password: '',
          role_id: initialData.role_id || '',
          is_active: initialData.is_active !== undefined ? initialData.is_active : true,
        });
      } else {
        setGrantAccess(false);
        reset({
          name: '',
          job_title: '',
          joining_date: todayStr,
          pay_frequency: 'MONTHLY',
          base_salary: 0,
          last_paid_date: '',
          grant_access: false,
          email: '',
          password: '',
          role_id: '',
          is_active: true,
        });
      }
    }
  }, [isOpen, initialData, reset, todayStr]);

  const handleToggleAccess = (checked: boolean) => {
    setGrantAccess(checked);
    setValue('grant_access', checked);
  };

  const handleFormSubmit = (data: EmployeeFormData) => {
    if (grantAccess) {
      if (!initialData && (!data.password || data.password.length < 8)) {
        setError('password', {
          type: 'manual',
          message: 'Password must be at least 8 characters for new user login',
        });
        return;
      }

      const payload: any = {
        name: data.name.trim(),
        job_title: data.job_title?.trim() || null,
        joining_date: data.joining_date || todayStr,
        pay_frequency: data.pay_frequency,
        base_salary: Number(data.base_salary) || 0,
        salary_amount: Number(data.base_salary) || 0,
        last_paid_date: data.last_paid_date ? data.last_paid_date : null,
        grant_access: true,
        email: data.email?.trim().toLowerCase() || null,
        role_id: data.role_id || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      };

      if (data.password && data.password.trim().length > 0) {
        payload.password = data.password.trim();
      }

      onSubmit(payload);
    } else {
      // Access toggled OFF: Submit credentials strictly as null
      const payload: any = {
        name: data.name.trim(),
        job_title: data.job_title?.trim() || null,
        joining_date: data.joining_date || todayStr,
        pay_frequency: data.pay_frequency,
        base_salary: Number(data.base_salary) || 0,
        salary_amount: Number(data.base_salary) || 0,
        last_paid_date: data.last_paid_date ? data.last_paid_date : null,
        grant_access: false,
        email: null,
        password: null,
        role_id: null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      };

      onSubmit(payload);
    }
  };

  if (!isOpen) return null;

  const inputCls = (hasError: boolean) =>
    `block w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-rose-300 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20'
        : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initialData ? 'Edit Employee Profile' : 'Add New Employee'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure employee HR payroll details and optional ERP access.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-6 py-6 flex-1">
          <form id="employee-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            
            {/* ─── SECTION 1: HR DETAILS ────────────────────────────── */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                  HR & Payroll Details
                </h3>
              </div>

              {/* Full Name */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Muhammad Farhan"
                  className={inputCls(!!errors.name)}
                />
                {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
              </div>

              {/* Job Title */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Job Title
                </label>
                <input
                  {...register('job_title')}
                  placeholder="e.g. Production Manager, Machine Operator"
                  className={inputCls(!!errors.job_title)}
                />
                {errors.job_title && (
                  <p className="mt-1 text-xs text-rose-600">{errors.job_title.message}</p>
                )}
              </div>

              {/* Joining Date & Pay Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Joining Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('joining_date')}
                    className={inputCls(!!errors.joining_date)}
                  />
                  {errors.joining_date && (
                    <p className="mt-1 text-xs text-rose-600">{errors.joining_date.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Pay Frequency <span className="text-rose-500">*</span>
                  </label>
                  <select
                    {...register('pay_frequency')}
                    className={inputCls(!!errors.pay_frequency)}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="CONTRACT">Contract (Milestone Based)</option>
                  </select>
                  {errors.pay_frequency && (
                    <p className="mt-1 text-xs text-rose-600">{errors.pay_frequency.message}</p>
                  )}
                </div>
              </div>

              {/* Base Salary (Rs) & Last Paid Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                    Base Salary (Rs) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-medium text-slate-400">
                      Rs
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      {...register('base_salary')}
                      placeholder="0.00"
                      className={`pl-9 ${inputCls(!!errors.base_salary)}`}
                    />
                  </div>
                  {errors.base_salary && (
                    <p className="mt-1 text-xs text-rose-600">{errors.base_salary.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Last Paid Date
                  </label>
                  <input
                    type="date"
                    {...register('last_paid_date')}
                    className={inputCls(!!errors.last_paid_date)}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Leave blank to use Joining Date as baseline
                  </p>
                </div>
              </div>
            </div>

            {/* ─── SECTION 2: SYSTEM ACCESS ─────────────────────────── */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                    System Access & Credentials
                  </h3>
                </div>
              </div>

              {/* Toggle switch for Grant ERP Access */}
              <div className="flex items-center justify-between rounded-xl bg-white p-3.5 border border-slate-200/60 shadow-xs">
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">
                    Grant System Login Access
                  </span>
                  <span className="text-xs text-slate-500">
                    Enable email and password to log into the ERP software
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={grantAccess}
                    onChange={(e) => handleToggleAccess(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Conditionally Render Credentials Fields */}
              {grantAccess ? (
                <div className="space-y-4 pt-2 border-t border-slate-200/40 animate-in fade-in duration-200">
                  {/* Email */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="employee@sabirplastic.com"
                      className={inputCls(!!errors.email)}
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      {initialData ? 'Change Password' : 'Password'}{' '}
                      {!initialData && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      {...register('password')}
                      type="password"
                      placeholder={initialData ? 'Leave empty to keep existing password' : '••••••••'}
                      className={inputCls(!!errors.password)}
                    />
                    {errors.password && (
                      <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
                    )}
                    {initialData && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Leave blank if you do not want to alter the user's password.
                      </p>
                    )}
                  </div>

                  {/* Role */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      System Role <span className="text-rose-500">*</span>
                    </label>
                    <select {...register('role_id')} className={inputCls(!!errors.role_id)}>
                      <option value="">Select a system role...</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {errors.role_id && (
                      <p className="mt-1 text-xs text-rose-600">{errors.role_id.message}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-100/80 px-3.5 py-2.5 text-xs text-slate-500 border border-slate-200/50">
                  <span className="font-medium text-slate-700">Payroll Only:</span> This employee
                  will be tracked for HR & payroll compensation without login credentials to the
                  system.
                </div>
              )}
            </div>

            {/* Active Account Status (Edit Mode) */}
            {initialData && (
              <div className="flex items-center gap-2.5 pt-1 px-1">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register('is_active')}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Active Employee Profile
                </label>
              </div>
            )}
          </form>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200/80 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="employee-form"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-950" />
                Saving...
              </>
            ) : initialData ? (
              'Save Changes'
            ) : (
              'Add Employee'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
