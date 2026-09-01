import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Factory, User, Ruler, MapPin } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import type { ProductionMeasurements } from "@/lib/production";

interface Props {
  open: boolean;
  lang: Lang;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (measurements: ProductionMeasurements) => void;
}

const SIZES = ["S", "M", "L", "XL", "XXL", "Custom"];

/**
 * The actual details a print/sewing partner needs to contact the buyer and
 * cut AND deliver a real garment — three clearly separated frames (who to
 * contact, where to deliver, what to make), and a single confirm button at
 * the end. Previously this had no delivery address fields at all (just
 * country + phone), which meant a real courier had no way to find the
 * person — see requestProduction in production.ts.
 */
export default function ProductionRequestDialog({ open, lang, busy, onCancel, onConfirm }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [garmentSize, setGarmentSize] = useState("M");
  const [fabricPreference, setFabricPreference] = useState("");
  const [note, setNote] = useState("");

  const valid = firstName.trim() && lastName.trim() && phone.trim() && country.trim() && city.trim() && streetAddress.trim() && heightCm.trim() && chestCm.trim();

  const submit = () => {
    onConfirm({
      firstName, lastName, phone, country,
      city, district, streetAddress, landmark, postalCode,
      heightCm: Number(heightCm) || null,
      chestCm: Number(chestCm) || null,
      garmentSize,
      fabricPreference,
      note,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="border-cyan-400/20 bg-black/95 backdrop-blur-md sm:max-w-md max-h-[85vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-cyan-300" />
            {t("Request real-life production", "اطلب تصنيعه بالحقيقة")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-[11px] text-white/40 -mt-2">
          {t(
            "This sends a request for a human to follow up with pricing and timeline — it doesn't charge you automatically.",
            "هذا يرسل طلب لفريقنا يتواصل معك بالسعر والمدة — ما يخصم منك أي مبلغ تلقائياً.",
          )}
        </p>

        {/* Frame 1 — who to contact */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-200">
            <User size={13} /> {t("Your details", "بياناتك")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-first">{t("First name", "الاسم")}</Label>
              <Input id="prod-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-last">{t("Last name", "اللقب")}</Label>
              <Input id="prod-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-phone">{t("Phone / WhatsApp", "رقم الجوال")}</Label>
              <Input id="prod-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 5xxxxxxxx" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-country">{t("Country", "الدولة")}</Label>
              <Input id="prod-country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Frame 2 — delivery address (this is what was missing before: a
            courier previously had NO way to find the person, just a
            country + phone number). */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-200">
            <MapPin size={13} /> {t("Delivery address", "عنوان التوصيل")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-city">{t("City", "المدينة")}</Label>
              <Input id="prod-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-district">{t("District / area", "الحي")}</Label>
              <Input id="prod-district" value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="prod-street">{t("Street address / building", "الشارع ورقم المبنى")}</Label>
            <Input id="prod-street" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-landmark">{t("Nearest landmark (optional)", "أقرب معلم (اختياري)")}</Label>
              <Input id="prod-landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder={t("e.g. behind the mosque", "مثال: خلف المسجد")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-postal">{t("Postal code (optional)", "الرمز البريدي (اختياري)")}</Label>
              <Input id="prod-postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Frame 3 — what to make */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-200">
            <Ruler size={13} /> {t("Measurements & fabric", "المقاسات والقماش")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prod-height">{t("Height (cm)", "الطول (سم)")}</Label>
              <Input id="prod-height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-chest">{t("Chest width (cm)", "عرض الصدر (سم)")}</Label>
              <Input id="prod-chest" type="number" value={chestCm} onChange={(e) => setChestCm(e.target.value)} placeholder="100" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("Size", "المقاس")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setGarmentSize(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${garmentSize === s ? "bg-cyan-500/25 border-cyan-400 text-cyan-100" : "bg-white/5 border-white/10 text-white/60"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="prod-fabric">{t("Fabric preference (optional)", "نوع القماش المفضّل (اختياري)")}</Label>
            <Input id="prod-fabric" value={fabricPreference} onChange={(e) => setFabricPreference(e.target.value)} placeholder={t("e.g. heavy cotton, fleece", "مثال: قطن ثقيل، فليس")} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="prod-note">{t("Anything else? (optional)", "أي شي ثاني؟ (اختياري)")}</Label>
            <Input id="prod-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{t("Cancel", "إلغاء")}</Button>
          <Button
            disabled={!valid || busy}
            className="bg-cyan-500 text-black hover:bg-cyan-400"
            onClick={submit}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Confirm request", "تأكيد الطلب")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
