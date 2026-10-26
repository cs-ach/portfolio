"use client";

import dynamic from "next/dynamic";
import styles from "./LiveLink.module.css";

/* The figure is interactive and measures itself; keep it out of the first
   paint so nothing above it waits on the bundle. */
const TheLink = dynamic(() => import("./fig01/TheLink"), {
  ssr: false,
  loading: () => <div className={styles.loading} aria-hidden="true" />,
});

export default function LiveLink() {
  return <TheLink />;
}
