"use client";

import { useRef, useState } from "react";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  ALLOWED_IMAGE_ACCEPT,
  MAX_GALLERY_PHOTOS,
  MAX_TOTAL_ROWS,
  validateImageUpload,
} from "@/constants";
import { isValidSeatId } from "@/lib/domain/events";
import { buildVenue } from "@/lib/domain/venue";
import { EventItem, EventLayout } from "@/types";

import { useConfirm } from "../ConfirmDialog";
import LayoutEditor from "../LayoutEditor";
import { useToast } from "../Toast";

const EMPTY_LAYOUT: EventLayout = { sections: [] };

interface CategoryDraft {
  id?: string;
  name: string;
  priceInr: string; // rupees in the form; converted to paise on submit
  rows: string;
  seatsPerRow: string;
}

interface FaqDraft {
  question: string;
  answer: string;
}

interface Props {
  event?: EventItem;
  /** Called after a successful save/delete (drawer closes itself). */
  onDone: () => void;
  cloudinaryEnabled: boolean;
}

/** ISO -> value for <input type="datetime-local"> in the admin's local timezone. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#d99a45]";

export default function EventForm({ event, onDone, cloudinaryEnabled }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  const [title, setTitle] = useState(event?.title ?? "");
  const [tagline, setTagline] = useState(event?.tagline ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [city, setCity] = useState(event?.city ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.startsAt ?? ""));
  const [opensAt, setOpensAt] = useState(toLocalInput(event?.registrationOpensAt ?? ""));
  const [closesAt, setClosesAt] = useState(toLocalInput(event?.registrationClosesAt ?? ""));
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? "");
  const [bookMyShowUrl, setBookMyShowUrl] = useState(event?.bookMyShowUrl ?? "");
  const [gallery, setGallery] = useState<string[]>(event?.gallery ?? []);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [featured, setFeatured] = useState(event?.featured ?? false);
  const [published, setPublished] = useState(event?.published ?? false);
  const [categories, setCategories] = useState<CategoryDraft[]>(
    event?.categories.map((c) => ({
      id: c.id,
      name: c.name,
      priceInr: String(c.price / 100),
      rows: String(c.rows),
      seatsPerRow: String(c.seatsPerRow),
    })) ?? [{ name: "General", priceInr: "499", rows: "5", seatsPerRow: "12" }]
  );
  const [faqs, setFaqs] = useState<FaqDraft[]>(event?.faqs ?? []);
  const [seatingMode, setSeatingMode] = useState<"simple" | "layout">(
    event?.layout && event.layout.sections?.length ? "layout" : "simple"
  );
  const [layout, setLayout] = useState<EventLayout>(event?.layout ?? EMPTY_LAYOUT);
  const [blockedInput, setBlockedInput] = useState(event?.blockedSeats.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"banner" | "gallery" | null>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  const setCategory = (i: number, patch: Partial<CategoryDraft>) =>
    setCategories((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setFaq = (i: number, patch: Partial<FaqDraft>) =>
    setFaqs((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const uploadFile = async (file: File): Promise<string | null> => {
    // Mirror the server's rule for instant feedback (server still enforces it).
    const invalid = validateImageUpload({ name: file.name, type: file.type, size: file.size });
    if (invalid) {
      showToast(`${file.name}: ${invalid}`, "error");
      return null;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Upload failed", "error");
        return null;
      }
      return data.url as string;
    } catch {
      showToast("Upload failed — could not reach the server", "error");
      return null;
    }
  };

  const uploadBanner = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading("banner");
    const url = await uploadFile(files[0]);
    if (url) setImageUrl(url);
    setUploading(null);
    if (bannerFileRef.current) bannerFileRef.current.value = "";
  };

  const uploadGallery = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading("gallery");
    for (const file of Array.from(files)) {
      if (gallery.length >= MAX_GALLERY_PHOTOS) break;
      const url = await uploadFile(file);
      if (!url) break;
      setGallery((prev) =>
        prev.length < MAX_GALLERY_PHOTOS && !prev.includes(url) ? [...prev, url] : prev
      );
    }
    setUploading(null);
    if (galleryFileRef.current) galleryFileRef.current.value = "";
  };

  const addGalleryUrl = () => {
    const url = galleryUrl.trim();
    if (!url) return;
    if (gallery.length >= MAX_GALLERY_PHOTOS) {
      showToast(`Gallery is limited to ${MAX_GALLERY_PHOTOS} photos`, "error");
      return;
    }
    setGallery((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setGalleryUrl("");
  };

  /**
   * Mirrors the server's validateEventInput() rules so mistakes surface
   * instantly instead of after a round trip to /api/admin/events.
   */
  const validateDraft = (): string | null => {
    if (!title.trim()) return "Title is required";
    if (!venue.trim()) return "Venue is required";
    if (!startsAt) return "Event start date/time is required";
    if (!opensAt) return "Registration opening date/time is required";
    if (!closesAt) return "Registration closing date/time is required";
    if (new Date(opensAt) >= new Date(closesAt)) {
      return "Registration must open before it closes";
    }

    let probe: EventItem;
    if (seatingMode === "layout") {
      if (!layout.sections.length) return "Add at least one seating section";
      probe = { categories: [], layout, blockedSeats: [] } as unknown as EventItem;
      if (buildVenue(probe).seats.length === 0) return "The layout has no seats yet";
    } else {
      let totalRows = 0;
      for (const cat of categories) {
        const name = cat.name.trim() || "(unnamed)";
        if (!cat.name.trim()) return "Every ticket category needs a name";
        const price = Number(cat.priceInr);
        if (!Number.isFinite(price) || price <= 0) {
          return `Category "${name}": price must be a positive amount`;
        }
        const rows = Number(cat.rows);
        if (!Number.isInteger(rows) || rows < 1 || rows > MAX_TOTAL_ROWS) {
          return `Category "${name}": rows must be between 1 and ${MAX_TOTAL_ROWS}`;
        }
        const seatsPerRow = Number(cat.seatsPerRow);
        if (!Number.isInteger(seatsPerRow) || seatsPerRow < 1 || seatsPerRow > 40) {
          return `Category "${name}": seats per row must be between 1 and 40`;
        }
        totalRows += rows;
      }
      if (totalRows > MAX_TOTAL_ROWS) {
        return `Total rows across categories cannot exceed ${MAX_TOTAL_ROWS}`;
      }
      probe = {
        categories: categories.map((c) => ({
          id: c.id ?? "draft",
          name: c.name,
          price: 0,
          rows: Number(c.rows) || 0,
          seatsPerRow: Number(c.seatsPerRow) || 0,
        })),
        blockedSeats: [],
      } as unknown as EventItem;
    }

    const blocked = blockedInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    for (const seatId of blocked) {
      if (!isValidSeatId(probe, seatId)) {
        return `Blocked seat "${seatId}" is not in the seat layout`;
      }
    }

    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draftError = validateDraft();
    if (draftError) {
      showToast(draftError, "error");
      return;
    }
    setBusy(true);

    const payload = {
      title,
      tagline,
      description,
      venue,
      city,
      startsAt: startsAt ? new Date(startsAt).toISOString() : "",
      registrationOpensAt: opensAt ? new Date(opensAt).toISOString() : "",
      registrationClosesAt: closesAt ? new Date(closesAt).toISOString() : "",
      imageUrl,
      bookMyShowUrl: bookMyShowUrl.trim(),
      gallery,
      featured,
      published,
      categories:
        seatingMode === "layout"
          ? []
          : categories.map((c) => ({
              id: c.id,
              name: c.name,
              price: Math.round(Number(c.priceInr) * 100),
              rows: Number(c.rows),
              seatsPerRow: Number(c.seatsPerRow),
            })),
      layout: seatingMode === "layout" ? layout : null,
      faqs,
      blockedSeats: blockedInput
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    };

    try {
      const res = await fetch(event ? `/api/admin/events/${event.id}` : "/api/admin/events", {
        method: event ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not save the event", "error");
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
    if (!event) return;
    const ok = await confirm({
      title: "Delete event",
      message: `Delete "${event.title}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Could not delete the event", "error");
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
      <form onSubmit={submit} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Event details</h2>
          <div>
            <Label>Title</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <Label>Tagline (shown on the landing-page hero)</Label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One night. Three headliners."
              className={inputCls}
            />
          </div>
          <div>
            <Label>BookMyShow link (optional — shows an “also on BookMyShow” option)</Label>
            <input
              type="url"
              value={bookMyShowUrl}
              onChange={(e) => setBookMyShowUrl(e.target.value)}
              placeholder="https://in.bookmyshow.com/events/..."
              className={inputCls}
            />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={inputCls}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Venue</Label>
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <Label>City</Label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Images</h2>
          <div>
            <Label>Banner image</Label>
            <div className="flex gap-2">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/… or https://drive.google.com/file/d/…"
                className={inputCls}
              />
              {cloudinaryEnabled && (
                <>
                  <input
                    ref={bannerFileRef}
                    type="file"
                    accept={ALLOWED_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(e) => uploadBanner(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => bannerFileRef.current?.click()}
                    disabled={uploading !== null}
                    className="shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-lg px-4 text-sm font-medium transition-colors"
                  >
                    {uploading === "banner" ? "Uploading…" : "Upload"}
                  </button>
                </>
              )}
            </div>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Banner preview"
                className="mt-2 h-24 rounded-lg object-cover border border-zinc-800"
              />
            )}
          </div>

          <div>
            <Label>
              Photo gallery ({gallery.length}/{MAX_GALLERY_PHOTOS}) — shown on the landing page
            </Label>
            {gallery.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                {gallery.map((url, i) => (
                  <div key={url} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Gallery photo ${i + 1}`}
                      className="aspect-square w-full rounded-lg object-cover border border-zinc-800"
                    />
                    <button
                      type="button"
                      onClick={() => setGallery((prev) => prev.filter((u) => u !== url))}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 w-6 h-6 inline-flex items-center justify-center rounded-full bg-black/70 text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={galleryUrl}
                onChange={(e) => setGalleryUrl(e.target.value)}
                placeholder="Paste an image URL…"
                className={inputCls}
              />
              <button
                type="button"
                onClick={addGalleryUrl}
                className="shrink-0 bg-zinc-800 hover:bg-zinc-700 rounded-lg px-4 text-sm font-medium transition-colors"
              >
                Add
              </button>
              {cloudinaryEnabled && (
                <>
                  <input
                    ref={galleryFileRef}
                    type="file"
                    accept={ALLOWED_IMAGE_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => uploadGallery(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => galleryFileRef.current?.click()}
                    disabled={uploading !== null}
                    className="shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-lg px-4 text-sm font-medium transition-colors"
                  >
                    {uploading === "gallery" ? "Uploading…" : "Upload"}
                  </button>
                </>
              )}
            </div>
            {!cloudinaryEnabled && (
              <p className="text-xs text-zinc-600 mt-1.5">
                Set the CLOUDINARY_* env vars to enable direct uploads; URL paste always works.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Schedule</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Event starts</Label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <Label>Registration opens</Label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <Label>Registration closes</Label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Seating &amp; pricing</h2>
            {/* Simple uniform grid vs. a rich multi-section venue layout. */}
            <div className="ml-auto inline-flex rounded-lg border border-zinc-800 p-0.5 text-xs">
              {(["simple", "layout"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSeatingMode(m)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    seatingMode === m
                      ? "bg-[#d99a45] text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {m === "simple" ? "Simple grid" : "Advanced layout"}
                </button>
              ))}
            </div>
          </div>

          {seatingMode === "layout" ? (
            <LayoutEditor value={layout} onChange={setLayout} />
          ) : (
            <>
              <div className="flex items-center">
                <span className="text-xs text-zinc-500">
                  Front rows first — order defines the seat map
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCategories((prev) => [
                      ...prev,
                      { name: "", priceInr: "", rows: "2", seatsPerRow: "12" },
                    ])
                  }
                  className="ml-auto text-sm text-[#d99a45] hover:underline"
                >
                  + Add category
                </button>
              </div>
              {categories.map((cat, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-[1fr_120px_90px_110px_32px] gap-3 items-end bg-zinc-900 border border-zinc-800 rounded-xl p-3"
                >
                  <div>
                    <Label>Name</Label>
                    <input
                      value={cat.name}
                      onChange={(e) => setCategory(i, { name: e.target.value })}
                      placeholder="VIP"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Price (₹)</Label>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      value={cat.priceInr}
                      onChange={(e) => setCategory(i, { priceInr: e.target.value })}
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Rows</Label>
                    <input
                      type="number"
                      min={1}
                      max={MAX_TOTAL_ROWS}
                      value={cat.rows}
                      onChange={(e) => setCategory(i, { rows: e.target.value })}
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Seats/row</Label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={cat.seatsPerRow}
                      onChange={(e) => setCategory(i, { seatsPerRow: e.target.value })}
                      required
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategories((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={categories.length === 1}
                    aria-label="Remove category"
                    className="h-10 inline-flex items-center text-zinc-500 hover:text-red-400 disabled:opacity-30"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </>
          )}
          <div>
            <Label>
              Blocked seats — extra ad-hoc holds on top of any layout blocking (comma-separated,
              e.g. {seatingMode === "layout" ? "LWR-C10, BAL-A5" : "A1, A2, B5"})
            </Label>
            <input
              value={blockedInput}
              onChange={(e) => setBlockedInput(e.target.value)}
              placeholder={seatingMode === "layout" ? "LWR-C10" : "A1, A2"}
              className={inputCls}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold">FAQs</h2>
            <button
              type="button"
              onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
              className="ml-auto text-sm text-[#d99a45] hover:underline"
            >
              + Add FAQ
            </button>
          </div>
          {faqs.length === 0 ? (
            <p className="text-sm text-zinc-500">No FAQs yet.</p>
          ) : (
            <p className="text-xs text-zinc-600">
              Both question and answer are required to save a FAQ — rows missing either are silently
              dropped on save.
            </p>
          )}
          {faqs.map((faq, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex gap-3">
                <input
                  value={faq.question}
                  onChange={(e) => setFaq(i, { question: e.target.value })}
                  placeholder="Question"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setFaqs((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove FAQ"
                  className="inline-flex items-center text-zinc-500 hover:text-red-400 px-1"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <textarea
                value={faq.answer}
                onChange={(e) => setFaq(i, { answer: e.target.value })}
                placeholder="Answer"
                rows={2}
                className={inputCls}
              />
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <input
              id="published"
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 accent-[#d99a45]"
            />
            <label htmlFor="published" className="text-sm">
              <span className="font-medium">Published</span>
              <span className="text-zinc-500"> — visible on the site and open for booking</span>
            </label>
          </div>
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <input
              id="featured"
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 accent-[#d99a45]"
            />
            <label htmlFor="featured" className="text-sm">
              <span className="font-medium">Featured</span>
              <span className="text-zinc-500">
                {" "}
                — becomes the site&apos;s landing page (only one event can be featured)
              </span>
            </label>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={busy || uploading !== null}
            className="bg-[#d99a45] hover:bg-[#bf863a] disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
          >
            {busy ? "Saving…" : event ? "Save changes" : "Create event"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          {event && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ml-auto text-sm text-red-400 hover:text-red-300 disabled:opacity-40"
            >
              Delete event
            </button>
          )}
        </div>
      </form>
      {dialog}
      {toast}
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-zinc-500 mb-1.5">{children}</label>;
}
