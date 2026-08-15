import type { CollectionConfig } from "payload";

/*
 * Payload's admin login.
 *
 * Named `cms_admins` rather than the default `users` on purpose: better-auth
 * owns the learner accounts in `public.user`, and two tables called some
 * variant of "user" sitting in one database is a trap. These are editors, they
 * live in the `payload` schema, and they are unrelated to learner accounts —
 * learner admin and analytics are authenticated Next routes keyed off
 * `user.role`, not Payload views (#16).
 */
export const CmsAdmins: CollectionConfig = {
  slug: "cms_admins",
  labels: { singular: "CMS admin", plural: "CMS admins" },
  auth: true,
  admin: {
    useAsTitle: "email",
    group: "Settings",
    description: "People who can sign in to this admin. Not learner accounts.",
  },
  fields: [
    {
      name: "name",
      type: "text",
      admin: { description: "Display name shown in the admin UI." },
    },
  ],
};
