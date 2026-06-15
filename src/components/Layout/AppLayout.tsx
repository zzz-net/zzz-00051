import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { ToastContainer } from "@/components/Toast/ToastContainer";

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="p-8">{children}</div>
      </main>
      <ToastContainer />
    </div>
  );
}
