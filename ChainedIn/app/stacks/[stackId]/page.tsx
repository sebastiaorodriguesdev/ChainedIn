import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StackCanvas } from "./stack-canvas";

export default async function StackPage({ params }: { params: { stackId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const stack = await prisma.stack.findUnique({
    where: { id: params.stackId },
    include: {
      nodes: {
        include: {
          softwareVersion: {
            include: { software: true, cveCache: true },
          },
        },
      },
      edges: true,
    },
  });

  if (!stack || stack.userId !== session.user.id) notFound();

  return <StackCanvas stack={JSON.parse(JSON.stringify(stack))} />;
}
