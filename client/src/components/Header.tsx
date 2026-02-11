"use client";

import styles from "./Header.module.css";

interface HeaderProps {
    connected: boolean;
}

export default function Header({ connected }: HeaderProps) {
    return (
        <header className={styles.header}>
            {/* Brand Left */}
            <div className={styles.brand}>
                <div className={styles.icon}>
                    <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                        <path
                            d="M14 2L26 8V20L14 26L2 20V8L14 2Z"
                            stroke="url(#logo-grad)"
                            strokeWidth="2"
                            fill="none"
                        />
                        <path
                            d="M14 6L22 10V18L14 22L6 18V10L14 6Z"
                            fill="url(#logo-grad)"
                            opacity="0.3"
                        />
                        <path
                            d="M10 14L13 17L19 11"
                            stroke="url(#logo-grad)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <defs>
                            <linearGradient id="logo-grad" x1="2" y1="2" x2="26" y2="26">
                                <stop stopColor="#f2d363" />
                                <stop offset="1" stopColor="#d4a831" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <span className={styles.name}>FlashChecker</span>
            </div>

            {/* Right Status */}
            <div className={styles.status}>
                <div
                    className={`${styles.dot} ${connected ? styles.dotConnected : ""}`}
                />
                <span className={styles.statusText}>
                    {connected ? "System Live" : "Connecting..."}
                </span>
            </div>
        </header>
    );
}
