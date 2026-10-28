import type { MetadataRoute } from "next";
import { PROJECTS } from "@/lib/content";
import { absolute } from "@/lib/site";

/* Required for `output: "export"`: the file is written once at build
   time rather than served by a route handler. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const built = new Date();
  return [
    { url: absolute("/"), lastModified: built, changeFrequency: "monthly", priority: 1 },
    { url: absolute("/projects/"), lastModified: built, changeFrequency: "monthly", priority: 0.8 },
    { url: absolute("/resume/"), lastModified: built, changeFrequency: "monthly", priority: 0.8 },
    { url: absolute("/lab/"), lastModified: built, changeFrequency: "monthly", priority: 0.5 },
    { url: absolute("/play/"), lastModified: built, changeFrequency: "yearly", priority: 0.2 },
    ...PROJECTS.map((p) => ({
      url: absolute(`/work/${p.slug}/`),
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
