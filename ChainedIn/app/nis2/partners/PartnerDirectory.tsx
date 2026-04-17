"use client";
import Link from "next/link";
import { ArrowLeft, Globe, Mail, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/sidebar";

export interface Partner {
  name: string;
  description: string;
  specialties: string[];
  website?: string;
  email?: string;
  phone?: string;
  location: string;
}

interface Props {
  title: string;
  subtitle: string;
  partners: Partner[];
}

export default function PartnerDirectory({ title, subtitle, partners }: Props) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/nis2" />
        <main className="flex-1 max-w-3xl">
          <div className="mb-6">
            <Link href="/nis2">
              <Button variant="ghost" size="sm" className="mb-3 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to assessment
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          </div>

          <div className="space-y-4">
            {partners.map((p) => (
              <Card key={p.name}>
                <CardContent className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-base">{p.name}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{p.location}</p>
                      <p className="text-sm mt-2">{p.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.specialties.map((s) => (
                          <span key={s} className="text-xs rounded-full px-2.5 py-0.5 font-medium border" style={{ backgroundColor: "#DAFFEF", color: "#00A63D", borderColor: "#00A63D" }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 text-right">
                      {p.website && (
                        <a href={p.website} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1.5 w-full">
                            <Globe className="h-3.5 w-3.5" />
                            Website
                          </Button>
                        </a>
                      )}
                      {p.email && (
                        <a href={`mailto:${p.email}`}>
                          <Button variant="outline" size="sm" className="gap-1.5 w-full">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </Button>
                        </a>
                      )}
                      {p.phone && (
                        <a href={`tel:${p.phone}`}>
                          <Button variant="outline" size="sm" className="gap-1.5 w-full">
                            <Phone className="h-3.5 w-3.5" />
                            Call
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
