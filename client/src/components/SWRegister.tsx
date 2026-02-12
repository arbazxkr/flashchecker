
"use client";

import { useEffect } from "react";

export default function SWRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("SW Registered:", registration.scope);
                })
                .catch((err) => {
                    console.log("SW Register Failed:", err);
                });
        }
    }, []);

    return null;
}
