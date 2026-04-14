/**
 * Seed data for ChainedIn.
 * All logical test data lives here — accounts, software, versions, CVEs, badges, stacks.
 * The seed.ts script reads this file and writes everything to the database.
 *
 * Hierarchy enforced: every SoftwareVersion must reference a Software by slug.
 * Every CVE must reference a SoftwareVersion by (slug, version).
 * Every StackNode must reference a (slug, version) or be freeform.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = "ADMIN" | "COMPANY" | "PERSON";

export interface SeedUser {
  email: string;
  name: string;
  type: AccountType;
  bio?: string;
  website?: string;
}

export interface SeedVersion {
  version: string;
  releasedAt: string;     // ISO date string
  changelog?: string;
  cves: SeedCve[];        // Empty array = clean version
}

export interface SeedCve {
  cveId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cvssScore: number;
  description: string;
  publishedAt: string;
}

export interface SeedSoftware {
  ownerEmail: string;     // Must match a SeedUser.email
  slug: string;           // Unique URL identifier
  name: string;
  ecosystem: "npm" | "pip" | "maven" | "cargo" | "gem" | "nuget" | "go" | "other";
  description: string;
  repoUrl?: string;
  /**
   * Versions listed oldest → newest.
   * Each version is always connected to THIS software package via slug.
   * The seed enforces this relationship — you cannot add a version without a parent software.
   */
  versions: SeedVersion[];
}

export interface SeedBadge {
  userEmail: string;
  badgeType: "ISO27001" | "NIS2" | "SOC2" | "GDPR" | "PCI_DSS";
  status: "APPROVED" | "PENDING" | "REJECTED";
  evidence?: string;
  adminNote?: string;
  requestedAt: string;
  resolvedAt?: string;
}

export interface SeedStackNode {
  // Either link to a platform version, or provide freeform fields
  platformRef?: { slug: string; version: string };  // Must match SeedSoftware.slug + SeedVersion.version
  freeform?: { name: string; version: string; ecosystem: string };
  positionX: number;
  positionY: number;
}

export interface SeedStackEdge {
  // 0-based index into the nodes array of the parent stack
  sourceIndex: number;
  targetIndex: number;
}

