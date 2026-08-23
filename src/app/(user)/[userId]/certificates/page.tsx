"use client";

import { CertificatesPanel } from "@/components/user/certificates-panel";
import { VerifyCertificateForm } from "@/components/user/verify-certificate-form";

export default function CertificatesPage() {
  return (
    <div className="space-y-8">
      <CertificatesPanel />
      <VerifyCertificateForm />
    </div>
  );
}
