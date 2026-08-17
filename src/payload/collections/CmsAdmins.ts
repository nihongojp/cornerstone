import type { CollectionConfig } from "payload";

import { isAdmin } from "../access/isAdmin";

/*
 * Payload's admin login.
 *
 * Named `cms_admins` rather than the default `users` on purpose: better-auth
 * owns the learner accounts in `public.user`, and two tables called some
 * variant of "user" sitting in one database is a trap. These are editors, they
 * live in the `payload` schema, and they are unrelated to learner accounts —
 * learner-facing surfaces are Next routes behind `requireSession()`, not
 * Payload views (#16). `user.role` exists on learner accounts but currently
 * gates nothing; role-based access is sequenced separately (#56).
 */
export const CmsAdmins: CollectionConfig = {
  slug: "cms_admins",
  labels: { singular: "CMS admin", plural: "CMS admins" },
  auth: true,
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "roles", "updatedAt"],
    group: "Settings",
    description: "People who can sign in to this admin. Not learner accounts.",
  },
  /*
   * Managing accounts is itself an admin power — see `access/isAdmin.ts`. An
   * editor who could update this collection could promote themselves, which
   * would make every other gate decorative.
   *
   * `read` is left open to any signed-in CMS user: seeing who else has an
   * account is how an editor knows who to ask, and it exposes nothing a shared
   * inbox does not. Passwords are never readable through Payload's API.
   */
  access: {
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      admin: { description: "Display name shown in the admin UI." },
    },
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["editor"],
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
      ],
      admin: {
        description:
          "Editors can create, edit and publish all content. Admins can additionally delete " +
          "content and manage these accounts. Everyone who signs in here is at least an editor.",
      },
    },
  ],
};