export interface SeedStack {
  id: string;              // Stable ID for upsert
  ownerEmail: string;
  name: string;
  description?: string;
  nodes: SeedStackNode[];
  edges: SeedStackEdge[];
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const USERS: SeedUser[] = [
  // ── Original 5 ──────────────────────────────────────────────────────────────
  {
    email: "admin@chainedin.dev",

    name: "ChainedIn Admin",
    type: "ADMIN",
    bio: "Platform administrator. Reviews badge requests and manages the registry.",
  },
  {
    email: "acme@chainedin.dev",

    name: "ACME Corp",
    type: "COMPANY",
    bio: "We build open-source developer tooling trusted by thousands of teams.",
    website: "https://example-acme.com",
  },
  {
    email: "securecorp@chainedin.dev",

    name: "SecureCorp",
    type: "COMPANY",
    bio: "Security-first software for enterprise customers. ISO 27001 certified.",
    website: "https://example-securecorp.com",
  },
  {
    email: "alice@chainedin.dev",

    name: "Alice Chen",
    type: "PERSON",
    bio: "Security researcher and full-stack developer. Interested in supply chain security.",
  },
  {
    email: "bob@chainedin.dev",

    name: "Bob Torres",
    type: "PERSON",
    bio: "DevOps engineer focusing on supply chain security and container hardening.",
  },

  // ── 10 New Accounts ─────────────────────────────────────────────────────────
  {
    email: "cloudnative@chainedin.dev",

    name: "CloudNative Systems",
    type: "COMPANY",
    bio: "Building cloud-native infrastructure tooling for Kubernetes operators and service meshes.",
    website: "https://example-cloudnative.io",
  },
  {
    email: "dataflow@chainedin.dev",

    name: "DataFlow Inc",
    type: "COMPANY",
    bio: "Open-source data pipeline and stream processing platform. Used in production by 500+ companies.",
    website: "https://example-dataflow.io",
  },
  {
    email: "rustlabs@chainedin.dev",

    name: "RustLabs",
    type: "COMPANY",
    bio: "Memory-safe systems software in Rust. Specialising in cryptography, secrets management, and low-level security tooling.",
    website: "https://example-rustlabs.dev",
  },
  {
    email: "openauth@chainedin.dev",

    name: "OpenAuth Foundation",
    type: "COMPANY",
    bio: "Vendor-neutral identity and access management libraries. Maintainers of oauth2-server and jwt-lib.",
    website: "https://example-openauth.org",
  },
  {
    email: "carlos@chainedin.dev",

    name: "Carlos Mendes",
    type: "PERSON",
    bio: "Penetration tester and red-team operator. Building open-source pentest utilities.",
  },
  {
    email: "diana@chainedin.dev",

    name: "Diana Kos",
    type: "PERSON",
    bio: "DevSecOps engineer. Integrating security scanning into CI/CD pipelines since 2018.",
  },
  {
    email: "emeka@chainedin.dev",

    name: "Emeka Osei",
    type: "PERSON",
    bio: "Systems programmer and Rust contributor. Working on safe memory allocators and async runtimes.",
  },
  {
    email: "fatima@chainedin.dev",

    name: "Fatima Al-Rashid",
    type: "PERSON",
    bio: "Security architect with 12 years experience. NIS2 compliance lead at a Fortune 500 firm.",
  },
  {
    email: "george@chainedin.dev",

    name: "George Papadopoulos",
    type: "PERSON",
    bio: "Backend developer. Building distributed microservices in Go and Java.",
  },
  {
    email: "hana@chainedin.dev",

    name: "Hana Novak",
    type: "PERSON",
    bio: "Open-source contributor and front-end security enthusiast. CSP headers are my love language.",
  },
];

// ─── Software + Versions ──────────────────────────────────────────────────────
//
// HIERARCHY RULE: Every SoftwareVersion is a child of one Software package.
// This is enforced both in the database schema (softwareId FK) and here in
// the data model (versions are nested inside their parent software object).
// You cannot create a version without first selecting its parent software.

export const SOFTWARE: SeedSoftware[] = [

  // ── ACME Corp ───────────────────────────────────────────────────────────────

  {
    ownerEmail: "acme@chainedin.dev",
    slug: "acme-toolkit",
    name: "acme-toolkit",
    ecosystem: "npm",
    description: "A collection of utility functions for Node.js applications. Covers deep merging, async helpers, and string utilities.",
    repoUrl: "https://github.com/example/acme-toolkit",
    versions: [
      {
        version: "1.0.0", releasedAt: "2022-01-15", changelog: "Initial release",
        cves: [
          { cveId: "CVE-2022-21824", severity: "CRITICAL", cvssScore: 9.8, description: "Due to the use of prototype in the mergeObjects helper, a prototype pollution flaw can be exploited to achieve Remote Code Execution.", publishedAt: "2022-02-24" },
          { cveId: "CVE-2022-24999", severity: "HIGH",     cvssScore: 7.5, description: "Improper Input Validation in the async queue allows remote attackers to cause denial of service via crafted payloads.", publishedAt: "2022-03-15" },
          { cveId: "CVE-2022-31129", severity: "HIGH",     cvssScore: 7.5, description: "Inefficient Regular Expression Complexity in the date-parser utility can lead to ReDoS.", publishedAt: "2022-07-06" },
          { cveId: "CVE-2021-3803",  severity: "MEDIUM",   cvssScore: 5.3, description: "nth-check dependency is vulnerable to Inefficient Regular Expression Complexity.", publishedAt: "2021-09-17" },
        ],
      },
      {
        version: "1.1.0", releasedAt: "2022-06-20", changelog: "Added async helpers and improved error messages",
        cves: [
          { cveId: "CVE-2022-24999", severity: "HIGH",   cvssScore: 7.5, description: "Improper Input Validation in the async queue allows denial of service.", publishedAt: "2022-03-15" },
          { cveId: "CVE-2022-31129", severity: "HIGH",   cvssScore: 7.5, description: "ReDoS in date-parser utility.", publishedAt: "2022-07-06" },
          { cveId: "CVE-2021-3803",  severity: "MEDIUM", cvssScore: 5.3, description: "nth-check ReDoS.", publishedAt: "2021-09-17" },
        ],
      },
      {
        version: "1.2.0", releasedAt: "2023-03-10", changelog: "Security patches for prototype pollution and ReDoS issues",
        cves: [
          { cveId: "CVE-2023-26115", severity: "LOW", cvssScore: 3.2, description: "Minor path traversal edge case in file utility (informational, requires authenticated access).", publishedAt: "2023-04-01" },
        ],
      },
      {
        version: "2.0.0", releasedAt: "2024-01-05", changelog: "Complete TypeScript rewrite. All known CVEs resolved. Dropped legacy mergeObjects.",
        cves: [],
      },
      {
        version: "2.1.0", releasedAt: "2026-04-01", changelog: "New plugin API and performance improvements. CVE scan in progress.",
        cves: [],
      },
    ],
  },

  {
    ownerEmail: "acme@chainedin.dev",
    slug: "acme-logger",
    name: "acme-logger",
    ecosystem: "npm",
    description: "Structured logging for Node.js with pluggable transports for file, stdout, and remote sinks.",
    versions: [
      {
        version: "0.9.0", releasedAt: "2023-01-10", changelog: "Beta release",
        cves: [
          { cveId: "CVE-2023-44487", severity: "HIGH",   cvssScore: 7.5, description: "Log injection vulnerability allows manipulation of log files via unsanitised user-controlled input.", publishedAt: "2023-03-10" },
          { cveId: "CVE-2023-26136", severity: "MEDIUM", cvssScore: 5.0, description: "Sensitive data (stack traces with env vars) exposed in formatted error logs at DEBUG level.", publishedAt: "2023-06-20" },
        ],
      },
      {
        version: "1.0.0", releasedAt: "2023-09-01", changelog: "Stable release. Sanitized all log injection vectors. Redacted env vars from stack traces.",
        cves: [],
      },
      {
        version: "1.1.0", releasedAt: "2026-03-28", changelog: "Added OpenTelemetry trace context injection. Released last week, CVE scan pending.",
        cves: [],
      },
    ],
  },

  // ── SecureCorp ──────────────────────────────────────────────────────────────

  {
    ownerEmail: "securecorp@chainedin.dev",
    slug: "securevault-sdk",
    name: "securevault-sdk",
    ecosystem: "pip",
    description: "Python SDK for the SecureVault secrets management service. Supports dynamic secrets, lease renewal, and policy enforcement.",
    repoUrl: "https://github.com/example/securevault-sdk",
    versions: [
      {
        version: "1.0.0", releasedAt: "2023-03-01", changelog: "Initial release",
        cves: [],
      },
      {
        version: "1.1.0", releasedAt: "2023-08-15", changelog: "Added automatic secret rotation support",
        cves: [],
      },
      {
        version: "1.2.0", releasedAt: "2024-02-01", changelog: "Full audit logging with tamper-evident signatures. No known CVEs.",
        cves: [],
      },
    ],
  },

  // ── CloudNative Systems ─────────────────────────────────────────────────────

  {
    ownerEmail: "cloudnative@chainedin.dev",
    slug: "k8s-operator-sdk",
    name: "k8s-operator-sdk",
    ecosystem: "go",
    description: "SDK for building Kubernetes operators with reconciler patterns, webhook support, and RBAC scaffolding.",
    repoUrl: "https://github.com/example/k8s-operator-sdk",
    versions: [
      {
        version: "0.1.0", releasedAt: "2022-05-10", changelog: "Initial alpha",
        cves: [
          { cveId: "CVE-2022-3162", severity: "CRITICAL", cvssScore: 9.1, description: "SSRF vulnerability in the admission webhook handler allows unauthenticated users to proxy requests to internal cluster services.", publishedAt: "2022-10-12" },
          { cveId: "CVE-2022-3172", severity: "HIGH",     cvssScore: 7.6, description: "Aggregated API server does not properly validate the redirect URL, allowing open-redirect attacks.", publishedAt: "2022-10-20" },
        ],
      },
      {
        version: "0.2.0", releasedAt: "2023-01-20", changelog: "Fixed webhook SSRF. Added controller-gen support.",
        cves: [
          { cveId: "CVE-2023-2727", severity: "HIGH",   cvssScore: 7.2, description: "Bypassing policies imposed by the ImagePolicyWebhook admission plugin via specially crafted pod spec.", publishedAt: "2023-06-16" },
          { cveId: "CVE-2023-2728", severity: "MEDIUM", cvssScore: 6.5, description: "Bypassing mountable secrets policy imposed by the ServiceAccount admission plugin.", publishedAt: "2023-06-16" },
        ],
      },
      {
        version: "1.0.0", releasedAt: "2023-09-05", changelog: "Stable release. Hardened webhook validation. Full e2e test suite.",
        cves: [
          { cveId: "CVE-2023-5528", severity: "MEDIUM", cvssScore: 5.5, description: "Insufficient input sanitisation allows a user to create symlinks in host filesystem when subPath is used.", publishedAt: "2023-11-14" },
        ],
      },
      {
        version: "1.1.0", releasedAt: "2024-04-01", changelog: "Patched CVE-2023-5528. Upgraded to Go 1.22. No known CVEs.",
        cves: [],
      },
      {
        version: "1.2.0", releasedAt: "2026-04-08", changelog: "Added CRD validation webhooks and leader election. Just shipped — scan queued.",
        cves: [],
      },
    ],
  },

  {
    ownerEmail: "cloudnative@chainedin.dev",
    slug: "envoy-config-gen",
    name: "envoy-config-gen",
    ecosystem: "go",
    description: "Generates and validates Envoy proxy configurations from annotated Kubernetes CRDs.",
    versions: [
      {
        version: "1.0.0", releasedAt: "2023-03-15", changelog: "Initial release",
        cves: [
          { cveId: "CVE-2023-35943", severity: "HIGH",   cvssScore: 7.5, description: "Envoy incorrectly handles CORS filter handling when the origin header is empty, allowing filter bypass.", publishedAt: "2023-07-25" },
          { cveId: "CVE-2023-35944", severity: "HIGH",   cvssScore: 7.5, description: "Malformed requests targeting URLs with mixed schemes may lead to unexpected authorization bypass.", publishedAt: "2023-07-25" },
        ],
      },
      {
        version: "1.0.1", releasedAt: "2023-08-10", changelog: "Patched CORS bypass issues",
        cves: [
          { cveId: "CVE-2023-44487", severity: "LOW", cvssScore: 3.7, description: "HTTP/2 Rapid Reset vulnerability impact is mitigated by upstream load balancer in recommended configs.", publishedAt: "2023-10-10" },
        ],
      },
      {
        version: "1.1.0", releasedAt: "2024-02-20", changelog: "Upgraded to Envoy 1.29. All CVEs resolved.",
        cves: [],
      },
    ],
  },

  // ── DataFlow Inc ────────────────────────────────────────────────────────────

  {
    ownerEmail: "dataflow@chainedin.dev",
    slug: "dataflow-core",
    name: "dataflow-core",
    ecosystem: "pip",
    description: "Core Python library for defining, scheduling, and executing data pipelines with pluggable connectors.",
    repoUrl: "https://github.com/example/dataflow-core",
    versions: [
      {
        version: "2.0.0", releasedAt: "2022-11-01", changelog: "Major rewrite with async execution engine",
        cves: [
          { cveId: "CVE-2022-36760", severity: "HIGH",   cvssScore: 8.1, description: "SQL injection in the dynamic query builder via unsanitised pipeline parameter substitution.", publishedAt: "2022-12-12" },
          { cveId: "CVE-2022-42256", severity: "HIGH",   cvssScore: 7.8, description: "Arbitrary code execution via deserialization of untrusted data in the pickled task state.", publishedAt: "2022-11-29" },
          { cveId: "CVE-2022-44566", severity: "MEDIUM", cvssScore: 6.2, description: "Denial-of-service through uncontrolled recursion when parsing deeply nested YAML pipeline configs.", publishedAt: "2022-12-05" },
        ],
      },
      {
        version: "2.1.0", releasedAt: "2023-04-12", changelog: "Switched to parameterised queries. Replaced pickle with JSON state serialisation.",
        cves: [
          { cveId: "CVE-2023-24329", severity: "MEDIUM", cvssScore: 5.5, description: "urllib.parse.urlparse does not strip leading whitespace in URLs, allowing filter bypass.", publishedAt: "2023-02-17" },
        ],
      },
      {
        version: "2.2.0", releasedAt: "2024-01-15", changelog: "All known CVEs resolved. Added schema validation for all pipeline inputs.",
        cves: [],
      },
    ],
  },

  {
    ownerEmail: "dataflow@chainedin.dev",
    slug: "dataflow-spark",
    name: "dataflow-spark",
    ecosystem: "maven",
    description: "Apache Spark connector for DataFlow pipelines. Enables large-scale batch and streaming transformations.",
    versions: [
      {
        version: "1.0.0", releasedAt: "2023-02-20", changelog: "Initial release — Spark 3.3 support",
        cves: [
          { cveId: "CVE-2021-44228", severity: "CRITICAL", cvssScore: 10.0, description: "Log4Shell — Apache Log4j 2 JNDI lookups can be exploited to achieve Remote Code Execution. Bundled log4j-core must be upgraded immediately.", publishedAt: "2021-12-10" },
          { cveId: "CVE-2022-42003", severity: "HIGH",      cvssScore: 7.5, description: "Jackson Databind deep wrapper array nesting deserialization can cause out-of-memory error.", publishedAt: "2022-10-02" },
          { cveId: "CVE-2022-25857", severity: "HIGH",      cvssScore: 7.5, description: "SnakeYAML Constructor deserialization of untrusted YAML can execute arbitrary Java code.", publishedAt: "2022-08-30" },
        ],
      },
      {
        version: "1.1.0", releasedAt: "2023-10-01", changelog: "Upgraded to Log4j 2.20, snakeyaml 2.0, jackson 2.14. Log4Shell and related CVEs resolved.",
        cves: [],
      },
    ],
  },

  // ── RustLabs ────────────────────────────────────────────────────────────────

  {
    ownerEmail: "rustlabs@chainedin.dev",
    slug: "vault-rs",
    name: "vault-rs",
    ecosystem: "cargo",
    description: "Rust client library for HashiCorp Vault and compatible secrets engines. Async-first with Tokio support.",
    repoUrl: "https://github.com/example/vault-rs",
    versions: [
      {
        version: "0.5.0", releasedAt: "2022-08-01", changelog: "Beta release",
        cves: [
          { cveId: "CVE-2022-21658", severity: "HIGH",   cvssScore: 7.3, description: "Race condition in the file-backed token cache can lead to use-after-free when a token renewal races with a logout.", publishedAt: "2022-01-20" },
          { cveId: "CVE-2022-24713", severity: "MEDIUM", cvssScore: 6.5, description: "Regex denial-of-service in the policy path matcher allows a crafted policy path to consume excessive CPU.", publishedAt: "2022-03-08" },
        ],
      },
      {
        version: "1.0.0", releasedAt: "2023-05-15", changelog: "Stable release. Replaced file token cache with memory-only store. Regex hardened.",
        cves: [
          { cveId: "CVE-2023-45145", severity: "LOW", cvssScore: 3.6, description: "Unix socket permission check can be bypassed by a local user if /tmp is world-writable (informational).", publishedAt: "2023-10-18" },
        ],
      },
      {
        version: "1.0.1", releasedAt: "2024-01-30", changelog: "Patched socket permission check. Now sets restrictive umask before bind.",
        cves: [],
      },
      {
        version: "1.1.0", releasedAt: "2026-04-10", changelog: "Added mTLS support and AWS Secrets Manager backend. Brand new — CVE scan not yet run.",
        cves: [],
      },
    ],
  },

  {
    ownerEmail: "rustlabs@chainedin.dev",
    slug: "crypto-audit-cli",
    name: "crypto-audit-cli",
    ecosystem: "cargo",
    description: "CLI tool for auditing cryptographic algorithm usage in Rust and C codebases. Flags deprecated algorithms.",
    versions: [
      {
        version: "0.1.0", releasedAt: "2023-04-10", changelog: "First public release",
        cves: [
          { cveId: "CVE-2023-28755", severity: "MEDIUM", cvssScore: 5.3, description: "URI parsing in the report-upload feature uses Ruby-style glob expansion allowing path traversal in report filenames.", publishedAt: "2023-03-31" },
        ],
      },
      {
        version: "0.2.0", releasedAt: "2023-11-20", changelog: "Replaced URI parsing library. Added C/C++ parser. No known CVEs.",
        cves: [],
      },
    ],
  },

  // ── OpenAuth Foundation ─────────────────────────────────────────────────────

  {
    ownerEmail: "openauth@chainedin.dev",
    slug: "oauth2-server",
    name: "oauth2-server",
    ecosystem: "npm",
    description: "RFC 6749 compliant OAuth 2.0 authorization server library for Node.js. Supports Authorization Code, Client Credentials, and Device flows.",
    repoUrl: "https://github.com/example/oauth2-server",
    versions: [
      {
        version: "1.0.0", releasedAt: "2021-06-01", changelog: "Initial release",
        cves: [
          { cveId: "CVE-2022-24785", severity: "CRITICAL", cvssScore: 9.8, description: "JWT algorithm confusion: a forged token with alg:none header is accepted as valid when jwksUri returns an RSA key. Allows full auth bypass.", publishedAt: "2022-04-04" },
          { cveId: "CVE-2022-31129", severity: "HIGH",     cvssScore: 7.5, description: "ReDoS in scope validation regex via crafted scope strings with repeated special characters.", publishedAt: "2022-07-06" },
          { cveId: "CVE-2021-43138", severity: "HIGH",     cvssScore: 7.8, description: "Prototype pollution via async library allows overwriting Object.prototype properties.", publishedAt: "2021-11-04" },
        ],
      },
      {
        version: "2.0.0", releasedAt: "2022-10-15", changelog: "Rewritten signature verification. Dropped alg:none support. Pinned algorithm per key.",
        cves: [
          { cveId: "CVE-2022-46175", severity: "HIGH",   cvssScore: 7.5, description: "Prototype pollution in the refresh token introspection endpoint.", publishedAt: "2022-12-24" },
          { cveId: "CVE-2022-44566", severity: "MEDIUM", cvssScore: 6.2, description: "Denial-of-service via overly large token payload causing unbounded JSON parsing.", publishedAt: "2022-12-05" },
        ],
      },
      {
        version: "2.1.0", releasedAt: "2023-06-01", changelog: "Patched prototype pollution in introspection. Added payload size limit.",
        cves: [
          { cveId: "CVE-2023-26136", severity: "MEDIUM", cvssScore: 5.0, description: "CSRF token leaked in Referer header when redirect_uri uses plain HTTP.", publishedAt: "2023-06-20" },
        ],
      },
      {
        version: "3.0.0", releasedAt: "2024-03-01", changelog: "Full PKCE enforcement. Strict redirect_uri matching. All known CVEs resolved.",
        cves: [],
      },
    ],
  },

  {
    ownerEmail: "openauth@chainedin.dev",
    slug: "jwt-lib",
    name: "jwt-lib",
    ecosystem: "npm",
    description: "Minimal, spec-compliant JSON Web Token library. Supports HS256, RS256, ES256 signing and verification.",
    versions: [
      {
        version: "1.0.0", releasedAt: "2020-03-10", changelog: "Initial release",
        cves: [
          { cveId: "CVE-2022-24785", severity: "CRITICAL", cvssScore: 9.8, description: "Algorithm confusion: tokens signed with RSA keys can be forged by downgrading alg to HS256 and signing with the public key as HMAC secret.", publishedAt: "2022-04-04" },
          { cveId: "CVE-2021-27568", severity: "CRITICAL", cvssScore: 9.1, description: "Null signature in JWS header is accepted as valid when verify() is called with an empty secret.", publishedAt: "2021-02-12" },
          { cveId: "CVE-2021-43138", severity: "HIGH",     cvssScore: 7.8, description: "Prototype pollution via crafted JWT claims object allows overwriting Object.prototype.", publishedAt: "2021-11-04" },
        ],
      },
      {
        version: "1.1.0", releasedAt: "2022-07-01", changelog: "Pinned algorithm to key type. Reject null/empty signatures.",
        cves: [
          { cveId: "CVE-2022-46175", severity: "HIGH",   cvssScore: 7.5, description: "Object.assign merge of JWT payload still susceptible to prototype pollution when key is __proto__.", publishedAt: "2022-12-24" },
          { cveId: "CVE-2022-25927", severity: "MEDIUM", cvssScore: 6.5, description: "Timing side-channel in HMAC comparison allows signature oracle via response timing.", publishedAt: "2022-02-14" },
        ],
      },
      {
        version: "1.2.0", releasedAt: "2023-08-15", changelog: "Constant-time comparison for all HMAC operations. Frozen payload object to prevent prototype pollution. All CVEs resolved.",
        cves: [],
      },
    ],
  },

  // ── Carlos Mendes ───────────────────────────────────────────────────────────

  {
    ownerEmail: "carlos@chainedin.dev",
    slug: "pentest-utils",
    name: "pentest-utils",
    ecosystem: "pip",
    description: "Collection of Python utilities for penetration testers: port scanner, DNS recon, HTTP fuzzer, and report generator.",
    versions: [
      {
        version: "1.0.0", releasedAt: "2023-07-15", changelog: "Initial public release",
        cves: [
          { cveId: "CVE-2023-24329", severity: "MEDIUM", cvssScore: 5.5, description: "urllib.parse.urlparse does not strip leading whitespace; the scanner may issue requests to unintended hosts.", publishedAt: "2023-02-17" },
        ],
      },
      {
        version: "1.1.0", releasedAt: "2024-02-28", changelog: "Upgraded urllib. Added output sanitisation. No known CVEs.",
        cves: [],
      },
    ],
  },

  // ── Diana Kos ───────────────────────────────────────────────────────────────

  {
    ownerEmail: "diana@chainedin.dev",
    slug: "devsecops-scanner",
    name: "devsecops-scanner",
    ecosystem: "npm",
    description: "CLI security scanner for CI/CD pipelines. Checks for secrets in code, vulnerable dependencies, and misconfigured IAC files.",
    versions: [
      {
        version: "0.8.0", releasedAt: "2023-05-01", changelog: "Beta release",
        cves: [
          { cveId: "CVE-2023-26115", severity: "LOW", cvssScore: 3.2, description: "Path traversal in the report output directory when directory name is user-controlled via config file.", publishedAt: "2023-04-01" },
        ],
      },
      {
        version: "1.0.0", releasedAt: "2023-11-10", changelog: "Stable release. Sanitised all report path inputs. No known CVEs.",
        cves: [],
      },
    ],
  },

  // ── Emeka Osei ──────────────────────────────────────────────────────────────

  {
    ownerEmail: "emeka@chainedin.dev",
    slug: "safe-allocator",
    name: "safe-allocator",
    ecosystem: "cargo",
    description: "A Rust global allocator with guard pages, allocation tracking, and optional zeroization on dealloc.",
    versions: [
      {
        version: "0.1.0", releasedAt: "2022-12-01", changelog: "Initial release",
        cves: [
          { cveId: "CVE-2022-21658", severity: "HIGH",   cvssScore: 7.3, description: "Race condition between guard page setup and first allocation can lead to use-after-free in multi-threaded contexts.", publishedAt: "2022-01-20" },
          { cveId: "CVE-2022-24713", severity: "MEDIUM", cvssScore: 6.5, description: "Stats tracking map can overflow causing wrap-around in allocation counters, leading to incorrect OOM decisions.", publishedAt: "2022-03-08" },
        ],
      },
      {
        version: "0.2.0", releasedAt: "2023-06-15", changelog: "Fixed race condition with atomic guard page initialisation. Replaced HashMap with fixed-size array for stats.",
        cves: [
          { cveId: "CVE-2023-45145", severity: "MEDIUM", cvssScore: 5.5, description: "Zeroization on dealloc not guaranteed when the allocator is used with no_std and certain LLVM optimisation passes.", publishedAt: "2023-10-18" },
        ],
      },
      {
        version: "0.3.0", releasedAt: "2024-03-10", changelog: "Volatile zeroization to prevent LLVM elision. Full no_std support. No known CVEs.",
        cves: [],
      },
    ],
  },
];

// ─── Compliance Badges ────────────────────────────────────────────────────────

export const BADGES: SeedBadge[] = [
  // ── Existing ──────────────────────────────────────────────────────────────
  {
    userEmail: "securecorp@chainedin.dev",
    badgeType: "ISO27001",
    status: "APPROVED",
    evidence: "https://example-securecorp.com/iso27001-cert.pdf",
    adminNote: "Certificate verified. Valid until 2026.",
    requestedAt: "2024-01-10",
    resolvedAt: "2024-01-12",
  },
  {
    userEmail: "bob@chainedin.dev",
    badgeType: "NIS2",
    status: "PENDING",
    evidence: "https://bob-portfolio.example.com/nis2-compliance",
    requestedAt: "2025-12-01",
  },

  // ── New ───────────────────────────────────────────────────────────────────
  {
    userEmail: "openauth@chainedin.dev",
    badgeType: "GDPR",
    status: "APPROVED",
    evidence: "https://example-openauth.org/gdpr-dpa.pdf",
    adminNote: "DPA reviewed. GDPR Article 28 compliant.",
    requestedAt: "2024-03-01",
    resolvedAt: "2024-03-04",
  },
  {
    userEmail: "openauth@chainedin.dev",
    badgeType: "SOC2",
    status: "APPROVED",
    evidence: "https://example-openauth.org/soc2-type2-2024.pdf",
    adminNote: "SOC 2 Type II report for period Jan–Dec 2023. Accepted.",
    requestedAt: "2024-04-10",
    resolvedAt: "2024-04-14",
  },
  {
    userEmail: "cloudnative@chainedin.dev",
    badgeType: "ISO27001",
    status: "PENDING",
    evidence: "https://example-cloudnative.io/iso-application",
    requestedAt: "2026-01-20",
  },
  {
    userEmail: "rustlabs@chainedin.dev",
    badgeType: "SOC2",
    status: "REJECTED",
    evidence: "https://example-rustlabs.dev/soc2-incomplete",
    adminNote: "Submitted report is Type I only. Please resubmit with Type II covering a 6-month period.",
    requestedAt: "2025-11-01",
    resolvedAt: "2025-11-05",
  },
  {
    userEmail: "fatima@chainedin.dev",
    badgeType: "NIS2",
    status: "APPROVED",
    evidence: "https://fatima-arch.example.com/nis2-compliance-report.pdf",
    adminNote: "Verified compliance officer at certified organisation.",
    requestedAt: "2025-09-15",
    resolvedAt: "2025-09-18",
  },
  {
    userEmail: "dataflow@chainedin.dev",
    badgeType: "GDPR",
    status: "PENDING",
    evidence: "https://example-dataflow.io/gdpr",
    requestedAt: "2026-02-10",
  },
];

// ─── Stacks ───────────────────────────────────────────────────────────────────

export const STACKS: SeedStack[] = [
  {
    id: "seed-stack-alice-prod",
    ownerEmail: "alice@chainedin.dev",
    name: "Production API Stack",
    description: "Dependencies for the main REST API service",
    nodes: [
      { platformRef: { slug: "acme-toolkit",  version: "1.0.0" }, positionX: 100, positionY: 150 },
      { platformRef: { slug: "acme-logger",   version: "1.0.0" }, positionX: 350, positionY: 150 },
      { freeform: { name: "internal-auth-lib", version: "0.3.2", ecosystem: "npm" }, positionX: 225, positionY: 310 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },
  {
    id: "seed-stack-carlos-redteam",
    ownerEmail: "carlos@chainedin.dev",
    name: "Red Team Toolkit",
    description: "Tools used during red team engagements",
    nodes: [
      { platformRef: { slug: "pentest-utils",    version: "1.0.0" }, positionX: 100, positionY: 120 },
      { platformRef: { slug: "devsecops-scanner", version: "0.8.0" }, positionX: 320, positionY: 120 },
      { freeform: { name: "impacket",   version: "0.10.0", ecosystem: "pip"  }, positionX: 100, positionY: 280 },
      { freeform: { name: "bloodhound", version: "4.3.1",  ecosystem: "other" }, positionX: 320, positionY: 280 },
      { freeform: { name: "crackmapexec", version: "5.4.0", ecosystem: "pip" }, positionX: 210, positionY: 420 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2 },
      { sourceIndex: 0, targetIndex: 4 },
      { sourceIndex: 1, targetIndex: 2 },
      { sourceIndex: 3, targetIndex: 4 },
    ],
  },
  {
    id: "seed-stack-diana-cicd",
    ownerEmail: "diana@chainedin.dev",
    name: "CI/CD Pipeline Stack",
    description: "Security tooling integrated into our GitHub Actions pipeline",
    nodes: [
      { platformRef: { slug: "devsecops-scanner", version: "1.0.0" },   positionX: 200, positionY: 100 },
      { platformRef: { slug: "acme-logger",       version: "1.0.0" },   positionX: 430, positionY: 100 },
      { platformRef: { slug: "k8s-operator-sdk",  version: "1.1.0" },   positionX: 200, positionY: 250 },
      { freeform: { name: "trivy",     version: "0.48.0",  ecosystem: "go"  }, positionX: 430, positionY: 250 },
      { freeform: { name: "semgrep",   version: "1.45.0",  ecosystem: "pip" }, positionX: 315, positionY: 400 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 4 },
      { sourceIndex: 1, targetIndex: 4 },
      { sourceIndex: 2, targetIndex: 3 },
      { sourceIndex: 3, targetIndex: 4 },
    ],
  },
  {
    id: "seed-stack-george-microservices",
    ownerEmail: "george@chainedin.dev",
    name: "Microservices Stack",
    description: "Core dependencies for the Go + Java microservices platform",
    nodes: [
      { platformRef: { slug: "k8s-operator-sdk",  version: "1.0.0" }, positionX: 120, positionY: 120 },
      { platformRef: { slug: "dataflow-spark",     version: "1.0.0" }, positionX: 370, positionY: 120 },
      { platformRef: { slug: "envoy-config-gen",   version: "1.0.0" }, positionX: 120, positionY: 300 },
      { platformRef: { slug: "securevault-sdk",    version: "1.2.0" }, positionX: 370, positionY: 300 },
      { freeform: { name: "prometheus-client", version: "0.19.0", ecosystem: "pip" }, positionX: 245, positionY: 460 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2 },
      { sourceIndex: 0, targetIndex: 4 },
      { sourceIndex: 1, targetIndex: 4 },
      { sourceIndex: 2, targetIndex: 4 },
      { sourceIndex: 3, targetIndex: 4 },
    ],
  },
  {
    id: "seed-stack-hana-frontend",
    ownerEmail: "hana@chainedin.dev",
    name: "Frontend Build Stack",
    description: "Build tooling and auth libraries for a SPA",
    nodes: [
      { platformRef: { slug: "jwt-lib",      version: "1.1.0" }, positionX: 120, positionY: 120 },
      { platformRef: { slug: "oauth2-server", version: "2.0.0" }, positionX: 380, positionY: 120 },
      { freeform: { name: "vite",      version: "5.0.8",  ecosystem: "npm" }, positionX: 120, positionY: 280 },
      { freeform: { name: "typescript", version: "5.3.3", ecosystem: "npm" }, positionX: 380, positionY: 280 },
      { freeform: { name: "eslint",    version: "8.56.0", ecosystem: "npm" }, positionX: 250, positionY: 420 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2 },
      { sourceIndex: 1, targetIndex: 2 },
      { sourceIndex: 2, targetIndex: 4 },
      { sourceIndex: 3, targetIndex: 4 },
    ],
  },
  {
    id: "seed-stack-fatima-enterprise",
    ownerEmail: "fatima@chainedin.dev",
    name: "Enterprise Security Stack",
    description: "IAM and secrets management baseline for enterprise deployments",
    nodes: [
      { platformRef: { slug: "oauth2-server",  version: "3.0.0" }, positionX: 100, positionY: 130 },
      { platformRef: { slug: "jwt-lib",        version: "1.2.0" }, positionX: 350, positionY: 130 },
      { platformRef: { slug: "vault-rs",       version: "1.0.1" }, positionX: 100, positionY: 300 },
      { platformRef: { slug: "securevault-sdk", version: "1.2.0" }, positionX: 350, positionY: 300 },
      { freeform: { name: "ldap3",     version: "2.9.1",  ecosystem: "pip" }, positionX: 225, positionY: 440 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2 },
      { sourceIndex: 1, targetIndex: 2 },
      { sourceIndex: 2, targetIndex: 4 },
      { sourceIndex: 3, targetIndex: 4 },
    ],
  },
  {
    id: "seed-stack-emeka-rust",
    ownerEmail: "emeka@chainedin.dev",
    name: "Secure Rust Runtime",
    description: "Safe async runtime stack with custom allocator",
    nodes: [
      { platformRef: { slug: "safe-allocator",  version: "0.3.0" }, positionX: 150, positionY: 120 },
      { platformRef: { slug: "vault-rs",        version: "1.0.1" }, positionX: 400, positionY: 120 },
      { platformRef: { slug: "crypto-audit-cli", version: "0.2.0" }, positionX: 150, positionY: 290 },
      { freeform: { name: "tokio",  version: "1.35.1", ecosystem: "cargo" }, positionX: 400, positionY: 290 },
      { freeform: { name: "rustls", version: "0.22.0", ecosystem: "cargo" }, positionX: 275, positionY: 430 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 3 },
      { sourceIndex: 1, targetIndex: 4 },
      { sourceIndex: 2, targetIndex: 3 },
      { sourceIndex: 3, targetIndex: 4 },
    ],
  },
];
