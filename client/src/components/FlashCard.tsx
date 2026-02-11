"use client";

import type { Chain } from "@/app/page";
import styles from "./VerifiedCard.module.css"; // Reuse card styles

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

interface FlashCardProps {
    chain: Chain;
    txHash: string;
    onNewSession: () => void;
}

export default function FlashCard({
    chain,
    txHash,
    onNewSession,
}: FlashCardProps) {
    const explorerUrl = `${EXPLORER_URLS[chain]}${txHash}`;
    const shortHash = txHash
        ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}`
        : "—";

    return (
        <section className={styles.card}>
            <div className={styles.container}>
                {/* Animated Warning Icon */}
                <div className={styles.icon}>
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle
                            cx="32"
                            cy="32"
                            r="30"
                            stroke="#ef4444"
                            strokeWidth="3"
                            opacity="0.2"
                        />
                        <circle
                            cx="32"
                            cy="32"
                            r="30"
                            stroke="#ef4444"
                            strokeWidth="3"
                        />
                        <path
                            d="M32 16V36M32 44V44.01"
                            stroke="#ef4444"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={styles.checkPath}
                        />
                    </svg>
                </div>

                <h2 className={styles.title} style={{ color: '#ef4444' }}>FLASH USDT DETECTED</h2>

                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: '8px 0 16px'
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Fake Transaction
                </div>

                <p className={styles.subtitle} style={{ color: '#f87171' }}>
                    This transaction uses a fake token contract.
                    <br />Do not trust this payment.
                </p>

                {/* Details */}
                <div className={styles.details} style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <div className={styles.row}>
                        <span className={styles.label}>Transaction</span>
                        <a
                            className={styles.link}
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#ef4444' }}
                        >
                            {shortHash}
                        </a>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>Network</span>
                        <span className={styles.value}>{CHAIN_NAMES[chain]}</span>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>Status</span>
                        <span className={styles.value} style={{ color: '#ef4444', fontWeight: 'bold' }}>FAKE / FLASH</span>
                    </div>
                </div>

                <button
                    className={styles.btn}
                    onClick={onNewSession}
                    style={{ background: '#ef4444' }}
                >
                    Try Again
                </button>
            </div>
        </section>
    );
}
