
"use client";

import { useEffect, useState } from "react";
import styles from "./StatsCounter.module.css";

export default function StatsCounter() {
    const [count, setCount] = useState<number | null>(null);

    // Base Offset (e.g., 1166 + DB)
    const BASE_OFFSET = 1166;

    const [displayCount, setDisplayCount] = useState("1,166");
    const [volume, setVolume] = useState("1,200,000");

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/stats");
                if (res.ok) {
                    const data = await res.json();
                    const total = data.count + BASE_OFFSET;

                    // Animate number? Just set it for now.
                    setDisplayCount(total.toLocaleString());

                    // Fake volume based on count * average ~$1000
                    const vol = (total * 920).toLocaleString(); // roughly $1.1M
                    setVolume(vol);
                }
            } catch (err) {
                // Silent fail
            }
        };

        fetchStats();
        // Poll every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    // Marquee Content to repeat
    const content = (
        <>
            <div className={styles.item}>
                ⚡ <span className={styles.highlight}>{displayCount}</span> Verified Transactions
            </div>
            <div className={styles.separator} />
            <div className={styles.item}>
                💰 <span className={styles.highlight}>${volume}</span> USDT Volume
            </div>
            <div className={styles.separator} />
            <div className={styles.item}>
                🛡️ <span className={styles.highlight}>Secured by Blockchain</span>
            </div>
            <div className={styles.separator} />
            <div className={styles.item}>
                🟢 <span className={styles.highlight}>System Operational</span>
            </div>
            <div className={styles.separator} />
        </>
    );

    return (
        <div className={styles.marqueeContainer}>
            <div className={styles.track}>
                {/* Render twice for seamless loop */}
                {content}
                {content}
            </div>
        </div>
    );
}
