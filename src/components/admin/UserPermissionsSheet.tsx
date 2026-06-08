import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { AppModule, Profile } from '@/types/auth';
import { getUserPermissions, setUserPermissions, listModules } from '@/services/adminService';
import { useAuth } from '@/hooks/useAuth';

interface UserPermissionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: Profile | null;
  onSaved: () => void;
}

/** Group modules by group_label for display. */
function groupModules(modules: AppModule[]): Record<string, AppModule[]> {
  const groups: Record<string, AppModule[]> = {};
  for (const m of modules) {
    if (!groups[m.group_label]) groups[m.group_label] = [];
    groups[m.group_label].push(m);
  }
  return groups;
}

export function UserPermissionsSheet({
  open,
  onOpenChange,
  targetUser,
  onSaved,
}: UserPermissionsSheetProps) {
  const { user } = useAuth();
  const [modules, setModules] = useState<AppModule[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load modules + current permissions when sheet opens
  useEffect(() => {
    if (!open || !targetUser) return;

    setLoading(true);
    setError(null);

    Promise.all([listModules(), getUserPermissions(targetUser.id)])
      .then(([mods, perms]) => {
        setModules(mods);
        setSelected(new Set(perms));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [open, targetUser]);

  function toggleModule(moduleId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  function toggleGroup(groupModuleIds: string[]) {
    const allSelected = groupModuleIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of groupModuleIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  async function handleSave() {
    if (!targetUser || !user) return;
    setSaving(true);
    setError(null);

    try {
      await setUserPermissions(targetUser.id, Array.from(selected), user.id);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const grouped = groupModules(modules);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-ink-900 border-ink-700 text-ink-50 w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display text-xl text-ink-50">
            Permissoes
          </SheetTitle>
          {targetUser && (
            <p className="text-sm text-ink-300">{targetUser.full_name}</p>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-champagne-400" />
          </div>
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {!loading && (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([groupLabel, groupMods]) => {
              const groupIds = groupMods.map((m) => m.id);
              const allSelected = groupIds.every((id) => selected.has(id));

              return (
                <div key={groupLabel} className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleGroup(groupIds)}
                      className="h-4 w-4 rounded border-ink-500 bg-ink-850 text-champagne-400 focus:ring-champagne-400/40"
                    />
                    <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-champagne-400 group-hover:text-champagne-300">
                      {groupLabel}
                    </span>
                  </label>

                  <div className="flex flex-col gap-1 pl-6">
                    {groupMods.map((mod) => (
                      <label
                        key={mod.id}
                        className="flex items-center gap-2 cursor-pointer py-1 hover:bg-ink-850 rounded px-2 -mx-2"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(mod.id)}
                          onChange={() => toggleModule(mod.id)}
                          className="h-3.5 w-3.5 rounded border-ink-500 bg-ink-850 text-champagne-400 focus:ring-champagne-400/40"
                        />
                        <span className="text-sm text-ink-200">{mod.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end gap-3 pt-4 border-t border-ink-700">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-ink-300 hover:text-ink-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-champagne-400 text-ink-1000 hover:bg-champagne-300 rounded-full px-6"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
