import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";

// 🔴 Required for Google Play submission. Real starting point — have a
// lawyer review before publishing, especially the marketplace/commission
// and refund sections, since those carry real financial/legal weight.

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-black text-white mb-2">{title}</h2>
      <div className="text-sm text-white/70 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-10" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-xs text-cyan-300 hover:underline">← الرجوع للتطبيق</Link>
        <div className="flex items-center gap-2 mt-4 mb-8">
          <FileText className="text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          <h1 className="text-2xl font-black">شروط الاستخدام — MODELZON</h1>
        </div>
        <p className="text-xs text-white/40 mb-8">آخر تحديث: {new Date().toLocaleDateString("ar-SA")}</p>

        <Section title="١. قبولك للشروط">
          <p>باستخدامك MODELZON فأنت توافق على هذي الشروط. لو ما توافق، الرجاء عدم استخدام التطبيق.</p>
        </Section>

        <Section title="٢. الحسابات">
          <ul className="list-disc pr-5 space-y-1">
            <li>أنت مسؤول عن سرية بيانات دخولك وكل نشاط يصير على حسابك.</li>
            <li>ممنوع إنشاء أكثر من حساب لغرض التحايل على قيود المستوى أو الاشتراك.</li>
          </ul>
        </Section>

        <Section title="٣. المحتوى الذي تنشئه">
          <ul className="list-disc pr-5 space-y-1">
            <li>تبقى مالك حقوق التصاميم اللي تصممها، وتمنحنا ترخيص لعرضها داخل التطبيق (المعارك، السوق، لوحة الصدارة).</li>
            <li>ممنوع رفع محتوى جنسي، عنيف، مسيء، أو منتهك لحقوق ملكية طرف ثالث. مخالفة هذا البند قد تؤدي لإخفاء المحتوى أو حظر الحساب — راجع نظام الإبلاغ داخل التطبيق.</li>
            <li>نراجع البلاغات ونتخذ إجراء (إخفاء محتوى أو حظر حساب) حسب تقديرنا.</li>
          </ul>
        </Section>

        <Section title="٤. الاشتراكات">
          <ul className="list-disc pr-5 space-y-1">
            <li>الاشتراك شهري ويتجدد تلقائياً حتى تلغيه.</li>
            <li>على الويب: يُدار عبر Stripe (يمكنك الإلغاء من "إدارة الاشتراك").</li>
            <li>على أندرويد: يُدار عبر Google Play Billing، ويخضع لسياسات وشروط استرجاع Google Play.</li>
          </ul>
        </Section>

        <Section title="٥. السوق والبيع">
          <ul className="list-disc pr-5 space-y-1">
            <li>يحق للمستخدمين من مستوى 50 فأعلى (أو مشتركي Elite) عرض تصاميمهم للبيع.</li>
            <li>تُخصم عمولة منصة 15% من كل عملية بيع، عدا مشتركي Elite (بدون عمولة).</li>
            <li>يجب على البائع ربط حساب استلام أرباح (Stripe Connect) لاستلام مستحقاته.</li>
            <li>المشتري مسؤول عن دقة عنوان الشحن المُدخل عند الشراء.</li>
          </ul>
        </Section>

        <Section title="٦. إخلاء مسؤولية">
          <p>التطبيق يُقدَّم "كما هو" دون أي ضمانات. تقييم الذكاء الاصطناعي للتصاميم هو رأي آلي وليس حكماً نهائياً أو مهنياً.</p>
        </Section>

        <Section title="٧. إنهاء الحساب">
          <p>يحق لنا تعليق أو إنهاء أي حساب يخالف هذي الشروط، وخصوصاً بعد بلاغات مؤكدة أو نشاط مسيء متكرر.</p>
        </Section>

        <Section title="٨. التواصل">
          <p>لأي استفسار حول هذي الشروط، راسلنا على البريد الموجود بصفحة "من نحن" داخل التطبيق.</p>
        </Section>
      </div>
    </div>
  );
}
