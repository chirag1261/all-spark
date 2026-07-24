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
import {
  EventItem,
  EventLayout,
  LandingDetail,
  LandingScheduleItem,
  LandingStat,
  LandingWhyCard,
} from "@/types";

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
  /**
   * Prefills the form from an existing event without editing it — used by the
   * "Clone" action. Submitting still creates a brand-new event (POST), never
   * a PUT against the source. Ignored if `event` is also set.
   */
  cloneFrom?: EventItem;
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
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]";

export default function EventForm({ event, cloneFrom, onDone, cloudinaryEnabled }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { showToast, toast } = useToast();
  // Prefill source for everything EXCEPT title/featured/published, which get
  // clone-specific treatment below (never editing `event` in place here).
  const source = event ?? cloneFrom;
  const [title, setTitle] = useState(
    event ? event.title : cloneFrom ? `${cloneFrom.title} (Copy)` : ""
  );
  const [tagline, setTagline] = useState(source?.tagline ?? "");
  const [description, setDescription] = useState(source?.description ?? "");
  const [venue, setVenue] = useState(source?.venue ?? "");
  const [city, setCity] = useState(source?.city ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(source?.startsAt ?? ""));
  const [opensAt, setOpensAt] = useState(toLocalInput(source?.registrationOpensAt ?? ""));
  const [closesAt, setClosesAt] = useState(toLocalInput(source?.registrationClosesAt ?? ""));
  const [imageUrl, setImageUrl] = useState(source?.imageUrl ?? "");
  const [bookMyShowUrl, setBookMyShowUrl] = useState(source?.bookMyShowUrl ?? "");
  const [gallery, setGallery] = useState<string[]>(source?.gallery ?? []);
  const [galleryUrl, setGalleryUrl] = useState("");
  // A clone never inherits "featured" (only one event may hold it) or
  // "published" (an unreviewed copy must never go live automatically).
  const [featured, setFeatured] = useState(event ? event.featured : false);
  const [published, setPublished] = useState(event ? event.published : false);
  const [categories, setCategories] = useState<CategoryDraft[]>(
    source?.categories.map((c) => ({
      id: event ? c.id : undefined,
      name: c.name,
      priceInr: String(c.price / 100),
      rows: String(c.rows),
      seatsPerRow: String(c.seatsPerRow),
    })) ?? [{ name: "General", priceInr: "499", rows: "5", seatsPerRow: "12" }]
  );
  const [faqs, setFaqs] = useState<FaqDraft[]>(source?.faqs ?? []);
  const [seatingMode, setSeatingMode] = useState<"simple" | "layout">(
    source?.layout && source.layout.sections?.length ? "layout" : "simple"
  );
  const [layout, setLayout] = useState<EventLayout>(source?.layout ?? EMPTY_LAYOUT);
  const [blockedInput, setBlockedInput] = useState(source?.blockedSeats.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"banner" | "gallery" | "artist" | "venue" | null>(
    null
  );
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const artistFileRef = useRef<HTMLInputElement>(null);
  const venueFileRef = useRef<HTMLInputElement>(null);

  // ---- Rich landing-page content (all optional) ----
  const l = source?.landing;
  const [presenter, setPresenter] = useState(l?.presenter ?? "");
  const [heroKicker, setHeroKicker] = useState(l?.heroKicker ?? "");
  const [whyAttend, setWhyAttend] = useState<LandingWhyCard[]>(l?.whyAttend ?? []);
  const [details, setDetails] = useState<LandingDetail[]>(l?.details ?? []);
  const [schedule, setSchedule] = useState<LandingScheduleItem[]>(l?.schedule ?? []);
  const [artistName, setArtistName] = useState(l?.artist?.name ?? "");
  const [artistTitle, setArtistTitle] = useState(l?.artist?.title ?? "");
  const [artistBio, setArtistBio] = useState(l?.artist?.bio ?? "");
  const [artistImageUrl, setArtistImageUrl] = useState(l?.artist?.imageUrl ?? "");
  const [artistStats, setArtistStats] = useState<LandingStat[]>(l?.artist?.stats ?? []);
  const [venueName, setVenueName] = useState(l?.venue?.name ?? "");
  const [venueAddress, setVenueAddress] = useState(l?.venue?.address ?? "");
  const [venueDescription, setVenueDescription] = useState(l?.venue?.description ?? "");
  const [venueAccessibility, setVenueAccessibility] = useState(l?.venue?.accessibility ?? "");
  const [venueImageUrl, setVenueImageUrl] = useState(l?.venue?.imageUrl ?? "");

  const setCategory = (i: number, patch: Partial<CategoryDraft>) =>
    setCategories((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setFaq = (i: number, patch: Partial<FaqDraft>) =>
    setFaqs((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const setWhy = (i: number, patch: Partial<LandingWhyCard>) =>
    setWhyAttend((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const setDetail = (i: number, patch: Partial<LandingDetail>) =>
    setDetails((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const setSched = (i: number, patch: Partial<LandingScheduleItem>) =>
    setSchedule((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const setStat = (i: number, patch: Partial<LandingStat>) =>
    setArtistStats((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

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

  const uploadArtist = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading("artist");
    const url = await uploadFile(files[0]);
    if (url) setArtistImageUrl(url);
    setUploading(null);
    if (artistFileRef.current) artistFileRef.current.value = "";
  };

  const uploadVenue = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading("venue");
    const url = await uploadFile(files[0]);
    if (url) setVenueImageUrl(url);
    setUploading(null);
    if (venueFileRef.current) venueFileRef.current.value = "";
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
      // Rich landing content — the server's sanitizeLanding() drops empties/nulls.
      landing: {
        presenter,
        heroKicker,
        whyAttend,
        details,
        schedule,
        artist: {
          name: artistName,
          title: artistTitle,
          bio: artistBio,
          imageUrl: artistImageUrl,
          stats: artistStats,
        },
        venue: {
          name: venueName,
          address: venueAddress,
          description: venueDescription,
          accessibility: venueAccessibility,
          imageUrl: venueImageUrl,
        },
      },
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
                    className="shrink-0 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-4 text-sm font-medium transition-colors"
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
                className="mt-2 h-24 rounded-lg object-cover border border-slate-200"
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
                      className="aspect-square w-full rounded-lg object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setGallery((prev) => prev.filter((u) => u !== url))}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 w-6 h-6 inline-flex items-center justify-center rounded-full bg-black/70 text-slate-700 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
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
                className="shrink-0 bg-slate-100 hover:bg-slate-200 rounded-lg px-4 text-sm font-medium transition-colors"
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
                    className="shrink-0 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-4 text-sm font-medium transition-colors"
                  >
                    {uploading === "gallery" ? "Uploading…" : "Upload"}
                  </button>
                </>
              )}
            </div>
            {!cloudinaryEnabled && (
              <p className="text-xs text-slate-400 mt-1.5">
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
                className={`${inputCls} dt-input`}
              />
            </div>
            <div>
              <Label>Registration opens</Label>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                required
                className={`${inputCls} dt-input`}
              />
            </div>
            <div>
              <Label>Registration closes</Label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                required
                className={`${inputCls} dt-input`}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Seating &amp; pricing</h2>
            {/* Simple uniform grid vs. a rich multi-section venue layout. */}
            <div className="ml-auto inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
              {(["simple", "layout"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSeatingMode(m)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    seatingMode === m
                      ? "bg-[#1d4ed8] text-white"
                      : "text-slate-600 hover:text-slate-800"
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
                <span className="text-xs text-slate-500">
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
                  className="ml-auto text-sm text-[#1d4ed8] hover:underline"
                >
                  + Add category
                </button>
              </div>
              {categories.map((cat, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 sm:grid-cols-[1fr_120px_90px_110px_32px] gap-3 items-end bg-white border border-slate-200 rounded-xl p-3"
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
                    className="h-10 inline-flex items-center text-slate-500 hover:text-red-700 disabled:opacity-30"
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

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Landing page content</h2>
            <p className="text-xs text-slate-400">
              Rich sections shown on the featured-event landing page. Everything here is optional —
              empty sections are hidden automatically.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Presenter line</Label>
              <input
                value={presenter}
                onChange={(e) => setPresenter(e.target.value)}
                placeholder="Utsav Events Presents"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Hero kicker</Label>
              <input
                value={heroKicker}
                onChange={(e) => setHeroKicker(e.target.value)}
                placeholder="An Evening of Sacred Devotion"
                className={inputCls}
              />
            </div>
          </div>

          {/* Why attend */}
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <div className="flex items-center">
              <h3 className="text-sm font-semibold text-slate-700">Why attend</h3>
              <button
                type="button"
                onClick={() => setWhyAttend((prev) => [...prev, { title: "", body: "" }])}
                className="ml-auto text-sm text-[#1d4ed8] hover:underline"
              >
                + Add card
              </button>
            </div>
            {whyAttend.map((c, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex gap-3">
                  <input
                    value={c.title}
                    onChange={(e) => setWhy(i, { title: e.target.value })}
                    placeholder="Card title"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setWhyAttend((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove card"
                    className="inline-flex items-center text-slate-500 hover:text-red-700 px-1"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <textarea
                  value={c.body}
                  onChange={(e) => setWhy(i, { body: e.target.value })}
                  placeholder="Description"
                  rows={2}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          {/* Featured artist */}
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">Featured artist</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <input
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Gajendra Pratap Singh"
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Title</Label>
                <input
                  value={artistTitle}
                  onChange={(e) => setArtistTitle(e.target.value)}
                  placeholder="Renowned Bhajan Singer"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <Label>Bio</Label>
              <textarea
                value={artistBio}
                onChange={(e) => setArtistBio(e.target.value)}
                placeholder="A short biography — blank lines separate paragraphs."
                rows={4}
                className={inputCls}
              />
            </div>
            <div>
              <Label>Artist image</Label>
              <div className="flex gap-2">
                <input
                  value={artistImageUrl}
                  onChange={(e) => setArtistImageUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/…"
                  className={inputCls}
                />
                {cloudinaryEnabled && (
                  <>
                    <input
                      ref={artistFileRef}
                      type="file"
                      accept={ALLOWED_IMAGE_ACCEPT}
                      className="hidden"
                      onChange={(e) => uploadArtist(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => artistFileRef.current?.click()}
                      disabled={uploading !== null}
                      className="shrink-0 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-4 text-sm font-medium transition-colors"
                    >
                      {uploading === "artist" ? "Uploading…" : "Upload"}
                    </button>
                  </>
                )}
              </div>
              {artistImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artistImageUrl}
                  alt="Artist preview"
                  className="mt-2 h-24 rounded-lg object-cover border border-slate-200"
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <Label>Artist stats</Label>
                <button
                  type="button"
                  onClick={() => setArtistStats((prev) => [...prev, { value: "", label: "" }])}
                  className="ml-auto text-sm text-[#1d4ed8] hover:underline"
                >
                  + Add stat
                </button>
              </div>
              {artistStats.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={s.value}
                    onChange={(e) => setStat(i, { value: e.target.value })}
                    placeholder="25+ Years"
                    className={inputCls}
                  />
                  <input
                    value={s.label}
                    onChange={(e) => setStat(i, { label: e.target.value })}
                    placeholder="of devotional music"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setArtistStats((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove stat"
                    className="inline-flex items-center text-slate-500 hover:text-red-700 px-1"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Event details */}
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <div className="flex items-center">
              <h3 className="text-sm font-semibold text-slate-700">Event details</h3>
              <button
                type="button"
                onClick={() => setDetails((prev) => [...prev, { label: "", value: "" }])}
                className="ml-auto text-sm text-[#1d4ed8] hover:underline"
              >
                + Add detail
              </button>
            </div>
            {details.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={d.label}
                  onChange={(e) => setDetail(i, { label: e.target.value })}
                  placeholder="Dress code"
                  className={`${inputCls} sm:max-w-48`}
                />
                <input
                  value={d.value}
                  onChange={(e) => setDetail(i, { value: e.target.value })}
                  placeholder="Traditional attire encouraged"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setDetails((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove detail"
                  className="inline-flex items-center text-slate-500 hover:text-red-700 px-1"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {/* Evening schedule */}
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <div className="flex items-center">
              <h3 className="text-sm font-semibold text-slate-700">Evening schedule</h3>
              <button
                type="button"
                onClick={() =>
                  setSchedule((prev) => [...prev, { time: "", title: "", description: "" }])
                }
                className="ml-auto text-sm text-[#1d4ed8] hover:underline"
              >
                + Add slot
              </button>
            </div>
            {schedule.map((s, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={s.time}
                    onChange={(e) => setSched(i, { time: e.target.value })}
                    placeholder="6:30 PM"
                    className={`${inputCls} sm:max-w-32`}
                  />
                  <input
                    value={s.title}
                    onChange={(e) => setSched(i, { title: e.target.value })}
                    placeholder="Inaugural Prayers"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setSchedule((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove slot"
                    className="inline-flex items-center text-slate-500 hover:text-red-700 px-1"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <input
                  value={s.description}
                  onChange={(e) => setSched(i, { description: e.target.value })}
                  placeholder="Invocation and lamp lighting ceremony"
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          {/* Venue */}
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">Venue</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Venue name</Label>
                <input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Dr. Babu Jagjivanram Bhavan"
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Address</Label>
                <input
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Millers Road, Vasanth Nagar, Bangalore"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={venueDescription}
                onChange={(e) => setVenueDescription(e.target.value)}
                placeholder="A premier cultural auditorium in the heart of Bangalore…"
                rows={3}
                className={inputCls}
              />
            </div>
            <div>
              <Label>Accessibility / parking note</Label>
              <input
                value={venueAccessibility}
                onChange={(e) => setVenueAccessibility(e.target.value)}
                placeholder="Easily accessible by metro and road. Ample parking nearby."
                className={inputCls}
              />
            </div>
            <div>
              <Label>Venue image</Label>
              <div className="flex gap-2">
                <input
                  value={venueImageUrl}
                  onChange={(e) => setVenueImageUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/…"
                  className={inputCls}
                />
                {cloudinaryEnabled && (
                  <>
                    <input
                      ref={venueFileRef}
                      type="file"
                      accept={ALLOWED_IMAGE_ACCEPT}
                      className="hidden"
                      onChange={(e) => uploadVenue(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => venueFileRef.current?.click()}
                      disabled={uploading !== null}
                      className="shrink-0 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg px-4 text-sm font-medium transition-colors"
                    >
                      {uploading === "venue" ? "Uploading…" : "Upload"}
                    </button>
                  </>
                )}
              </div>
              {venueImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={venueImageUrl}
                  alt="Venue preview"
                  className="mt-2 h-24 rounded-lg object-cover border border-slate-200"
                />
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold">FAQs</h2>
            <button
              type="button"
              onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
              className="ml-auto text-sm text-[#1d4ed8] hover:underline"
            >
              + Add FAQ
            </button>
          </div>
          {faqs.length === 0 ? (
            <p className="text-sm text-slate-500">No FAQs yet.</p>
          ) : (
            <p className="text-xs text-slate-400">
              Both question and answer are required to save a FAQ — rows missing either are silently
              dropped on save.
            </p>
          )}
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
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
                  className="inline-flex items-center text-slate-500 hover:text-red-700 px-1"
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
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
            <input
              id="published"
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 accent-[#1d4ed8]"
            />
            <label htmlFor="published" className="text-sm">
              <span className="font-medium">Published</span>
              <span className="text-slate-500"> — visible on the site and open for booking</span>
            </label>
          </div>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4">
            <input
              id="featured"
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 accent-[#1d4ed8]"
            />
            <label htmlFor="featured" className="text-sm">
              <span className="font-medium">Featured</span>
              <span className="text-slate-500">
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
            className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white disabled:opacity-40 rounded-lg px-6 py-2.5 font-semibold text-sm transition-colors"
          >
            {busy ? "Saving…" : event ? "Save changes" : "Create event"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          {event && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="ml-auto text-sm text-red-700 hover:text-red-700 disabled:opacity-40"
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
  return <label className="block text-xs text-slate-500 mb-1.5">{children}</label>;
}
