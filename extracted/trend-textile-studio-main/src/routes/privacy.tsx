import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

// 🔴 Required for Google Play submission (and basic legal compliance,
// since this app collects payment info and account data via Stripe +
// Supabase). This is a solid, real starting point — have an actual lawyer
// review it before publishing, especially the data-sharing and children's
// privacy sections, since requirements vary by country.

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-black text-white mb-2">{title}</h2>
      <div className="text-sm text-white/70 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-xs text-cyan-300 hover:underline">← الرجوع للتطبيق</Link>
        <div className="flex items-center gap-2 mt-4 mb-8">
          <ShieldCheck className="text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          <h1 className="text-2xl font-black">سياسة الخصوصية — MODELZON</h1>
        </div>
        <p className="text-xs text-white/40 mb-8">آخر تحديث: {new Date().toLocaleDateString("ar-SA")}</p>

        <Section title="١. مين نحن وما اللي نجمعه">
          <p>MODELZON تطبيق لتصميم الملابس ثلاثية الأبعاد ومنافسات إبداعية. لما تستخدم التطبيق نجمع:</p>
          <ul className="list-disc pr-5 space-y-1">
            <li>بيانات الحساب: البريد الإلكتروني، اسم المستخدم، كلمة المرور (مشفّرة عبر Supabase Auth).</li>
            <li>بيانات الاستخدام: التصاميم اللي تحفظها، نتائج المعارك، مستواك ونقاطك.</li>
            <li>بيانات الدفع: تُعالج بالكامل عبر Stripe و/أو Google Play Billing — نحن لا نخزّن رقم بطاقتك أبداً على خوادمنا.</li>
            <li>عنوان الشحن: لو اشتريت تصميم فعلي من السوق، نجمع الاسم والعنوان ورقم الجوال لغرض التوصيل فقط.</li>
          </ul>
        </Section>

        <Section title="٢. كيف نستخدم بياناتك">
          <ul className="list-disc pr-5 space-y-1">
            <li>تشغيل حسابك وحفظ تصاميمك وتقدّمك.</li>
            <li>معالجة المدفوعات والاشتراكات وطلبات الشراء.</li>
            <li>تقييم تصاميمك بالذكاء الاصطناعي (Gemini عبر Lovable AI Gateway) — الصورة والوصف اللي ترفعه بالمعركة يُرسلان لمزوّد الذكاء الاصطناعي لغرض التقييم فقط.</li>
            <li>مراجعة البلاغات ضد محتوى مخالف أو مستخدمين مسيئين.</li>
          </ul>
        </Section>

        <Section title="٣. مشاركة البيانات مع أطراف ثالثة">
          <p>نشارك بيانات محدودة مع:</p>
          <ul className="list-disc pr-5 space-y-1">
            <li><strong>Supabase</strong> — استضافة قاعدة البيانات والمصادقة.</li>
            <li><strong>Stripe</strong> — معالجة المدفوعات والاشتراكات (ويب) وتحويلات البائعين.</li>
            <li><strong>RevenueCat / Google Play Billing</strong> — معالجة الاشتراكات داخل تطبيق أندرويد.</li>
            <li><strong>Lovable AI Gateway (Google Gemini)</strong> — تقييم التصاميم بالذكاء الاصطناعي.</li>
          </ul>
          <p>ما نبيع بياناتك لأي جهة إعلانية.</p>
        </Section>

        <Section title="٤. حقوقك">
          <p>تقدر تطلب حذف حسابك وكل بياناتك بالتواصل معنا. حذف الحساب يحذف تصاميمك المحفوظة وملفك الشخصي، ويُبقي فقط سجلات الطلبات المطلوبة قانونياً لأغراض محاسبية.</p>
        </Section>

        <Section title="٥. الأطفال">
          <p>التطبيق غير موجّه لمن هم دون 13 سنة، ولا نجمع بياناتهم عمداً. لو اكتشفنا حساب لطفل دون هذا العمر، بنحذفه.</p>
        </Section>

        <Section title="٦. أمان البيانات">
          <p>نستخدم صلاحيات على مستوى الصف (Row Level Security) بقاعدة البيانات بحيث ما يقدر مستخدم يشوف أو يعدّل بيانات مستخدم ثاني، ومفاتيح الدفع السرية لا تصل للمتصفح أبداً.</p>
        </Section>

        <Section title="٧. تواصل معنا">
          <p>لأي استفسار حول الخصوصية، راسلنا على البريد الموجود بصفحة "من نحن" داخل التطبيق.</p>
        </Section>
      </div>
    </div>
  );
}
