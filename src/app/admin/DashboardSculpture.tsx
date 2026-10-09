"use client";
import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { DashboardSculptureFallback } from "./DashboardSculptureFallback";
const CommandScene = dynamic(() => import("./DashboardCommandScene"), {
  ssr: false,
  loading: () => <DashboardSculptureFallback />,
});
class SceneBoundary extends Component<{children:ReactNode}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <DashboardSculptureFallback /> : this.props.children; }
}
export function DashboardSculpture() {
  return <SceneBoundary><CommandScene /></SceneBoundary>;
}
