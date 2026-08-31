import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Loader2, Save, Trash2 } from 'lucide-react';
import { getUOMs, createUOM, deactivateUOM } from '../../services/uom.service';
import { useAuthStore } from '../../store/auth.store';

export default function UOMPage() {
  const { hasPermission } = useAuthStore();
  const canWrite = hasPermission('products:write');
  const canDelete = hasPermission('products:delete');
  const qc = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAbbr, setNewAbbr] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: uoms = [], isLoading, isError } = useQuery({
    queryKey: ['uoms'],
    queryFn: getUOMs,
  });

  const createMutation = useMutation({
    mutationFn: () => createUOM({ name: newName, abbreviation: newAbbr }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uoms'] });
      setIsAdding(false);
      setNewName('');
      setNewAbbr('');
      setErrorMsg('');
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error || 'Failed to create UOM');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deactivateUOM,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uoms'] }),
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Failed to deactivate UOM');
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAbbr.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Units of Measure</h1>
            <p className="mt-1 text-sm text-gray-500">Manage units used for products and inventory.</p>
          </div>
          {canWrite && !isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Unit
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-6 py-4 font-semibold text-gray-600">Name</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Abbreviation</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-center">Status</th>
                {canDelete && <th className="px-6 py-4 font-semibold text-gray-600 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="py-12 text-center text-gray-400">Loading units…</td></tr>
              )}
              {isError && (
                <tr><td colSpan={4} className="py-12 text-center text-red-500">Failed to load units.</td></tr>
              )}
              {!isLoading && !isError && uoms.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-semibold text-gray-700">
                      {u.abbreviation}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canDelete && (
                    <td className="px-6 py-4 text-right">
                      {u.is_active && (
                        <button
                          onClick={() => { if(confirm(`Deactivate ${u.name}?`)) deleteMutation.mutate(u.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
                          title="Deactivate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              
              {/* Inline Add Row */}
              {isAdding && (
                <tr className="bg-blue-50/30">
                  <td className="px-6 py-4">
                    <input 
                      autoFocus
                      placeholder="e.g. Dozen"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      placeholder="e.g. Dz"
                      value={newAbbr}
                      onChange={(e) => setNewAbbr(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-gray-400 text-xs">New</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setIsAdding(false); setErrorMsg(''); }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={handleCreate}
                        disabled={!newName.trim() || !newAbbr.trim() || createMutation.isPending}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition disabled:opacity-50"
                      >
                        {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {errorMsg && (
            <div className="bg-red-50 px-6 py-3 border-t border-red-100 text-sm text-red-600">
              {errorMsg}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
