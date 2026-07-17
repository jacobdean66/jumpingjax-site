import type { ReactNode } from "react";
import "./social-posts-theme.css";

export default function SocialPostsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <div className="social-posts-theme">{children}</div>;
}
