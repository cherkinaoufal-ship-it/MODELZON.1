import type { Lang } from "@/lib/i18n";
import { KeyRound, Bot, Truck, Save, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  lang: Lang;
}

const STORAGE = "modelzon_api_keys_v1";

export default function ApiKeysPanel({ lang }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [aiKey, setAiKey] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("https://api.openai.com/v1");
  const [aiModel, setAiModel] = useState("gpt-image-1");
  const [supplierKey, setSupplierKey] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [showSup, setShowSup] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const j = JSON.parse(raw);
        setAiKey(j.aiKey ?? "");
        setAiBaseUrl(j.aiBaseUrl ?? "https://api.openai.com/v1");
        setAiModel(j.aiModel ?? "gpt-image-1");
        setSupplierKey(j.supplierKey ?? "");
        setSupplierUrl(j.supplierUrl ?? "");
      }
    } catch {}
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE, JSON.stringify({ aiKey, aiBaseUrl, aiModel, supplierKey, supplierUrl }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const field = (
    icon: any,
    label: string,
    value: string,
    setValue: (v: string) => void,
    show: boolean,
    setShow: (b: boolean) => void,
    placeholder: string,
  ) => {
    const Icon = icon;
    return (
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs font-bold text-white/70">
          <Icon size={13} /> {label}
        </label>
        <div className="flex gap-2">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-400/60 placeholder:text-white/25"
          />
          <button
            onClick={() => setShow(!show)}
            className="px-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white"
          >
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-cyan-500/5 to-fuchsia-500/5 border border-white/10 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-cyan-300" />
        <div>
          <div className="text-sm font-black">{t("API Keys", "مفاتيح API")}</div>
          <div className="text-[10px] text-white/50">
            {t("Stored securely on this device only", "تُحفظ محلياً على جهازك فقط")}
          </div>
        </div>
      </div>

      {field(
        Bot,
        t("AI Design Provider Key", "مفتاح مزود الذكاء الاصطناعي"),
        aiKey,
        setAiKey,
        showAi,
        setShowAi,
        "sk-... (OpenAI / any OpenAI-compatible image API)",
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-bold text-white/70">
            <Bot size={13} /> {t("Base URL", "رابط الـ API")}
          </label>
          <input
            value={aiBaseUrl}
            onChange={(e) => setAiBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-400/60 placeholder:text-white/25"
          />
        </div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-bold text-white/70">
            <Bot size={13} /> {t("Image model", "موديل الصور")}
          </label>
          <input
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="gpt-image-1"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-400/60 placeholder:text-white/25"
          />
        </div>
      </div>
      {field(
        Truck,
        t("Supplier API Key", "مفتاح المورد"),
        supplierKey,
        setSupplierKey,
        showSup,
        setShowSup,
        "supplier_...",
      )}

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs font-bold text-white/70">
          <Truck size={13} /> {t("Supplier Endpoint URL", "رابط المورد")}
        </label>
        <input
          value={supplierUrl}
          onChange={(e) => setSupplierUrl(e.target.value)}
          placeholder="https://api.supplier.com/orders"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-400/60 placeholder:text-white/25"
        />
      </div>

      <button
        onClick={save}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
      >
        <Save size={14} /> {saved ? t("Saved ✓", "تم الحفظ ✓") : t("Save Keys", "حفظ المفاتيح")}
      </button>

      <p className="text-[10px] text-white/40 leading-relaxed">
        {t(
          "Your keys never leave this device. The built-in AI Stylist uses MODELZON's managed gateway; these are for connecting your own accounts and shipping designs to your supplier for production.",
          "مفاتيحك لا تغادر جهازك. المصمم الذكي المدمج يستخدم بوابة MODELZON؛ هذه المفاتيح لربط حساباتك الخاصة وإرسال التصاميم للمورد للإنتاج.",
        )}
      </p>
    </div>
  );
}
