"use client";

import { useEffect, useState } from "react";
import styles from "./StatsCounter.module.css";

export default function StatsCounter() {
    const BASE_TOTAL = 1258;
    const BASE_VERIFIED = 800;
    const BASE_FLASH = 58;

    const [totalCount, setTotalCount] = useState("1,258");
    const [verifiedCount, setVerifiedCount] = useState("800");
    const [flashCount, setFlashCount] = useState("58");

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/stats");
                if (res.ok) {
                    const data = await res.json();

                    const total = (data.total || 0) + BASE_TOTAL;
                    const verified = (data.verified || 0) + BASE_VERIFIED;
                    const flash = (data.flash || 0) + BASE_FLASH;

                    setTotalCount(total.toLocaleString());
                    setVerifiedCount(verified.toLocaleString());
                    setFlashCount(flash.toLocaleString());
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
                💼 <span className={styles.highlight}>{totalCount}</span> Wallets Generated
            </div>
            <div className={styles.separator} />
            <div className={styles.item}>
                ✅ <span className={styles.highlight} style={{ color: '#22c55e' }}>{verifiedCount}</span> Transactions Verified
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
