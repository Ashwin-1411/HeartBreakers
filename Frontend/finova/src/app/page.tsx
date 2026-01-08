"use client";

import { useEffect } from "react";
import Home from "./home/page";
import DashBoard from "./dashboard/page";

export default function Page() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1));
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, []);

  return (
    <>
      <div
        className="min-h-screen"
        style={{
          boxShadow:
            "0px 4px 6px rgba(28, 25, 23, 0.2), 0px 1px 3px rgba(28, 25, 23, 0.1)",
        }}
      >
        <Home />
      </div>
      <DashBoard />
    </>
  );
}
