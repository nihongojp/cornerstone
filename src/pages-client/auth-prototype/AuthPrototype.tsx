"use client";

/* PROTOTYPE — throwaway. See #52.
 *
 * Three variants of the sign-in / signup screens, switchable via `?variant=`
 * on the existing /auth route. Nothing here calls better-auth; every submit is
 * a timer. Delete this directory once a variant wins.
 */

import React from "react";
import { useSearchParams } from "next/navigation";
import PrototypeSwitcher from "./PrototypeSwitcher";
import VariantA from "./VariantA";
import VariantB from "./VariantB";
import VariantC from "./VariantC";

const VARIANTS = [
  { key: "A", name: "Identifier first" },
  { key: "B", name: "Two tabs" },
  { key: "C", name: "Flat method list" },
];

export default function AuthPrototype() {
  const params = useSearchParams();
  const variant = (params.get("variant") ?? "A").toUpperCase();

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </>
  );
}
