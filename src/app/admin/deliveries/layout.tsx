import type { ReactNode } from "react";
import "./route-planner-theme.css";

export default function DeliveriesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <div className="route-planner-theme">{children}</div>;
}
