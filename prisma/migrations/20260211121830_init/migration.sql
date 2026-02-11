-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('ETHEREUM', 'BSC', 'TRON', 'SOLANA');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'SWEPT');

-- CreateTable
CREATE TABLE "deposit_sessions" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "deposit_address" TEXT NOT NULL,
    "derivation_index" INTEGER NOT NULL,
    "required_amount" DECIMAL(18,6) NOT NULL DEFAULT 1.0,
    "received_amount" DECIMAL(18,6),
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "tx_hash" TEXT,
    "sweep_tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derivation_counter" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "last_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "derivation_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sweep_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "gas_tx_hash" TEXT,
    "sweep_tx_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sweep_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_sessions_derivation_index_key" ON "deposit_sessions"("derivation_index");

-- CreateIndex
CREATE INDEX "deposit_sessions_status_idx" ON "deposit_sessions"("status");

-- CreateIndex
CREATE INDEX "deposit_sessions_chain_status_idx" ON "deposit_sessions"("chain", "status");

-- CreateIndex
CREATE INDEX "deposit_sessions_deposit_address_idx" ON "deposit_sessions"("deposit_address");

-- CreateIndex
CREATE INDEX "deposit_sessions_expires_at_idx" ON "deposit_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sweep_logs_session_id_idx" ON "sweep_logs"("session_id");

-- CreateIndex
CREATE INDEX "sweep_logs_chain_idx" ON "sweep_logs"("chain");
