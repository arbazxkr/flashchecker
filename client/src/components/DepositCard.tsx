"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState, useCallback } from "react";
import type { SessionData } from "@/app/page";
import styles from "./DepositCard.module.css";


interface DepositCardProps {
    session: SessionData;
    onVerified: (txHash: string) => void;
    onExpired: () => void;
    onFlash: (txHash: string) => void;
    onBack: () => void;
    onConnected: (c: boolean) => void;
    showToast: (msg: string) => void;
}

const CHAIN_NAMES: Record<string, string> = {
    ETHEREUM: "Ethereum",
    BSC: "BNB Chain",
    TRON: "Tron",
    SOLANA: "Solana",
};

export default function DepositCard({
    session,
    onVerified,
    onExpired,
    onFlash,
    onBack,
    onConnected,
    showToast,
}: DepositCardProps) {
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalTime, setTotalTime] = useState(0);
    const [copied, setCopied] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [partialAmount, setPartialAmount] = useState<string | null>(null);

    // ─── Timer Logic ─────────────────────────────────────────
    useEffect(() => {
        const expiresAt = new Date(session.expiresAt).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeLeft(remaining);
        setTotalTime(remaining);

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    onExpired();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [session.expiresAt, onExpired]);

    // ─── WebSocket + Polling ─────────────────────────────────
    const pollSession = useCallback(async () => {
        try {
            const res = await fetch(`/api/session/${session.sessionId}`);
            if (!res.ok) return;
            const json = await res.json();
            const data = json.data || json; // Backend wraps in { success, data }
            if (data.status === "VERIFIED" && data.txHash) {
                onVerified(data.txHash);
            } else if (data.status === "FLASH") {
                onFlash(data.txHash);
            } else if (data.status === "EXPIRED") {
                onExpired();
            } else if (data.receivedAmount) {
                const received = parseFloat(data.receivedAmount);
                const required = parseFloat(session.requiredAmount);
                if (received > 0 && received < required) {
                    setPartialAmount(data.receivedAmount);
                }
            }
        } catch {
            // silent fail
        }
    }, [session.sessionId, onVerified, onExpired, onFlash]);

    useEffect(() => {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const wsProtocol = backendUrl.startsWith("https") ? "wss:" : "ws:";
        const wsHost = backendUrl.replace(/^https?:\/\//, "") || window.location.host;
        const wsUrl = `${wsProtocol}//${wsHost}/ws?session_id=${session.sessionId}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                onConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (
                        data.type === "session_verified" &&
                        data.session_id === session.sessionId
                    ) {
                        onVerified(data.tx_hash);
                    } else if (
                        data.type === "session_updated" &&
                        data.session_id === session.sessionId
                    ) {
                        if (data.status === "FLASH") {
                            onFlash(data.txHash);
                        }
                        if (data.receivedAmount) {
                            const val = parseFloat(data.receivedAmount);
                            if (val > 0 && val < parseFloat(session.requiredAmount)) {
                                setPartialAmount(data.receivedAmount);
                            }
                        }
                    }
                } catch {
                    // ignore
                }
            };

            ws.onclose = () => {
                onConnected(false);
                // Start polling as fallback
                pollRef.current = setInterval(pollSession, 5000);
            };

            ws.onerror = () => {
                onConnected(false);
            };
        } catch {
            // WebSocket not available, use polling
            onConnected(false);
            pollRef.current = setInterval(pollSession, 5000);
        }

        return () => {
            if (wsRef.current) {
                // Remove onclose to prevent triggering fallback polling during cleanup
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [session.sessionId, onVerified, onConnected, pollSession]);

    // ─── QR Code Generation ─────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        drawQR(canvasRef.current, session.depositAddress);
    }, [session.depositAddress]);

    // ─── Copy Address ────────────────────────────────────────
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(session.depositAddress);
            setCopied(true);
            showToast("Address copied");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast("Copy failed");
        }
    };

    // ─── Format Timer ────────────────────────────────────────
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timerStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    const progress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    const isDanger = timeLeft < 60;

    return (
        <section className={styles.card}>
            <div className={styles.header}>
                <button className={styles.back} onClick={onBack} aria-label="Go back">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                            d="M12 4L6 10L12 16"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
                <div>
                    <span className={styles.step}>Step 2</span>
                    <h1 className={styles.title}>Send USDT</h1>
                </div>
            </div>

            <div className={styles.body}>
                {/* Chain badge */}
                <div className={styles.chainBadge}>
                    <span className={styles.chainDot} />
                    <span>{CHAIN_NAMES[session.chain]}</span>
                </div>

                {/* Amount */}
                <div className={styles.amount}>
                    <span className={styles.amountValue}>
                        {session.requiredAmount || "1.00"}
                    </span>
                    <span className={styles.amountCurrency}>USDT</span>
                </div>

                {/* Address box */}
                <div className={styles.addressBox}>
                    <label className={styles.addressLabel}>Deposit Address</label>
                    <div className={styles.addressRow}>
                        <code className={styles.address}>{session.depositAddress}</code>
                        <button className={styles.copyBtn} onClick={handleCopy}>
                            {copied ? (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path
                                        d="M3 7L6 10L11 4"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                                    <rect
                                        x="6"
                                        y="6"
                                        width="10"
                                        height="10"
                                        rx="2"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                    />
                                    <path
                                        d="M12 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2h2"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                    />
                                </svg>
                            )}
                            <span>{copied ? "Copied" : "Copy"}</span>
                        </button>
                    </div>
                </div>

                {/* QR */}
                <div className={styles.qrContainer}>
                    <canvas ref={canvasRef} width={180} height={180} className={styles.qrCanvas} />
                </div>

                {/* Timer */}
                <div className={styles.timer}>
                    <div className={styles.timerBar}>
                        <div
                            className={`${styles.timerFill} ${isDanger ? styles.danger : ""}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className={styles.timerText}>
                        <span>Expires in</span>
                        <span
                            className={`${styles.countdown} ${isDanger ? styles.danger : ""}`}
                        >
                            {timerStr}
                        </span>
                    </div>
                </div>

                {/* Status */}
                {/* Status */}
                <div className={styles.status}>
                    {partialAmount ? (
                        <div style={{ color: '#ef4444', textAlign: 'center', marginBottom: '8px', fontSize: '14px' }}>
                            Received {partialAmount} USDT. <br /> Minimum required: {session.requiredAmount} USDT.
                        </div>
                    ) : (
                        <>
                            <div className={styles.statusSpinner} />
                            <span>Waiting for payment...</span>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

/* ─── QR Code Generator ───────────────────────────────────── */
function drawQR(canvas: HTMLCanvasElement, text: string) {
    QRCode.toCanvas(canvas, text, {
        width: 250,
        margin: 1,
        color: {
            dark: "#000000",
            light: "#ffffff",
        },
    }, (error: Error | null | undefined) => {
        if (error) console.error(error);
    });
}
