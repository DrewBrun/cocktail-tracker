// src/features/admin/AdminGate.tsx
import { useEffect, useState } from "react";

const ADMIN_PIN_KEY = "ct.admin.pin";
const ADMIN_ENABLED_KEY = "ct.admin.enabled";

export function setAdminEnabled(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(ADMIN_ENABLED_KEY, "1");
  } else {
    localStorage.removeItem(ADMIN_ENABLED_KEY);
  }
}

export function isAdminEnabled(): boolean {
  return localStorage.getItem(ADMIN_ENABLED_KEY) === "1";
}

type AdminGateProps = {
  children: React.ReactNode;
  // Change this to your preferred secret
  expectedPin?: string; // default "mixologist"
};

export default function AdminGate({ children, expectedPin = "mixologist" }: AdminGateProps) {
  const [ok, setOk] = useState<boolean>(isAdminEnabled());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        // quick enable/disable with a prompt
        if (isAdminEnabled()) {
          setAdminEnabled(false);
          setOk(false);
          return;
        }
        const pin = window.prompt("Enter admin PIN:");
        if (pin && pin === expectedPin) {
          localStorage.setItem(ADMIN_PIN_KEY, pin);
          setAdminEnabled(true);
          setOk(true);
        } else if (pin !== null) {
          alert("Wrong PIN.");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expectedPin]);

  // Also allow enabling via query string ?admin=1&pin=YOURPIN (handy while developing)
  useEffect(() => {
    const url = new URL(window.location.href);
    const want = url.searchParams.get("admin");
    const pin = url.searchParams.get("pin");
    if (want === "1" && pin && pin === expectedPin) {
      localStorage.setItem(ADMIN_PIN_KEY, pin);
      setAdminEnabled(true);
      setOk(true);
      // clean the URL
      url.searchParams.delete("admin");
      url.searchParams.delete("pin");
      window.history.replaceState({}, "", url.toString());
    }
  }, [expectedPin]);

  if (!ok) {
    // Don’t leak that an admin page exists—just show a very plain 404-ish message.
    return (
      <div className="p-6 text-sm text-gray-500">
        Not found.
      </div>
    );
  }
  return <>{children}</>;
}
