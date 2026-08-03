'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserRound } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { ui } from '@/lib/utils/ui-classes';
import type { AssignableSiteUser } from '@/lib/services/siteService';

function formatDisplayNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    return digits.slice(2);
  }
  return digits || number;
}

type AssignSiteUsersModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  users: AssignableSiteUser[];
  isLoading: boolean;
  isSubmitting: boolean;
  onAssign: (userIds: string[]) => void;
}>;

export default function AssignSiteUsersModal({
  open,
  onClose,
  users,
  isLoading,
  isSubmitting,
  onAssign,
}: AssignSiteUsersModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setSearch('');
  }, [open]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(term) ||
        user.number.toLowerCase().includes(term) ||
        formatDisplayNumber(user.number).includes(term),
    );
  }, [users, search]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.has(user.id));

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const user of filteredUsers) {
        next.add(user.id);
      }
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const user of filteredUsers) {
        next.delete(user.id);
      }
      return next;
    });
  };

  const handleAssign = () => {
    if (selectedIds.size === 0) return;
    onAssign([...selectedIds]);
  };

  return (
    <Modal
      open={open}
      onClose={() => !isSubmitting && onClose()}
      title="Assign new user"
      size="lg"
      closeButtonClassName="shrink-0 rounded-full border border-red-200 bg-white p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            {selectedIds.size > 0
              ? `${selectedIds.size} user${selectedIds.size === 1 ? '' : 's'} selected`
              : 'No users selected'}
          </p>
          <button
            type="button"
            onClick={handleAssign}
            disabled={isSubmitting || selectedIds.size === 0}
            className={ui.btnPrimary}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Assigning…
              </>
            ) : (
              'Assign'
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or number"
              className={`${ui.inputEditable} !rounded-xl pl-9`}
              autoComplete="off"
            />
          </div>
          {filteredUsers.length > 0 && (
            <div className="flex justify-start">
              {allFilteredSelected ? (
                <button
                  type="button"
                  onClick={deselectAllFiltered}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                  Deselect all
                </button>
              ) : (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-sm font-semibold text-brand-primary hover:text-brand-primaryDark"
                >
                  Select all
                </button>
              )}
            </div>
          )}
        </div>

        <div className="max-h-[min(50vh,400px)] overflow-y-auto rounded-xl border border-gray-200 bg-white">
          {isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center bg-gray-50/60">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
              <UserRound className="mb-3 text-gray-300" size={32} />
              <p className="text-sm font-medium text-gray-700">No users available to assign</p>
              <p className="mt-1 text-sm text-gray-500">
                All users are already assigned to this site.
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-gray-500">
              No users match your search.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredUsers.map((user) => {
                const checked = selectedIds.has(user.id);
                return (
                  <li key={user.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-4 px-4 py-3.5 transition-colors hover:bg-gray-50 ${
                        checked ? 'bg-brand-pastel-blue/30' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(user.id)}
                        aria-label={`Select ${user.name}`}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/30"
                      />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                        <p className="truncate text-[15px] font-semibold text-gray-600">{user.name}</p>
                        <p className="shrink-0 text-[15px] tabular-nums text-gray-500">
                          {formatDisplayNumber(user.number)}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
