"use client";

import { useEffect, useState } from "react";
import styles from "./StatsCounter.module.css";

export default function StatsCounter() {
    const BASE_VERIFIED = 1166;
    const BASE_FLASH = 58;

    const [verifiedCount, setVerifiedCount] = useState("1,166");
    const [flashCount, setFlashCount] = useState("58");

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/stats");
                if (res.ok) {
                    const data = await res.json();

                    const totalVerified = (data.verified || 0) + BASE_VERIFIED;
                    const totalFlash = (data.flash || 0) + BASE_FLASH;

                    setVerifiedCount(totalVerified.toLocaleString());
                    setFlashCount(totalFlash.toLocaleString());
                }
            } catch (err) {
                // Silent fail
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const content = (
        <>
            <div className={styles.item}>
                ⚡ <span className={styles.highlight}>{verifiedCount}</span> Verified Transactions
            </div>
            <div className={styles.separator} />
            <div className={styles.item}>
                ⚠️ <span className={styles.highlight} style={{ color: '#ef4444' }}>{flashCount}</span> Fake Transactions Detected
            </div>
            <div className={styles.separator} />
        </>
    );

    return (
        <div className={styles.marqueeContainer}>
            <div className={styles.track}>
                {content}
                {content}
            </div>
        </div>
    );
}
