"use client";

import { CertificatesPanel } from "@/components/user/certificates-panel";
import { PageHeader } from "@/components/user/page-header";
import { useI18n } from "@/i18n";

export default function CertificatesPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.nav.certificates}
        title={t.nav.certificates}
        subtitle="View, download, and verify your earned credentials."
      />
      <CertificatesPanel />
    </div>
  );
}