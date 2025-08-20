// src/pages/PartyAssignPage.tsx
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useDrinks } from "../hooks/useDrinks";
import { useParties } from "../features/parties/useParties";
import { usePartyAssignments } from "../features/parties/usePartyAssignments";

import PartyPicker from "../components/PartyPicker";

type ListRow = {
  idKey: string;   // "" if not available
  slugKey: string; // "" if not available
  title: string;   // non-empty
};

export default function PartyAssignPage() {
  // Drinks (names only list)
  const { drinks, loading: loadingDrinks } = useDrinks();

  // Parties + CRUD
  const {
    parties,
    loading: loadingParties,
    errorMessage: partiesError,
    reload,
    createParty,
    updateParty,
    deleteParty,
  } = useParties();

  // Page state
  const [partyId, setPartyId] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");

  // Defer heavy filter work until the browser is idle-ish
  const dq = useDeferredValue(q);

  // Create/Edit toggles + fields
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTagline, setNewTagline] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [editTitle, setEditTitle] = useState("");

  // Assignments for chosen party
  const {
    drinkIds: assigned = [],     // safe default avoids transient undefined
    add,
    remove,
    setMany,
    loading: loadingAssigns,
    errorMessage: assignsError,
  } = usePartyAssignments(partyId);

  const currentParty = parties.find((p) => p.id === partyId);

  // Keep edit form in sync
  useEffect(() => {
    if (currentParty && showEdit) {
      setEditName(currentParty.name || "");
      setEditDate(currentParty.date || "");
      setEditTagline(currentParty.tagline || "");
      setEditTitle(currentParty.title || "");
    }
  }, [currentParty, showEdit]);

  // Build list with BOTH keys so we can match by id OR slug
  const list: ListRow[] = useMemo(() => {
    const s = dq.trim().toLowerCase();
    return (drinks ?? [])
      .map((d: any) => ({
        idKey: d?.id !== undefined && d?.id !== null ? String(d.id) : "",
        slugKey: d?.slug ? String(d.slug) : "",
        title: d?.title ?? "",
      }))
      .filter((r) => r.title) // ensure non-empty title
      .filter((r) => !s || r.title.toLowerCase().includes(s))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [drinks, dq]);

  // Assigned set for O(1) lookups
  const assignedSet = useMemo(() => new Set(assigned.map(String)), [assigned]);

  // Bulk helpers use a “select key” per row (prefer id, fallback slug)
  const selectKeysVisible = useMemo(
    () => list.map((r) => r.idKey || r.slugKey).filter(Boolean) as string[],
    [list]
  );

  const allAssignedVisible = useMemo(
    () =>
      selectKeysVisible.length > 0 &&
      selectKeysVisible.every((k) => assignedSet.has(k)),
    [selectKeysVisible, assignedSet]
  );

  const toggleAllVisible = useCallback(async () => {
    if (!partyId) return;
    if (allAssignedVisible) {
      const next = assigned.filter((k: string) => !selectKeysVisible.includes(k));
      await setMany(next);
    } else {
      const union = Array.from(new Set([...assigned, ...selectKeysVisible]));
      await setMany(union);
    }
  }, [partyId, allAssignedVisible, assigned, selectKeysVisible, setMany]);

  // CRUD
  const onDeleteParty = useCallback(async () => {
    if (!partyId) return;
    const name = currentParty?.name ?? "this party";
    if (!confirm(`Delete "${name}"?\nThis will also remove its drink assignments.`)) return;
    await deleteParty(partyId);
    setPartyId(undefined);
    await reload();
  }, [partyId, currentParty?.name, deleteParty, reload]);

  const onCreateParty = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const p = await createParty({
      name,
      date: newDate || null,
      tagline: newTagline || null,
      title: newTitle || null,
    });
    setPartyId(p.id);
    setShowCreate(false);
    setNewName(""); setNewDate(""); setNewTagline(""); setNewTitle("");
  }, [newName, newDate, newTagline, newTitle, createParty]);

  const onEditParty = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) return;
    const name = editName.trim();
    if (!name) return;
    await updateParty(partyId, {
      name,
      date: editDate || null,
      tagline: editTagline || null,
      title: editTitle || null,
    });
    setShowEdit(false);
    await reload();
  }, [partyId, editName, editDate, editTagline, editTitle, updateParty, reload]);

  // Row (inline) — ensures checked is boolean
  const renderRow = useCallback(
    (row: ListRow) => {
      const checked =
        (!!row.idKey && assignedSet.has(row.idKey)) ||
        (!!row.slugKey && assignedSet.has(row.slugKey));

      const selectKey = row.idKey || row.slugKey;

      return (
        <label
          key={row.idKey || row.slugKey || row.title}
          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
          title={checked ? "Remove from party" : "Add to party"}
          aria-pressed={checked}
        >
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={checked}
            onChange={async (e) => {
              if (!selectKey) return;
              if (e.target.checked) await add(selectKey);
              else await remove(selectKey);
            }}
            disabled={loadingAssigns}
            aria-label={row.title}
          />
          <span className="text-sm">{row.title}</span>
        </label>
      );
    },
    [assignedSet, add, remove, loadingAssigns]
  );

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Assign Drinks to Party</h1>
          <p className="text-sm text-gray-500">This view shows only cocktail names.</p>
        </div>
        <div className="flex items-center gap-3">
          <PartyPicker
            parties={parties}
            value={partyId}
            onChange={(id) => { setPartyId(id); setShowEdit(false); }}
          />
          <input
            className="border rounded-md px-2 py-1"
            placeholder="Search by name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search drinks by name"
          />
          <button
            className="text-xs border rounded-md px-2 py-1"
            onClick={reload}
            title="Reload parties"
            disabled={loadingParties}
          >
            {loadingParties ? "Reloading…" : "Reload parties"}
          </button>

          {partyId && (
            <button
              className="text-xs border rounded-md px-2 py-1 text-red-700 border-red-300 hover:bg-red-50 disabled:opacity-60"
              onClick={onDeleteParty}
              title="Delete this party"
              disabled={loadingParties || loadingAssigns}
            >
              Delete
            </button>
          )}

          {partyId && (
            <button
              className="text-xs border rounded-md px-2 py-1"
              onClick={() => {
                if (currentParty) {
                  setEditName(currentParty.name || "");
                  setEditDate(currentParty.date || "");
                  setEditTagline(currentParty.tagline || "");
                  setEditTitle(currentParty.title || "");
                }
                setShowEdit((v) => !v);
                setShowCreate(false);
              }}
              title="Edit this party"
              aria-pressed={showEdit}
            >
              {showEdit ? "Cancel edit" : "Edit"}
            </button>
          )}

          <button
            className="text-xs border rounded-md px-2 py-1"
            onClick={() => { setShowCreate((v) => !v); setShowEdit(false); }}
            title="Create a new party"
            aria-pressed={showCreate}
          >
            {showCreate ? "Cancel" : "New party"}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="text-xs text-gray-500">
        Parties: {loadingParties ? "loading…" : parties.length}
        {partiesError && <span className="ml-2 text-red-600">Failed to load parties</span>}
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={onCreateParty} className="rounded-2xl border bg-white p-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Name *</label>
            <input className="border rounded-md px-2 py-1" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Date (YYYY-MM-DD)</label>
            <input className="border rounded-md px-2 py-1" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Tagline</label>
            <input className="border rounded-md px-2 py-1" value={newTagline} onChange={(e) => setNewTagline(e.target.value)} />
          </div>
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-xs text-gray-600">Title</label>
            <input className="border rounded-md px-2 py-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <button type="submit" className="text-xs border rounded-md px-3 py-1 bg-blue-600 text-white" disabled={loadingParties}>
            Create
          </button>
        </form>
      )}

      {/* Tagline (view mode) */}
      {partyId && !showEdit && currentParty?.tagline && (
        <div className="text-sm italic text-gray-600">{currentParty.tagline}</div>
      )}

      {/* Edit form */}
      {partyId && showEdit && currentParty && (
        <form onSubmit={onEditParty} className="rounded-2xl border bg-white p-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Name *</label>
            <input className="border rounded-md px-2 py-1" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Date (YYYY-MM-DD)</label>
            <input className="border rounded-md px-2 py-1" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Tagline</label>
            <input className="border rounded-md px-2 py-1" value={editTagline} onChange={(e) => setEditTagline(e.target.value)} />
          </div>
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-xs text-gray-600">Title</label>
            <input className="border rounded-md px-2 py-1" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <button type="submit" className="text-xs border rounded-md px-3 py-1 bg-blue-600 text-white" disabled={loadingParties}>
            Save
          </button>
        </form>
      )}

      {/* Empty state */}
      {!partyId && !showCreate && (
        <div className="rounded-2xl border bg-white p-4 text-gray-600">
          Choose a party to begin assigning drinks.
        </div>
      )}

      {/* Assignment list */}
      {partyId && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {list.length} drinks • Assigned in this party: {assigned.length}
              {loadingAssigns && <span className="ml-2">updating…</span>}
              {assignsError && <span className="ml-2 text-red-600">update failed</span>}
            </div>
            <button
              className="text-xs border rounded-md px-2 py-1"
              onClick={toggleAllVisible}
              disabled={list.length === 0}
              title={allAssignedVisible ? "Unassign all visible" : "Assign all visible"}
            >
              {allAssignedVisible ? "Unassign all (visible)" : "Assign all (visible)"}
            </button>
          </div>

          <div className="rounded-2xl border bg-white divide-y">
            {loadingDrinks && <div className="p-3 text-sm text-gray-600">Loading drinks…</div>}
            {!loadingDrinks && list.length === 0 && (
              <div className="p-3 text-sm text-gray-600">No drinks match.</div>
            )}
            {!loadingDrinks && list.map(renderRow)}
          </div>
        </>
      )}
    </div>
  );
}
