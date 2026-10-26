import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/* Colours are the page ground (--page) and the ink (--ink) from
   globals.css. A manifest cannot read CSS variables, so the values are
   repeated here and have to follow the tokens by hand. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Adwin Chee",
    short_name: "Adwin Chee",
    description:
      "Portfolio of Adwin Chee, a full-stack software engineer in Malaysia.",
    start_url: "/",
    display: "browser",
    background_color: "#F5F5F7",
    theme_color: "#F5F5F7",
    /* The cat from the page (public/oneko, MIT), its idle frame. */
    icons: [
      { src: "/icon.png", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
