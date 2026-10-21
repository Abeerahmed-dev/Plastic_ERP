import { useState, useEffect } from 'react';
import { X, Loader2, User, Phone, Briefcase, Clock, DollarSign, Calendar, FileText, Hash, AlertCircle } from 'lucide-react';
import { Employee, CreateEmployeeData, EmployeeStatus } from '../../types/employee.types';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEmployeeData) => void;
  isSubmitting: boolean;
  initialData?: Employee | null;
}

const COMMON_DESIGNATIONS = [
  'Packer',
  'Loader',
  'Salesman',
  'Floor Helper',
  'Machine Operator',
  'Store Keeper',
  'Delivery Boy / Driver',
  'Security Guard',
  'Supervisor',
  'Other',
];

const COMMON_TIMINGS = [
  '09:00 AM - 08:00 PM (Full Day)',
  '09:00 AM - 06:00 PM (Standard)',
  '10:00 AM - 09:00 PM (Store Shift)',
  '08:00 AM - 05:00 PM (Morning Shift)',
  '01:00 PM - 10:00 PM (Evening Shift)',
  '09:00 PM - 07:00 AM (Night Shift)',
];

export const EmployeeFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialData,
}: EmployeeFormModalProps) => {
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [customDesignation, setCustomDesignation] = useState('');
  const [storeTiming, setStoreTiming] = useState('');
  const [customTiming, setCustomTiming] = useState('');
  const [salary, setSalary] = useState<number | ''>('');
  const [status, setStatus] = useState<EmployeeStatus>('ACTIVE');
  const [cnic, setCnic] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setEmployeeId(initialData.employee_id || '');
        setName(initialData.name || '');
        setPhone(initialData.phone || '');

        if (COMMON_DESIGNATIONS.includes(initialData.designation)) {
          setDesignation(initialData.designation);
          setCustomDesignation('');
        } else {
          setDesignation('Other');
          setCustomDesignation(initialData.designation || '');
        }

        if (COMMON_TIMINGS.includes(initialData.store_timing || '')) {
          setStoreTiming(initialData.store_timing || '');
          setCustomTiming('');
        } else {
          setStoreTiming('Custom');
          setCustomTiming(initialData.store_timing || '');
        }

        setSalary(initialData.salary ?? '');
        setStatus(initialData.status || 'ACTIVE');
        setCnic(initialData.cnic || '');
        setJoiningDate(initialData.joining_date ? initialData.joining_date.split('T')[0] : '');
        setNotes(initialData.notes || '');
      } else {
        setEmployeeId('');
        setName('');
        setPhone('');
        setDesignation('Packer');
        setCustomDesignation('');
        setStoreTiming('09:00 AM - 08:00 PM (Full Day)');
        setCustomTiming('');
        setSalary('');
        setStatus('ACTIVE');
        setCnic('');
        setJoiningDate(new Date().toISOString().split('T')[0]);
        setNotes('');
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Worker name is required';
    
    const finalDesignation = designation === 'Other' ? customDesignation.trim() : designation;
    if (!finalDesignation) newErrors.designation = 'Designation is required';

    const finalTiming = storeTiming === 'Custom' ? customTiming.trim() : storeTiming;

    if (salary === '' || Number(salary) < 0) {
      newErrors.salary = 'Please enter a valid salary amount';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      employee_id: employeeId.trim() || undefined,
      name: name.trim(),
      phone: phone.trim() || null,
      designation: finalDesignation,
      store_timing: finalTiming || null,
      salary: Number(salary) || 0,
      cnic: cnic.trim() || null,
      status,
      joining_date: joiningDate || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {initialData ? 'Edit Store Worker' : 'Register New Store Worker'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Physical store & warehouse staff (Does not affect software login accounts)
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Employee ID & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <Hash className="w-3.5 h-3.5 text-blue-600" />
                Employee ID / Code
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Leave blank for auto EMP-001"
                className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Auto-assigned if left empty
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Employment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="ACTIVE">🟢 Active on Duty</option>
                <option value="ON_LEAVE">🟡 On Leave / Temporary</option>
                <option value="INACTIVE">🔴 Inactive / Left</option>
              </select>
            </div>
          </div>

          {/* Full Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Worker Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                placeholder="e.g. Muhammad Ali"
                className={`w-full rounded-xl border py-2.5 px-3.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  errors.name ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {errors.name && (
                <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {errors.name}
                </span>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0300-1234567"
                className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Designation & Custom Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                Designation / Job Role <span className="text-red-500">*</span>
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {COMMON_DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {designation === 'Other' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Specify Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customDesignation}
                  onChange={(e) => setCustomDesignation(e.target.value)}
                  placeholder="e.g. Electrician, Dye Maker"
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <Hash className="w-3.5 h-3.5 text-purple-600" />
                  CNIC Number (Optional)
                </label>
                <input
                  type="text"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  placeholder="e.g. 42101-1234567-1"
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Store Timing & Custom Timing */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Store Timing / Shift
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={storeTiming}
                onChange={(e) => setStoreTiming(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {COMMON_TIMINGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="Custom">Custom Timing...</option>
              </select>

              {storeTiming === 'Custom' && (
                <input
                  type="text"
                  value={customTiming}
                  onChange={(e) => setCustomTiming(e.target.value)}
                  placeholder="e.g. 11:00 AM - 07:00 PM"
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Monthly Salary & Joining Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Monthly Salary (Rs.) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs font-bold text-slate-400">
                  Rs.
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={salary}
                  onChange={(e) => {
                    setSalary(e.target.value === '' ? '' : Number(e.target.value));
                    if (errors.salary) setErrors({ ...errors, salary: '' });
                  }}
                  placeholder="e.g. 25000"
                  className={`w-full rounded-xl border py-2.5 pl-11 pr-3.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono ${
                    errors.salary ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                  }`}
                />
              </div>
              {errors.salary && (
                <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {errors.salary}
                </span>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Joining Date
              </label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2.5 px-3.5 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Reference details, emergency contact, or specific task instructions..."
              className="w-full rounded-xl border border-slate-300 py-2 px-3.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition active:scale-[0.98] disabled:bg-slate-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Worker...
                </>
              ) : initialData ? (
                'Update Worker'
              ) : (
                'Save Worker'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
