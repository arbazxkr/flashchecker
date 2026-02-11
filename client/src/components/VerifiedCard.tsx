"use client";

import type { Chain } from "@/app/page";
import styles from "./VerifiedCard.module.css";

const CHAIN_NAMES: Record<string, string> = {
    ETHEREUM: "Ethereum",
    BSC: "BNB Chain",
    TRON: "Tron",
    SOLANA: "Solana",
};

const EXPLORER_URLS: Record<string, string> = {
    ETHEREUM: "https://etherscan.io/tx/",
    BSC: "https://bscscan.com/tx/",
    TRON: "https://tronscan.org/#/transaction/",
    SOLANA: "https://solscan.io/tx/",
};

interface VerifiedCardProps {
    chain: Chain;
    txHash: string;
    onNewSession: () => void;
}

export default function VerifiedCard({
    chain,
    txHash,
    onNewSession,
}: VerifiedCardProps) {
    const explorerUrl = `${EXPLORER_URLS[chain]}${txHash}`;
    const shortHash = txHash
        ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
        : "—";

    return (
        <section className={styles.card}>
            <div className={styles.container}>
                {/* Animated checkmark */}
                <div className={styles.icon}>
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle
                            cx="32"
                            cy="32"
                            r="30"
                            stroke="var(--success)"
                            strokeWidth="3"
                            opacity="0.2"
                        />
                        <circle
                            cx="32"
                            cy="32"
                            r="30"
                            stroke="var(--success)"
                            strokeWidth="3"
                        />
                        <path
                            d="M20 32L28 40L44 24"
                            stroke="var(--success)"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={styles.checkPath}
                        />
                    </svg>
                </div>

                <h2 className={styles.title}>Payment Verified</h2>
                <p className={styles.subtitle}>
                    Your USDT deposit has been confirmed on-chain
                </p>

                {/* Details */}
                <div className={styles.details}>
                    <div className={styles.row}>
                        <span className={styles.label}>Transaction</span>
                        <a
                            className={styles.link}
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {shortHash}
                        </a>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>Network</span>
                        <span className={styles.value}>{CHAIN_NAMES[chain]}</span>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>Amount</span>
                        <span className={styles.value}>1.00 USDT</span>
                    </div>
                </div>

                <button className={styles.btn} onClick={onNewSession}>
                    New Payment
                </button>
            </div>
        </section>
    );
}
