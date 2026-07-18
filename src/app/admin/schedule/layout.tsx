import type { ReactNode } from "react";

import "./schedule-theme.css";

export default function ScheduleLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <div className="admin-schedule-theme">{children}</div>;
}
