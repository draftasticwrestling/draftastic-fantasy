"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { slugifyWrestlerName } from "@/lib/boxscoreAdmin/wrestlerSlug";

export type WrestlerFormRow = {
  id: string;
  name: string;
  nickname?: string | null;
  brand?: string | null;
  classification?: string | null;
  person_type?: string | null;
  status?: string | null;
  Status?: string | null;
  gender?: string | null;
  dob?: string | null;
  nationality?: string | null;
  billed_from?: string | null;
  height?: string | null;
  weight?: string | null;
  image_url?: string | null;
  full_body_image_url?: string | null;
  accomplishments?: string | null;
  tag_team_name?: string | null;
  tag_team_partner_slug?: string | null;
  stable?: string | null;
  is_stable_leader?: boolean | null;
};

const CLASSIFICATIONS = ["Active", "Part-timer", "Celebrity Guests", "Alumni", "Non-wrestlers", "Inactive"] as const;
const PERSON_TYPES = ["Wrestler", "Head of Creative", "GM", "Manager", "Announcer"] as const;
const ROSTER_BRANDS = ["RAW", "SmackDown", "NXT", "AAA", "Unassigned", "N/A"] as const;
const GENDERS = ["male", "female", "other"] as const;

function rowStatus(w: WrestlerFormRow): string {
  return String(w.status ?? w.Status ?? "");
}

function initFromWrestler(w?: WrestlerFormRow) {
  return {
    name: w?.name ?? "",
    slug: w?.id ?? "",
    nickname: w?.nickname ?? "",
    classification: w?.classification ?? "Active",
    personType: w?.person_type ?? "Wrestler",
    brand: w?.brand && w.brand !== "" ? w.brand : "RAW",
    status: rowStatus(w ?? { id: "", name: "" }),
    gender: w?.gender ?? "",
    dob: w?.dob?.slice(0, 10) ?? "",
    nationality: w?.nationality ?? "",
    billedFrom: w?.billed_from ?? "",
    height: w?.height ?? "",
    weight: w?.weight ?? "",
    accomplishments: w?.accomplishments ?? "",
    tagTeamName: w?.tag_team_name ?? "",
    partnerSlug: w?.tag_team_partner_slug ?? "",
    stable: w?.stable ?? "",
    isStableLeader: Boolean(w?.is_stable_leader),
    headshotPreview: w?.image_url ?? null,
    fullBodyPreview: w?.full_body_image_url ?? null,
  };
}

type Props = {
  mode: "create" | "edit";
  wrestler?: WrestlerFormRow;
  allWrestlers: { id: string; name: string }[];
  tagTeamNames: string[];
  stableNames: string[];
};

