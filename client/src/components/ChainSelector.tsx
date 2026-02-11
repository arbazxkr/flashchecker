"use client";

import Image from "next/image";
import type { Chain } from "@/app/page";
import styles from "./ChainSelector.module.css";

const CHAINS: {
    id: Chain;
    name: string;
    tag: string;
    logo: string;
}[] = [
        {
            id: "ETHEREUM",
            name: "Ethereum",
            tag: "ERC-20 · USDT",
            logo: "/chains/ethereum.svg",
        },
        {
            id: "BSC",
            name: "BNB Chain",
            tag: "BEP-20 · USDT",
            logo: "/chains/bnb.svg",
        },
        {
            id: "TRON",
            name: "Tron",
            tag: "TRC-20 · USDT",
            logo: "/chains/tron.svg",
        },
        {
            id: "SOLANA",
            name: "Solana",
            tag: "SPL · USDT",
            logo: "/chains/solana.svg",
        },
    ];

interface ChainSelectorProps {
    onSelect: (chain: Chain) => void;
    loading: boolean;
    loadingChain: Chain | null;
}

export default function ChainSelector({
    onSelect,
    loading,
    loadingChain,
}: ChainSelectorProps) {
    return (
        <section className={styles.card}>
            <div className={styles.header}>
                <span className={styles.step}>Step 1</span>
                <h1 className={styles.title}>Select Network</h1>
            </div>
            <p className={styles.subtitle}>Choose the blockchain to send 1 USDT</p>

            <div className={styles.grid}>
                {CHAINS.map((c, i) => {
                    const isLoading = loading && loadingChain === c.id;
                    return (
                        <button
                            key={c.id}
                            className={styles.chainBtn}
                            onClick={() => onSelect(c.id)}
                            disabled={loading}
                            style={{ animationDelay: `${i * 0.05}s` }}
                        >
                            <div className={styles.icon}>
                                <Image
                                    src={c.logo}
                                    alt={`${c.name} logo`}
                                    width={32}
                                    height={32}
                                    className={styles.logoImg}
                                />
                            </div>
                            <div className={styles.info}>
                                <span className={styles.name}>{c.name}</span>
                                <span className={styles.tag}>{c.tag}</span>
                            </div>
                            <div className={styles.arrow}>
                                {isLoading ? <div className={styles.spinner} /> : "→"}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
