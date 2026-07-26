"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ALLOWED_IMAGE_ACCEPT, validateImageUpload } from "@/constants";
import { Organizer } from "@/types";

import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../Toast";

interface Props {
  organizer?: Organizer;
  cloudinaryEnabled: boolean;
  onDone: () => void;
}

const inputCls =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";

export default function OrganizerForm({ organizer, cloudinaryEnabled, onDone }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  const photoFileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(organizer?.name ?? "");
  const [role, setRole] = useState(organizer?.role ?? "");
  const [bio, setBio] = useState(organizer?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(organizer?.photoUrl ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    organizer ? String(organizer.displayOrder) : "0"
  );
  const [published, setPublished] = useState(organizer ? organizer.published : true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const invalid = validateImageUpload({ name: file.name, type: file.type, size: file.size });
    if (invalid) {
      showToast(`${file.name}: ${invalid}`, "error");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Upload failed", "error");
      } else {
        setPhotoUrl(data.url as string);
      }
    } catch {
      showToast("Upload failed — could not reach the server", "error");
    } finally {
      setUploading(false);
      if (photoFileRef.current) photoFileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return showToast("Enter the organizer's name", "error");

    setBusy(true);
    const payload = {
      name: name.trim(),
      role: role.trim(),
      bio: bio.trim(),
      photoUrl: photoUrl.trim(),
      displayOrder: Number(displayOrder) || 0,
      published,
    };

    try {
      const res = await fetch(
        organizer ? `/api/admin/organizers/${organizer.id}` : "/api/admin/organizers",
        {
          method: organizer ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not save the organizer", "error");
        setBusy(false);
        return;
      }
      router.refresh();
      onDone();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!organizer) return;
    const ok = await confirm({
      title: "Remove organizer",
      message: `Remove "${organizer.name}" from the Organizers page? This cannot be undone.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/organizers/${organizer.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not remove the organizer", "error");
        setBusy(false);
        return;
      }
      router.refresh();
      onDone();
    } catch {
      showToast("Could not reach the server", "error");
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-6">
        <p className="text-sm text-slate-700">
          <span className="text-red-600" aria-hidden="true">
            *
          </span>{" "}
          Required fields
        </p>

        <div>
          <Label required>Name</Label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            minLength={2}
            maxLength={80}
            className={inputCls}
          />
        </div>

        <div>
          <Label>Role / title (optional)</Label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Founder & Director"
            maxLength={120}
            className={inputCls}
          />
        </div>

        <div>
          <Label>Bio (optional)</Label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio shown on the Organizers page"
            rows={4}
            className={inputCls}
          />
        </div>

        <div>
          <Label>Photo</Label>
          <div className="flex gap-2">
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://res.cloudinary.com/… or https://drive.google.com/file/d/…"
              className={inputCls}
            />
            {cloudinaryEnabled && (
              <>
                <input
                  ref={photoFileRef}
                  type="file"
                  accept={ALLOWED_IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(e) => uploadPhoto(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => photoFileRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-4 text-sm font-medium transition-colors"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </>
            )}
          </div>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Photo preview"
              className="mt-2 h-24 w-24 rounded-full object-cover border border-slate-200"
            />
          )}
        </div>

        <div>
          <Label>Display order</Label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            step={1}
            className={inputCls}
          />
          <p className="text-sm text-slate-700 mt-1.5">
            Lower numbers show first on the public Organizers page.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
          <input
            id="organizer-published"
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 accent-[#1d4ed8]"
          />
          <label htmlFor="organizer-published" className="text-sm">
            <span className="font-medium">Published</span>
            <span className="text-slate-800"> — visible on the public Organizers page</span>
          </label>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={busy || uploading}
            className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
          >
            {busy ? "Saving…" : organizer ? "Save changes" : "Add organizer"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          {organizer && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ml-auto text-sm text-red-700 hover:text-red-700 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
      </form>
      {dialog}
      {toast}
    </>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm text-slate-800 mb-1.5">
      {children}
      {required && (
        <span className="text-red-600 ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}
