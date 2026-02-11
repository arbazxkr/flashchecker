"use client";

import styles from "./ExpiredCard.module.css";

interface ExpiredCardProps {
    onRetry: () => void;
}

export default function ExpiredCard({ onRetry }: ExpiredCardProps) {
    return (
        <section className={styles.card}>
            <div className={styles.container}>
                <div className={styles.icon}>
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle
                            cx="32"
                            cy="32"
                            r="30"
                            stroke="var(--alert)"
                            strokeWidth="3"
                            opacity="0.2"
                        />
                        <path
                            d="M32 18V34"
                            stroke="var(--alert)"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                        <circle cx="32" cy="42" r="2" fill="var(--alert)" />
                    </svg>
                </div>

                <h2 className={styles.title}>Session Expired</h2>
                <p className={styles.subtitle}>The payment window has closed</p>

                <button className={styles.btn} onClick={onRetry}>
                    Try Again
                </button>
            </div>
        </section>
    );
}
