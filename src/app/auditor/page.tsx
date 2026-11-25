import React, { Suspense } from "react";
import { StoreDoctorApp } from "@/components/StoreDoctorApp";

export default function AuditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[15px] text-[var(--sd-ink-muted)]">
          Loading StoreDoctor diagnostic console...
        </div>
      }
    >
      <StoreDoctorApp />
    </Suspense>
  );
}
