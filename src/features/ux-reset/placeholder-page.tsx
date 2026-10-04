"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { uxResetShellHandoffHref } from "@/features/ux-reset";
import {
  LEGACY_ATLAS_PATH,
  RESET_ROUTES,
  type ResetRoute,
  resetRouteById,
} from "@/features/ux-reset/paths";

type ResetPlaceholderPageProps = {
  routeId: ResetRoute["id"];
};

export function ResetPlaceholderPage({ routeId }: ResetPlaceholderPageProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = resetRouteById(routeId);
  const destinationRoutes = RESET_ROUTES.filter(
    (candidate) => candidate.id !== "overview" && !candidate.externalHref
  );
  const siblingRoutes = destinationRoutes.filter(
    (candidate) => candidate.id !== route.id
  );

  const handoffHref = (candidate: ResetRoute) =>
    uxResetShellHandoffHref(candidate.href, pathname, searchParams);

  return (
    <>
      <header className="ux-reset-page-header">
        <p className="eyebrow">UX Reset professional workspace</p>
        <h1>{route.label}</h1>
        <p className="type-body">{route.description}</p>
      </header>
      <div className="ux-reset-page-grid">
        <Card>
          <CardHeader>
            <h2 className="type-card">Placeholder shell route</h2>
            <CardDescription>
              This destination is reserved for a later UX Reset story. Legacy
              Atlas workflows remain available while the professional workspace
              is built out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="type-body">
              Route: <code>{route.href}</code>
            </p>
            <p className="type-body">
              <Link href={LEGACY_ATLAS_PATH}>Open legacy Atlas overview</Link>{" "}
              to use the current production experience.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="type-card">
              {route.id === "overview"
                ? "Workspace destinations"
                : "Other workspace destinations"}
            </h2>
          </CardHeader>
          <CardContent>
            <ul className="ux-reset-destination-list">
              {(route.id === "overview"
                ? destinationRoutes
                : siblingRoutes
              ).map((candidate) => (
                <li key={candidate.id}>
                  <Link href={handoffHref(candidate)}>{candidate.label}</Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
