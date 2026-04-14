/**
 * seed.ts — Reads all data from seed-data.ts and writes to the database.
 *
 * Hierarchy enforced:
 *   User → Software → SoftwareVersion → CveCache
 *
 * A SoftwareVersion can ONLY be created after its parent Software exists.
 * A CveCache entry can ONLY be created after its parent SoftwareVersion exists.
 * Stack nodes that reference a platform version resolve the ID at seed time.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { USERS, SOFTWARE, BADGES, STACKS } from "./seed-data";

const prisma = new PrismaClient();

// Dev password used for all seeded accounts.
// Change this here if you want a different default — it only affects seed runs.
const DEV_PASSWORD = "password123";

async function main() {
  console.log("🌱 Seeding ChainedIn from seed-data.ts...\n");

  // ─── Step 1: Users ────────────────────────────────────────────────────────

  const userIdByEmail: Record<string, string> = {};
  const hashed = await bcrypt.hash(DEV_PASSWORD, 12);

  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, bio: u.bio ?? null, website: u.website ?? null },
      create: {
        email: u.email,
        password: hashed,
        name: u.name,
        type: u.type,
        bio: u.bio ?? null,
        website: u.website ?? null,
      },
    });
    userIdByEmail[u.email] = user.id;
  }

  console.log(`✅ ${USERS.length} users upserted`);

  // ─── Step 2: Software → Versions → CVEs ──────────────────────────────────
  //
  // HIERARCHY: Software is created first (parent). Then each version is
  // created as a child of that software. CVE cache entries are children of
  // versions. Nothing can exist without its parent.

  // Index: { slug: { version: softwareVersionId } }
  const versionIdBySlugVersion: Record<string, Record<string, string>> = {};

  let softwareCount = 0;
  let versionCount = 0;
  let cveCount = 0;

  for (const pkg of SOFTWARE) {
    const ownerId = userIdByEmail[pkg.ownerEmail];
    if (!ownerId) throw new Error(`Unknown ownerEmail: ${pkg.ownerEmail}`);

    // ── Create parent Software ──
    const software = await prisma.software.upsert({
      where: { slug: pkg.slug },
      update: { description: pkg.description, repoUrl: pkg.repoUrl ?? null },
      create: {
        ownerId,
        name: pkg.name,
        slug: pkg.slug,
        ecosystem: pkg.ecosystem,
        description: pkg.description,
        repoUrl: pkg.repoUrl ?? null,
      },
    });
    softwareCount++;
    versionIdBySlugVersion[pkg.slug] = {};

    // ── Create child Versions (always linked to this software) ──
    for (const v of pkg.versions) {
      const sv = await prisma.softwareVersion.upsert({
        where: { softwareId_version: { softwareId: software.id, version: v.version } },
        update: { releasedAt: v.releasedAt ? new Date(v.releasedAt) : null, changelog: v.changelog ?? null },
        create: {
          softwareId: software.id,   // ← FK to parent
          version: v.version,
          releasedAt: v.releasedAt ? new Date(v.releasedAt) : null,
          changelog: v.changelog ?? null,
        },
      });
      versionIdBySlugVersion[pkg.slug][v.version] = sv.id;
      versionCount++;

      // ── Create CVE cache entries (children of this version) ──
      if (v.cves.length > 0) {
        // Delete stale cache first so re-running seed stays idempotent
        await prisma.cveCache.deleteMany({ where: { softwareVersionId: sv.id } });
        await prisma.cveCache.createMany({
          data: v.cves.map((c) => ({
            softwareVersionId: sv.id,   // ← FK to parent version
            cveId: c.cveId,
            severity: c.severity,
            cvssScore: c.cvssScore,
            description: c.description,
            publishedAt: new Date(c.publishedAt),
            modifiedAt: new Date(c.publishedAt),
            cachedAt: new Date(),
          })),
        });
        cveCount += v.cves.length;
      }
    }

    console.log(`  📦 ${pkg.slug} (${pkg.versions.length} versions)`);
  }

  console.log(`\n✅ ${softwareCount} packages, ${versionCount} versions, ${cveCount} CVE entries\n`);

  // ─── Step 3: Badges ───────────────────────────────────────────────────────

  let badgeCount = 0;
  for (const b of BADGES) {
    const userId = userIdByEmail[b.userEmail];
    if (!userId) throw new Error(`Unknown badge userEmail: ${b.userEmail}`);

    // Use a stable composite ID for upsert
    const stableId = `seed-badge-${b.userEmail.replace(/@.*/, "")}-${b.badgeType.toLowerCase()}`;

    await prisma.badgeRequest.upsert({
      where: { id: stableId },
      update: { status: b.status, adminNote: b.adminNote ?? null },
      create: {
        id: stableId,
        userId,
        badgeType: b.badgeType,
        status: b.status,
        evidence: b.evidence ?? null,
        adminNote: b.adminNote ?? null,
        requestedAt: new Date(b.requestedAt),
        resolvedAt: b.resolvedAt ? new Date(b.resolvedAt) : null,
      },
    });
    badgeCount++;
  }

  console.log(`✅ ${badgeCount} badges seeded\n`);

  // ─── Step 4: Stacks ───────────────────────────────────────────────────────

  for (const stackDef of STACKS) {
    const userId = userIdByEmail[stackDef.ownerEmail];
    if (!userId) throw new Error(`Unknown stack ownerEmail: ${stackDef.ownerEmail}`);

    const stack = await prisma.stack.upsert({
      where: { id: stackDef.id },
      update: { name: stackDef.name, description: stackDef.description ?? null },
      create: {
        id: stackDef.id,
        userId,
        name: stackDef.name,
        description: stackDef.description ?? null,
      },
    });

    // Delete and recreate nodes+edges for idempotency
    await prisma.stackEdge.deleteMany({ where: { stackId: stack.id } });
    await prisma.stackNode.deleteMany({ where: { stackId: stack.id } });

    // Create nodes
    const createdNodes: { id: string }[] = [];
    for (const nodeDef of stackDef.nodes) {
      let softwareVersionId: string | null = null;

      if (nodeDef.platformRef) {
        const { slug, version } = nodeDef.platformRef;
        softwareVersionId = versionIdBySlugVersion[slug]?.[version] ?? null;
        if (!softwareVersionId) {
          throw new Error(`Stack "${stackDef.name}": unknown platform ref ${slug}@${version}`);
        }
      }

      const node = await prisma.stackNode.create({
        data: {
          stackId: stack.id,
          softwareVersionId,
          freeformName: nodeDef.freeform?.name ?? null,
          freeformVersion: nodeDef.freeform?.version ?? null,
          freeformEcosystem: nodeDef.freeform?.ecosystem ?? null,
          positionX: nodeDef.positionX,
          positionY: nodeDef.positionY,
        },
      });
      createdNodes.push(node);
    }

    // Create edges (reference nodes by index)
    if (stackDef.edges.length > 0) {
      await prisma.stackEdge.createMany({
        data: stackDef.edges.map((e) => ({
          stackId: stack.id,
          sourceId: createdNodes[e.sourceIndex].id,
          targetId: createdNodes[e.targetIndex].id,
        })),
      });
    }

    console.log(`  🗂  ${stackDef.name} (${stackDef.nodes.length} nodes, ${stackDef.edges.length} edges)`);
  }

  console.log(`\n✅ ${STACKS.length} stacks seeded\n`);

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log("🎉 Seed complete!\n");
  console.log("All accounts use password: password123\n");
  console.log("┌────────────────────────────────────────┬──────────┬──────────────────────────────────────┐");
  console.log("│ Email                                  │ Type     │ Notes                                │");
  console.log("├────────────────────────────────────────┼──────────┼──────────────────────────────────────┤");
  const rows = [
    ["admin@chainedin.dev",       "ADMIN",   "Approves badges, full admin panel"],
    ["acme@chainedin.dev",        "COMPANY", "2 packages, CVEs from CRITICAL→clean"],
    ["securecorp@chainedin.dev",  "COMPANY", "1 clean package, ISO27001 approved"],
    ["cloudnative@chainedin.dev", "COMPANY", "2 packages, Go ecosystem, ISO pending"],
    ["dataflow@chainedin.dev",    "COMPANY", "2 packages incl. Log4Shell in Maven"],
    ["rustlabs@chainedin.dev",    "COMPANY", "2 packages, Rust/Cargo, SOC2 rejected"],
    ["openauth@chainedin.dev",    "COMPANY", "2 auth libs, GDPR+SOC2 approved"],
    ["alice@chainedin.dev",       "PERSON",  "Stack: Production API Stack"],
    ["bob@chainedin.dev",         "PERSON",  "NIS2 badge pending"],
    ["carlos@chainedin.dev",      "PERSON",  "Pentest package + Red Team stack"],
    ["diana@chainedin.dev",       "PERSON",  "DevSecOps scanner + CI/CD stack"],
    ["emeka@chainedin.dev",       "PERSON",  "Rust allocator + Secure Runtime stack"],
    ["fatima@chainedin.dev",      "PERSON",  "NIS2 approved, Enterprise stack"],
    ["george@chainedin.dev",      "PERSON",  "Microservices stack"],
    ["hana@chainedin.dev",        "PERSON",  "Frontend Build stack"],
  ];
  for (const [email, type, notes] of rows) {
    console.log(`│ ${email.padEnd(38)} │ ${type.padEnd(8)} │ ${notes.padEnd(36)} │`);
  }
  console.log("└────────────────────────────────────────┴──────────┴──────────────────────────────────────┘");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
