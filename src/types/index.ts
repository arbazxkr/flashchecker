import { Chain, SessionStatus } from '@prisma/client';

export interface CreateSessionRequest {
    chain: Chain;
}

export interface CreateSessionResponse {
    sessionId: string;
    depositAddress: string;
    chain: Chain;
    requiredAmount: string;
    expiresAt: string;
}

export interface SessionVerifiedEvent {
    session_id: string;
    status: 'verified';
    tx_hash: string;
}

export interface TransferDetection {
    chain: Chain;
    contractAddress: string;
    from: string;
    to: string;
    amount: bigint;
    txHash: string;
    blockNumber: number;
}

export interface SweepResult {
    sessionId: string;
    chain: Chain;
    fromAddress: string;
    toAddress: string;
    amount: string;
    gasTxHash?: string;
    sweepTxHash: string;
}

export interface WalletKeys {
    address: string;
    privateKey: string;
}
