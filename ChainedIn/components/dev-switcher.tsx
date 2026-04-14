"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

const DEV_USERS = [
  { email: "admin@chainedin.dev",       label: "Admin",            type: "ADMIN"   },
  { email: "acme@chainedin.dev",        label: "ACME Corp",        type: "COMPANY" },
  { email: "securecorp@chainedin.dev",  label: "SecureCorp",       type: "COMPANY" },
  { email: "cloudnative@chainedin.dev", label: "CloudNative Sys.", type: "COMPANY" },
  { email: "dataflow@chainedin.dev",    label: "DataFlow Inc",     type: "COMPANY" },
  { email: "rustlabs@chainedin.dev",    label: "RustLabs",         type: "COMPANY" },
  { email: "openauth@chainedin.dev",    label: "OpenAuth Found.",  type: "COMPANY" },
  { email: "alice@chainedin.dev",       label: "Alice Chen",       type: "PERSON"  },
  { email: "bob@chainedin.dev",         label: "Bob Torres",       type: "PERSON"  },
  { email: "carlos@chainedin.dev",      label: "Carlos Mendes",    type: "PERSON"  },
  { email: "diana@chainedin.dev",       label: "Diana Kos",        type: "PERSON"  },
  { email: "emeka@chainedin.dev",       label: "Emeka Osei",       type: "PERSON"  },
  { email: "fatima@chainedin.dev",      label: "Fatima Al-Rashid", type: "PERSON"  },
  { email: "george@chainedin.dev",      label: "George Papado.",   type: "PERSON"  },
  { email: "hana@chainedin.dev",        label: "Hana Novak",       type: "PERSON"  },
];

export function DevSwitcher({ currentEmail }: { currentEmail?: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function switchTo(email: string) {
    setLoading(email);
    await signIn("credentials", {
      email,
      password: "password123",
      redirect: false,
    });
    setLoading(null);
    setOpen(false);
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 rounded-lg border bg-background shadow-lg p-3 w-52">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Zap className="h-3 w-3" /> Dev switcher
          </p>
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {DEV_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => switchTo(u.email)}
                disabled={loading === u.email || currentEmail === u.email}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent disabled:opacity-50 transition-colors"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    currentEmail === u.email ? "bg-green-500" : "bg-muted"
                  }`}
                />
                <span className="flex-1">{u.label}</span>
                {loading === u.email && (
                  <span className="text-xs text-muted-foreground">...</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border bg-yellow-50 border-yellow-200 px-3 py-1.5 text-xs font-semibold text-yellow-800 shadow-md hover:bg-yellow-100 transition-colors"
      >
        <Zap className="h-3.5 w-3.5" />
        Dev mode
      </button>
    </div>
  );
}
