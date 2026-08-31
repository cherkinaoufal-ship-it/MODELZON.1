import type { Lang } from "@/lib/i18n";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Truck } from "lucide-react";

export type ShippingAddress = {
  fullName: string;
  phone: string;
  country: string;
  city: string;
  addressLine: string;
  postalCode: string;
};

interface Props {
  open: boolean;
  lang: Lang;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (address: ShippingAddress) => void;
}

/**
 * Collects a real shipping address before checkout. Previously "Buy" went
 * straight to Stripe with nothing recorded about where the physical item
 * should ship — this is what the order.shipping_* columns (see
 * 010_shipping.sql) actually get filled from.
 */
export default function ShippingAddressDialog({ open, lang, busy, onCancel, onConfirm }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [address, setAddress] = useState<ShippingAddress>({
    fullName: "",
    phone: "",
    country: "",
    city: "",
    addressLine: "",
    postalCode: "",
  });

  const set = (k: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [k]: e.target.value }));

  const valid = address.fullName.trim() && address.phone.trim() && address.country.trim() && address.city.trim() && address.addressLine.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="border-primary/20 bg-card/95 backdrop-blur-md sm:max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
            {t("Shipping address", "عنوان الشحن")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ship-name">{t("Full name", "الاسم الكامل")}</Label>
            <Input id="ship-name" value={address.fullName} onChange={set("fullName")} placeholder={t("Jane Doe", "محمد أحمد")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ship-phone">{t("Phone", "رقم الجوال")}</Label>
            <Input id="ship-phone" value={address.phone} onChange={set("phone")} placeholder="+966 5xxxxxxxx" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ship-country">{t("Country", "الدولة")}</Label>
              <Input id="ship-country" value={address.country} onChange={set("country")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ship-city">{t("City", "المدينة")}</Label>
              <Input id="ship-city" value={address.city} onChange={set("city")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ship-address">{t("Street address", "العنوان التفصيلي")}</Label>
            <Input id="ship-address" value={address.addressLine} onChange={set("addressLine")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ship-postal">{t("Postal code (optional)", "الرمز البريدي (اختياري)")}</Label>
            <Input id="ship-postal" value={address.postalCode} onChange={set("postalCode")} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t("Cancel", "إلغاء")}
          </Button>
          <Button
            disabled={!valid || busy}
            className="bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.5)] hover:bg-primary/90"
            onClick={() => onConfirm(address)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Continue to payment", "متابعة للدفع")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
