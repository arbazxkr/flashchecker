"use client";

import { useState } from "react";
import Header from "@/components/Header";
import ChainSelector from "@/components/ChainSelector";
import DepositCard from "@/components/DepositCard";
import VerifiedCard from "@/components/VerifiedCard";
import ExpiredCard from "@/components/ExpiredCard";
import Toast from "@/components/Toast";
import styles from "./page.module.css";

export type Chain = "ETHEREUM" | "BSC" | "TRON" | "SOLANA";
export type Step = "select" | "deposit" | "verified" | "expired";

export interface SessionData {
  sessionId: string;
  depositAddress: string;
  chain: Chain;
  requiredAmount: string;
  expiresAt: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>("select");
  const [chain, setChain] = useState<Chain | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  };

  const handleChainSelect = async (selectedChain: Chain) => {
    setChain(selectedChain);
    setLoading(true);

    try {
      const res = await fetch("/api/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: selectedChain }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      const data = await res.json();
      setSession({
        sessionId: data.sessionId,
        depositAddress: data.depositAddress,
        chain: selectedChain,
        requiredAmount: data.requiredAmount,
        expiresAt: data.expiresAt,
      });
      setStep("deposit");
    } catch {
      showToast("Failed to create session. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerified = (hash: string) => {
    setTxHash(hash);
    setStep("verified");
  };

  const handleExpired = () => {
    setStep("expired");
  };

  const handleBack = () => {
    setStep("select");
    setSession(null);
    setChain(null);
  };

  const handleNewSession = () => {
    setStep("select");
    setSession(null);
    setChain(null);
    setTxHash("");
  };

  return (
    <div className={styles.wrapper}>
      <Header connected={connected} />

      <main className={styles.main}>
        {step === "select" && (
          <ChainSelector
            onSelect={handleChainSelect}
            loading={loading}
            loadingChain={chain}
          />
        )}

        {step === "deposit" && session && (
          <DepositCard
            session={session}
            onVerified={handleVerified}
            onExpired={handleExpired}
            onBack={handleBack}
            onConnected={setConnected}
            showToast={showToast}
          />
        )}

        {step === "verified" && (
          <VerifiedCard
            chain={chain!}
            txHash={txHash}
            onNewSession={handleNewSession}
          />
        )}

        {step === "expired" && (
          <ExpiredCard onRetry={handleNewSession} />
        )}
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerText}>
          Secured by blockchain verification
        </span>
        <div className={styles.footerDots}>
          <span className={`${styles.dot} ${styles.dotEth}`} />
          <span className={`${styles.dot} ${styles.dotBsc}`} />
          <span className={`${styles.dot} ${styles.dotTrx}`} />
          <span className={`${styles.dot} ${styles.dotSol}`} />
        </div>
      </footer>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
