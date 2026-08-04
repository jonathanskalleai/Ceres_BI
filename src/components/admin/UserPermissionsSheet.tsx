import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import type { AppModule, Profile } from '@/types/auth';
import { listModules, getUserVisibility, setUserPermissions } from '@/services/adminService';
import { useAuth } from '@/hooks/useAuth';

/** Permission record with visibility state */
interface ModulePermission {
  moduleId: string;
  hasAccess: boolean;
  isVisible: boolean;
}

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
  /** Module permissions: hasAccess (checked) and isVisible (eye toggle) */
  const [permissions, setPermissions] = useState<Map<string, ModulePermission>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load modules + current permissions + visibility when sheet opens
  useEffect(() => {
    if (!open || !targetUser) return;

    setLoading(true);
    setError(null);

    Promise.all([listModules(), getUserVisibility(targetUser.id)])
      .then(([mods, visibility]) => {
        setModules(mods);
        const perms = new Map<string, ModulePermission>();
        for (const mod of mods) {
          const isVisible = visibility[mod.id] ?? true;
          perms.set(mod.id, {
            moduleId: mod.id,
            hasAccess: isVisible, // If visible, user has access
            isVisible,
          });
        }
        setPermissions(perms);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [open, targetUser]);

  /** Toggle access (checkbox) - also sets visibility to true when granting access */
  function toggleAccess(moduleId: string) {
    setPermissions((prev) => {
      const next = new Map(prev);
      const current = next.get(moduleId);
      if (!current) return prev;

      const newHasAccess = !current.hasAccess;
      // When granting access, default visibility to true
      // When revoking access, set visibility to false
      next.set(moduleId, {
        ...current,
        hasAccess: newHasAccess,
        isVisible: newHasAccess,
      });
      return next;
    });
  }

  /** Toggle visibility only (eye icon) - only works if hasAccess is true */
  function toggleVisibility(moduleId: string) {
    setPermissions((prev) => {
      const next = new Map(prev);
      const current = next.get(moduleId);
      if (!current || !current.hasAccess) return prev;

      next.set(moduleId, {
        ...current,
        isVisible: !current.isVisible,
      });
      return next;
    });
  }

  function toggleGroup(groupModuleIds: string[]) {
    const allAccessed = groupModuleIds.every((id) => permissions.get(id)?.hasAccess);
    setPermissions((prev) => {
      const next = new Map(prev);
      for (const id of groupModuleIds) {
        const current = next.get(id);
        if (!current) continue;
        const newHasAccess = !allAccessed;
        next.set(id, {
          ...current,
          hasAccess: newHasAccess,
          isVisible: newHasAccess, // Also toggle visibility with access
        });
      }
      return next;
    });
  }

  async function handleSave() {
    if (!targetUser || !user) return;
    setSaving(true);
    setError(null);

    try {
      const permArray = Array.from(permissions.values()).map((p) => ({
        moduleId: p.moduleId,
        isVisible: p.isVisible,
      }));
      await setUserPermissions(targetUser.id, permArray, user.id);
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
        className="bg-card border-border text-foreground w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display text-xl text-foreground">
            Permissoes
          </SheetTitle>
          {targetUser && (
            <p className="text-sm text-muted-foreground">{targetUser.full_name}</p>
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
            <p className="text-xs text-muted-foreground">
              Marque para permitir acesso. Use o icone de olho para controlar a visibilidade na barra lateral.
            </p>
            {Object.entries(grouped).map(([groupLabel, groupMods]) => {
              const groupIds = groupMods.map((m) => m.id);
              const allAccessed = groupIds.every((id) => permissions.get(id)?.hasAccess);

              return (
                <div key={groupLabel} className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={allAccessed}
                      onChange={() => toggleGroup(groupIds)}
                      className="h-4 w-4 rounded border-input bg-muted text-champagne-400 focus:ring-champagne-400/40"
                    />
                    <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-champagne-400 group-hover:text-champagne-300">
                      {groupLabel}
                    </span>
                  </label>

                  <div className="flex flex-col gap-1 pl-6">
                    {groupMods.map((mod) => {
                      const perm = permissions.get(mod.id);
                      const hasAccess = perm?.hasAccess ?? false;
                      const isVisible = perm?.isVisible ?? true;

                      return (
                        <div
                          key={mod.id}
                          className="flex items-center gap-2 py-1 hover:bg-accent rounded px-2 -mx-2"
                        >
                          <input
                            type="checkbox"
                            checked={hasAccess}
                            onChange={() => toggleAccess(mod.id)}
                            className="h-3.5 w-3.5 rounded border-input bg-muted text-champagne-400 focus:ring-champagne-400/40"
                          />
                          <span className="text-sm text-muted-foreground flex-1">{mod.label}</span>
                          <button
                            type="button"
                            onClick={() => toggleVisibility(mod.id)}
                            disabled={!hasAccess}
                            className={`p-1 rounded transition-colors ${
                              hasAccess
                                ? 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                : 'opacity-30 cursor-not-allowed text-muted-foreground'
                            }`}
                            title={hasAccess ? (isVisible ? 'Ocultar da barra lateral' : 'Mostrar na barra lateral') : 'Conceda acesso primeiro'}
                          >
                            {isVisible ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
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