export function WrestlerForm({ mode, wrestler, allWrestlers, tagTeamNames, stableNames }: Props) {
  const isEdit = mode === "edit";
  const initial = initFromWrestler(wrestler);

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugManual, setSlugManual] = useState(isEdit);
  const [nickname, setNickname] = useState(initial.nickname);
  const [classification, setClassification] = useState(initial.classification);
  const [personType, setPersonType] = useState(initial.personType);
  const [brand, setBrand] = useState(initial.brand);
  const [status, setStatus] = useState(initial.status);
  const [gender, setGender] = useState(initial.gender);
  const [dob, setDob] = useState(initial.dob);
  const [nationality, setNationality] = useState(initial.nationality);
  const [billedFrom, setBilledFrom] = useState(initial.billedFrom);
  const [height, setHeight] = useState(initial.height);
  const [weight, setWeight] = useState(initial.weight);
  const [accomplishments, setAccomplishments] = useState(initial.accomplishments);
  const [tagTeamName, setTagTeamName] = useState(initial.tagTeamName);
  const [partnerSlug, setPartnerSlug] = useState(initial.partnerSlug);
  const [stable, setStable] = useState(initial.stable);
  const [isStableLeader, setIsStableLeader] = useState(initial.isStableLeader);

  const [partnerSearch, setPartnerSearch] = useState("");
  const [showPartnerList, setShowPartnerList] = useState(false);
  const [showTagTeamList, setShowTagTeamList] = useState(false);
  const [showStableList, setShowStableList] = useState(false);

  const [removeHeadshot, setRemoveHeadshot] = useState(false);
  const [removeFullBody, setRemoveFullBody] = useState(false);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(initial.headshotPreview);
  const [fullBodyPreview, setFullBodyPreview] = useState<string | null>(initial.fullBodyPreview);

  const partnerRef = useRef<HTMLDivElement>(null);
  const tagTeamRef = useRef<HTMLDivElement>(null);
  const stableRef = useRef<HTMLDivElement>(null);

  const showBrandStatus = classification === "Active" || classification === "Part-timer";
  const showWrestlerOnly = personType === "Wrestler";
  const showFullBodyImage = isEdit || showWrestlerOnly;

  const persistedFullBodyUrl = removeFullBody
    ? ""
    : fullBodyPreview && !fullBodyPreview.startsWith("blob:")
      ? fullBodyPreview
      : (wrestler?.full_body_image_url ?? "");
  const noBrandStatus =
    classification === "Alumni" ||
    classification === "Celebrity Guests" ||
    classification === "Non-wrestlers" ||
    classification === "Inactive";

  useEffect(() => {
    if (!isEdit && !slugManual && name.trim()) {
      setSlug(slugifyWrestlerName(name));
    }
  }, [name, slugManual, isEdit]);

  useEffect(() => {
    if (isEdit && wrestler?.tag_team_partner_slug) {
      const partner = allWrestlers.find((w) => w.id === wrestler.tag_team_partner_slug);
      setPartnerSearch(partner?.name ?? "");
    } else if (!partnerSlug) {
      setPartnerSearch("");
    }
  }, [isEdit, wrestler?.tag_team_partner_slug, partnerSlug, allWrestlers]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (partnerRef.current && !partnerRef.current.contains(t)) setShowPartnerList(false);
      if (tagTeamRef.current && !tagTeamRef.current.contains(t)) setShowTagTeamList(false);
      if (stableRef.current && !stableRef.current.contains(t)) setShowStableList(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const setClassificationValue = (value: string) => {
    setClassification(value);
    if (value === "Alumni" || value === "Celebrity Guests" || value === "Non-wrestlers" || value === "Inactive") {
      setBrand("");
      setStatus("");
    } else if (value === "Active" || value === "Part-timer") {
      if (!brand || brand === "") setBrand("RAW");
    }
  };

  const filteredPartners = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase();
    const pool = allWrestlers.filter((w) => w.id !== (isEdit ? wrestler?.id : slug));
    if (!q) return [];
    return pool.filter((w) => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q)).slice(0, 10);
  }, [partnerSearch, allWrestlers, isEdit, wrestler?.id, slug]);

  const filteredTagTeams = useMemo(() => {
    const q = tagTeamName.trim().toLowerCase();
    if (!q) return tagTeamNames.slice(0, 10);
    return tagTeamNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 10);
  }, [tagTeamName, tagTeamNames]);

  const filteredStables = useMemo(() => {
    const q = stable.trim().toLowerCase();
    if (!q) return stableNames.slice(0, 10);
    return stableNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 10);
  }, [stable, stableNames]);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 560 }}>
      {isEdit && wrestler ? <input type="hidden" name="original_id" value={wrestler.id} /> : null}
      <input type="hidden" name="remove_headshot" value={removeHeadshot ? "1" : "0"} />
      <input type="hidden" name="remove_full_body" value={removeFullBody ? "1" : "0"} />
      <input type="hidden" name="tag_team_partner_slug" value={partnerSlug} />
      <input type="hidden" name="classification" value={classification} />
      <input type="hidden" name="brand" value={showBrandStatus ? brand : ""} />
      <input type="hidden" name="status" value={showBrandStatus ? status : ""} />
      <input type="hidden" name="gender" value={showWrestlerOnly ? gender : ""} />
      <input type="hidden" name="is_stable_leader" value={isStableLeader ? "on" : ""} />

      {isEdit ? (
        <Field label="Name:">
          <input type="text" value={wrestler?.name ?? ""} readOnly style={{ ...inputStyle, opacity: 0.85, cursor: "not-allowed" }} />
          <input type="hidden" name="name" value={wrestler?.name ?? ""} />
        </Field>
      ) : (
        <Field label="Name: *">
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
        </Field>
      )}

      <Field label="Slug (URL identifier):" hint="Used as this wrestler's ID in URLs and data. Changing it may affect existing links and references.">
        <input
          name="id"
          value={slug}
          onChange={(e) => {
            setSlugManual(true);
            setSlug(e.target.value);
          }}
          required
          pattern="[a-z0-9-]+"
          placeholder="e.g., becky-lynch"
          style={inputStyle}
        />
      </Field>

      <Field label="Nickname:" hint="Displayed under the wrestler's name on their profile.">
        <input name="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g., The Man" style={inputStyle} />
      </Field>

      <Field label={showWrestlerOnly ? "Gender: *" : "Gender:"}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {GENDERS.map((v) => (
            <TogglePill key={v} active={gender === v} onClick={() => setGender(gender === v ? "" : v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </TogglePill>
          ))}
          <TogglePill active={!gender} onClick={() => setGender("")} muted>
            Clear
          </TogglePill>
        </div>
      </Field>

      <Field label="Type:" hint="Wrestler = full profile. GM / Manager / Announcer = simplified profile.">
        <select name="person_type" value={personType} onChange={(e) => setPersonType(e.target.value)} style={inputStyle}>
          {PERSON_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Classification:" hint="Active / Part-timer = on a roster (RAW, SmackDown, NXT, AAA). Alumni / Celebrity Guests / Non-wrestlers / Inactive = no brand or status.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CLASSIFICATIONS.map((v) => (
            <TogglePill key={v} active={classification === v} onClick={() => setClassificationValue(v)}>
              {v}
            </TogglePill>
          ))}
        </div>
      </Field>

      {showBrandStatus ? (
        <Field label="Brand / Roster:" hint="Tap to quickly move this wrestler between rosters. Active and Part-timer wrestlers should have a brand.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ROSTER_BRANDS.map((v) => (
              <TogglePill key={v} active={brand === v || (v === "Unassigned" && !brand)} onClick={() => setBrand(v === "Unassigned" ? "" : v)}>
                {v}
              </TogglePill>
            ))}
          </div>
        </Field>
      ) : null}

      {showBrandStatus ? (
        <Field label="Health & Availability:" hint="Only Active and Part-timer wrestlers can have a status.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <TogglePill active={!status} onClick={() => setStatus("")}>
              Active
            </TogglePill>
            <TogglePill active={status === "Injured"} onClick={() => setStatus("Injured")}>
              Injured
            </TogglePill>
            <TogglePill active={status === "On Hiatus"} onClick={() => setStatus("On Hiatus")}>
              On Hiatus
            </TogglePill>
            <TogglePill active={status === "Inactive"} onClick={() => setStatus("Inactive")}>
              Inactive
            </TogglePill>
            <TogglePill active={status === "Non-wrestler"} onClick={() => setStatus("Non-wrestler")}>
              Non-wrestler
            </TogglePill>
          </div>
        </Field>
      ) : null}

      {noBrandStatus ? (
        <div style={{ padding: 10, borderRadius: 6, background: "var(--color-bg-elevated)", fontSize: 13, color: "var(--color-text-muted)" }}>
          {classification} profiles do not have brand assignments or status.
        </div>
      ) : null}

      {showWrestlerOnly ? (
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Height:" style={{ flex: 1 }}>
            <input name="height" value={height} onChange={(e) => setHeight(e.target.value)} placeholder={`5'6"`} style={inputStyle} />
          </Field>
          <Field label="Weight:" style={{ flex: 1 }}>
            <input name="weight" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="135 lbs" style={inputStyle} />
          </Field>
        </div>
      ) : null}

      <Field label="Date of Birth:" hint="Optional. Stores a simple date (YYYY-MM-DD) for this wrestler.">
        <input name="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Nationality:" hint="Optional. Country name; shown on the wrestler profile when set.">
        <input
          name="nationality"
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          placeholder="e.g., Ireland"
          style={inputStyle}
          list="wrestler-nationality-list"
        />
        <datalist id="wrestler-nationality-list">
          <option value="United States" />
          <option value="Ireland" />
          <option value="Mexico" />
          <option value="Canada" />
          <option value="United Kingdom" />
          <option value="Japan" />
          <option value="Australia" />
        </datalist>
      </Field>

      {showWrestlerOnly ? (
        <Field label="Billed From (Hometown):">
          <input
            name="billed_from"
            value={billedFrom}
            onChange={(e) => setBilledFrom(e.target.value)}
            placeholder="e.g., Dublin, Ireland"
            style={inputStyle}
          />
        </Field>
      ) : null}

      <Field label="Accomplishments:" hint="One accomplishment per line. Shown on the wrestler profile page.">
        <textarea
          name="accomplishments"
          value={accomplishments}
          onChange={(e) => setAccomplishments(e.target.value)}
          rows={4}
          placeholder={"Women's Triple Crown Champion\n7X Women's Champion"}
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
        />
      </Field>

      <ImageUploadField
        label="Wrestler Headshot:"
        preview={headshotPreview}
        removed={removeHeadshot}
        onRemove={() => {
          setHeadshotPreview(null);
          setRemoveHeadshot(true);
        }}
        onFile={(f) => {
          setRemoveHeadshot(false);
          setHeadshotPreview(URL.createObjectURL(f));
        }}
        fileName="headshot_file"
      />

      {showFullBodyImage ? (
        <>
          <input type="hidden" name="full_body_image_url" value={persistedFullBodyUrl} />
          <ImageUploadField
            label="Full-Body Image:"
            preview={fullBodyPreview}
            removed={removeFullBody}
            onRemove={() => {
              setFullBodyPreview(null);
              setRemoveFullBody(true);
            }}
            onFile={(f) => {
              setRemoveFullBody(false);
              setFullBodyPreview(URL.createObjectURL(f));
            }}
            fileName="full_body_file"
          />
        </>
      ) : null}

      <Field label="Tag Team Name:">
        <div ref={tagTeamRef} style={{ position: "relative" }}>
          <input
            name="tag_team_name"
            value={tagTeamName}
            onChange={(e) => {
              setTagTeamName(e.target.value);
              setShowTagTeamList(true);
            }}
            onFocus={() => setShowTagTeamList(true)}
            placeholder="Type to create or select an existing tag team..."
            style={inputStyle}
            autoComplete="off"
          />
          {showTagTeamList && filteredTagTeams.length > 0 ? (
            <AutocompleteList
              items={filteredTagTeams.map((n) => ({ key: n, label: n }))}
              onPick={(n) => {
                setTagTeamName(n);
                setShowTagTeamList(false);
              }}
            />
          ) : null}
        </div>
        <p style={hintStyle}>Leave empty if not in a tag team</p>
      </Field>

      <Field label="Tag Team Partner:">
        <div ref={partnerRef} style={{ position: "relative" }}>
          <input
            value={partnerSearch}
            onChange={(e) => {
              setPartnerSearch(e.target.value);
              if (!e.target.value) setPartnerSlug("");
              setShowPartnerList(true);
            }}
            onFocus={() => setShowPartnerList(true)}
            placeholder="Search for partner..."
            style={inputStyle}
            autoComplete="off"
          />
          {showPartnerList && partnerSearch.trim() ? (
            <AutocompleteList
              items={
                filteredPartners.length > 0
                  ? filteredPartners.map((w) => ({ key: w.id, label: w.name }))
                  : [{ key: "_none", label: "No wrestlers found" }]
              }
              onPick={(id) => {
                if (id === "_none") return;
                const w = allWrestlers.find((x) => x.id === id);
                if (w) {
                  setPartnerSlug(w.id);
                  setPartnerSearch(w.name);
                }
                setShowPartnerList(false);
              }}
            />
          ) : null}
        </div>
        <p style={hintStyle}>Leave empty if not in a tag team</p>
      </Field>

      <Field label="Stable/Affiliation:">
        <div ref={stableRef} style={{ position: "relative" }}>
          <input
            name="stable"
            value={stable}
            onChange={(e) => {
              setStable(e.target.value);
              setShowStableList(true);
            }}
            onFocus={() => setShowStableList(true)}
            placeholder="Type to create or select an existing stable..."
            style={inputStyle}
            autoComplete="off"
          />
          {showStableList && filteredStables.length > 0 ? (
            <AutocompleteList
              items={filteredStables.map((n) => ({ key: n, label: n }))}
              onPick={(n) => {
                setStable(n);
                setShowStableList(false);
              }}
            />
          ) : null}
        </div>
        <p style={hintStyle}>Leave empty if not in a stable</p>
      </Field>

      <details style={{ fontSize: 13 }}>
        <summary style={{ cursor: "pointer", color: "var(--color-text-muted)" }}>Advanced: image URLs</summary>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <label>
            Headshot URL
            <input name="image_url" defaultValue={wrestler?.image_url ?? ""} style={inputStyle} />
          </label>
        </div>
      </details>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 4, ...style }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint ? <p style={hintStyle}>{hint}</p> : null}
    </div>
  );
}

function ImageUploadField({
  label,
  preview,
  removed,
  onRemove,
  onFile,
  fileName,
}: {
  label: string;
  preview: string | null;
  removed: boolean;
  onRemove: () => void;
  onFile: (file: File) => void;
  fileName: string;
}) {
  return (
    <Field label={label}>
      {preview && !removed ? (
        <div style={{ marginBottom: 10, position: "relative", display: "inline-block" }}>
          <Image
            src={preview}
            alt=""
            width={label.includes("Full") ? 120 : 200}
            height={label.includes("Full") ? 180 : 200}
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              objectFit: "contain",
            }}
            unoptimized
          />
          <button type="button" onClick={onRemove} style={removeImageBtnStyle} aria-label="Remove image">
            ×
          </button>
        </div>
      ) : null}
      <input
        name={fileName}
        type="file"
        accept=".png,.webp,image/png,image/webp"
        style={inputStyle}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </Field>
  );
}

function AutocompleteList({
  items,
  onPick,
}: {
  items: { key: string; label: string }[];
  onPick: (key: string) => void;
}) {
  return (
    <ul style={dropdownStyle}>
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" style={dropdownBtnStyle} onClick={() => onPick(item.key)} disabled={item.key === "_none"}>
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function TogglePill({
  active,
  onClick,
  children,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--color-accent, #b8860b)" : "var(--color-border)"}`,
        background: active ? "var(--color-bg-elevated)" : "transparent",
        fontWeight: active ? 600 : 400,
        fontSize: 13,
        cursor: "pointer",
        opacity: muted && !active ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Quick-edit header shown above the form in edit mode. */
export function WrestlerQuickEditHeader({ wrestler }: { wrestler: WrestlerFormRow }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
      {wrestler.image_url && !wrestler.image_url.includes("placeholder") ? (
        <Image
          src={wrestler.image_url}
          alt=""
          width={64}
          height={64}
          style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid var(--color-accent, #b8860b)" }}
          unoptimized
        />
      ) : (
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--color-bg-elevated)",
            border: "2px solid var(--color-border)",
          }}
        />
      )}
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "var(--color-accent, #b8860b)" }}>{wrestler.name}</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          Quick-edit this wrestler&apos;s slug, roster, health, and status.
        </p>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = { display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 };
const hintStyle: CSSProperties = { margin: "4px 0 0", fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 };
const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  fontSize: 14,
};
const removeImageBtnStyle: CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  width: 24,
  height: 24,
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,0.75)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};
const dropdownStyle: CSSProperties = {
  listStyle: "none",
  margin: "4px 0 0",
  padding: 0,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "var(--color-bg-card)",
  maxHeight: 200,
  overflow: "auto",
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  zIndex: 10,
  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
};
const dropdownBtnStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
};
