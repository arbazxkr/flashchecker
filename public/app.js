/**
 * FlashChecker — Frontend Application
 * Handles session creation, WebSocket connection, countdown timer,
 * QR code generation, and UI state transitions.
 */

(() => {
    'use strict';

    // ─── Configuration ────────────────────────────────────────
    const API_BASE = '/api';
    const WS_PROTOCOL = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_BASE = `${WS_PROTOCOL}//${location.host}/ws`;

    // ─── State ────────────────────────────────────────────────
    let currentSession = null;
    let ws = null;
    let timerInterval = null;
    let currentStep = 'select'; // select | deposit | verified | expired

    // ─── DOM Elements ─────────────────────────────────────────
    const $stepSelect = document.getElementById('stepSelect');
    const $stepDeposit = document.getElementById('stepDeposit');
    const $stepVerified = document.getElementById('stepVerified');
    const $stepExpired = document.getElementById('stepExpired');

    const $chainGrid = document.getElementById('chainGrid');
    const $backBtn = document.getElementById('backBtn');
    const $depositChainName = document.getElementById('depositChainName');
    const $depositAddress = document.getElementById('depositAddress');
    const $copyBtn = document.getElementById('copyBtn');
    const $copyText = document.getElementById('copyText');
    const $timerFill = document.getElementById('timerFill');
    const $timerCountdown = document.getElementById('timerCountdown');
    const $depositStatus = document.getElementById('depositStatus');
    const $qrCanvas = document.getElementById('qrCanvas');

    const $verifiedTxHash = document.getElementById('verifiedTxHash');
    const $verifiedChain = document.getElementById('verifiedChain');
    const $newSessionBtn = document.getElementById('newSessionBtn');
    const $retryBtn = document.getElementById('retryBtn');

    const $statusDot = document.getElementById('statusDot');
    const $statusText = document.getElementById('statusText');

    // ─── Chain Display Names ──────────────────────────────────
    const CHAIN_NAMES = {
        ETHEREUM: 'Ethereum',
        BSC: 'BNB Chain',
        TRON: 'Tron',
        SOLANA: 'Solana',
    };

    const EXPLORER_URLS = {
        ETHEREUM: 'https://etherscan.io/tx/',
        BSC: 'https://bscscan.com/tx/',
        TRON: 'https://tronscan.org/#/transaction/',
        SOLANA: 'https://solscan.io/tx/',
    };

    // ─── Initialize ───────────────────────────────────────────
    function init() {
        // Chain selection buttons
        const chainBtns = $chainGrid.querySelectorAll('.chain-btn');
        chainBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const chain = btn.dataset.chain;
                if (chain) createSession(chain);
            });
        });

        // Back button
        $backBtn.addEventListener('click', goBackToSelect);

        // Copy button
        $copyBtn.addEventListener('click', copyAddress);

        // New session / Retry
        $newSessionBtn.addEventListener('click', goBackToSelect);
        $retryBtn.addEventListener('click', goBackToSelect);

        // Update status indicator
        updateServerStatus();
    }

    // ─── Step Navigation ──────────────────────────────────────
    function showStep(step) {
        currentStep = step;

        [$stepSelect, $stepDeposit, $stepVerified, $stepExpired].forEach((el) => {
            el.classList.add('card--hidden');
            el.classList.remove('card--active');
        });

        const mapping = {
            select: $stepSelect,
            deposit: $stepDeposit,
            verified: $stepVerified,
            expired: $stepExpired,
        };

        const target = mapping[step];
        if (target) {
            target.classList.remove('card--hidden');
            target.classList.add('card--active');
            // Re-trigger animation
            target.style.animation = 'none';
            target.offsetHeight; // Force reflow
            target.style.animation = '';
        }
    }

    function goBackToSelect() {
        cleanup();
        showStep('select');
    }

    // ─── API: Create Session ──────────────────────────────────
    async function createSession(chain) {
        // Disable buttons while creating
        const chainBtns = $chainGrid.querySelectorAll('.chain-btn');
        chainBtns.forEach((btn) => (btn.disabled = true));

        try {
            const response = await fetch(`${API_BASE}/create-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chain }),
            });

            const data = await response.json();

            if (!data.success) {
                showToast(data.error?.message || 'Failed to create session');
                return;
            }

            currentSession = data.data;

            // Update deposit UI
            $depositChainName.textContent = CHAIN_NAMES[chain] || chain;
            $depositAddress.textContent = currentSession.depositAddress;

            // Generate QR code
            generateQR(currentSession.depositAddress);

            // Show deposit step
            showStep('deposit');

            // Start timer
            startTimer(currentSession.expiresAt);

            // Connect WebSocket
            connectWebSocket(currentSession.sessionId);

        } catch (error) {
            showToast('Network error. Please try again.');
            console.error('Create session error:', error);
        } finally {
            chainBtns.forEach((btn) => (btn.disabled = false));
        }
    }

    // ─── WebSocket ────────────────────────────────────────────
    function connectWebSocket(sessionId) {
        if (ws) {
            ws.close();
            ws = null;
        }

        const url = `${WS_BASE}?session_id=${sessionId}`;
        ws = new WebSocket(url);

        ws.onopen = () => {
            $statusDot.classList.add('connected');
            $statusText.textContent = 'Connected';
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                if (msg.type === 'session_verified') {
                    handleVerified(msg);
                }
            } catch (err) {
                console.error('WS message parse error:', err);
            }
        };

        ws.onclose = () => {
            $statusDot.classList.remove('connected');
            $statusText.textContent = 'Disconnected';

            // Reconnect if still on deposit step
            if (currentStep === 'deposit' && currentSession) {
                setTimeout(() => {
                    if (currentStep === 'deposit') {
                        connectWebSocket(sessionId);
                    }
                }, 3000);
            }
        };

        ws.onerror = () => {
            $statusDot.classList.remove('connected');
            $statusText.textContent = 'Error';
        };
    }

    function handleVerified(msg) {
        clearInterval(timerInterval);

        const chain = currentSession?.chain || 'ETHEREUM';
        const explorerUrl = EXPLORER_URLS[chain] + msg.tx_hash;

        $verifiedTxHash.textContent = truncateHash(msg.tx_hash);
        $verifiedTxHash.href = explorerUrl;
        $verifiedChain.textContent = CHAIN_NAMES[chain] || chain;

        showStep('verified');
        showToast('✓ Payment verified!');
    }

    // ─── Timer ────────────────────────────────────────────────
    function startTimer(expiresAt) {
        clearInterval(timerInterval);

        const expiryTime = new Date(expiresAt).getTime();
        const totalDuration = expiryTime - Date.now();

        function tick() {
            const remaining = expiryTime - Date.now();

            if (remaining <= 0) {
                clearInterval(timerInterval);
                handleExpired();
                return;
            }

            const pct = (remaining / totalDuration) * 100;
            $timerFill.style.width = `${pct}%`;

            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
            $timerCountdown.textContent = timeStr;

            // Danger state when < 60s
            if (remaining < 60000) {
                $timerFill.classList.add('danger');
                $timerCountdown.classList.add('danger');
            } else {
                $timerFill.classList.remove('danger');
                $timerCountdown.classList.remove('danger');
            }
        }

        tick();
        timerInterval = setInterval(tick, 1000);
    }

    function handleExpired() {
        showStep('expired');
        cleanup();
    }

    // ─── QR Code Generator ───────────────────────────────────
    // Minimal QR encoder for display purposes
    function generateQR(text) {
        const canvas = $qrCanvas;
        const ctx = canvas.getContext('2d');
        const size = 180;
        canvas.width = size;
        canvas.height = size;

        // Clear
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Use a simple matrix-based QR representation
        // We'll generate a proper QR pattern using the text
        const modules = generateQRMatrix(text);
        const moduleCount = modules.length;
        const cellSize = Math.floor(size / (moduleCount + 8)); // Add quiet zone
        const offset = Math.floor((size - cellSize * moduleCount) / 2);

        ctx.fillStyle = '#000000';

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (modules[row][col]) {
                    // Rounded squares for premium look
                    roundRect(
                        ctx,
                        offset + col * cellSize,
                        offset + row * cellSize,
                        cellSize - 0.5,
                        cellSize - 0.5,
                        cellSize * 0.15
                    );
                }
            }
        }
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();
    }

    /**
     * Simple QR-like matrix generator
     * For production, use a proper QR library. This creates a visually
     * representative pattern from the address hash.
     */
    function generateQRMatrix(text) {
        const size = 29; // QR Version 3
        const matrix = Array.from({ length: size }, () => Array(size).fill(false));

        // Finder patterns (3 corners)
        const finderPositions = [
            [0, 0],
            [0, size - 7],
            [size - 7, 0],
        ];

        finderPositions.forEach(([r, c]) => {
            for (let i = 0; i < 7; i++) {
                for (let j = 0; j < 7; j++) {
                    const isEdge = i === 0 || i === 6 || j === 0 || j === 6;
                    const isCenter = i >= 2 && i <= 4 && j >= 2 && j <= 4;
                    matrix[r + i][c + j] = isEdge || isCenter;
                }
            }
        });

        // Timing patterns
        for (let i = 8; i < size - 8; i++) {
            matrix[6][i] = i % 2 === 0;
            matrix[i][6] = i % 2 === 0;
        }

        // Alignment pattern (center-ish)
        const alignPos = size - 9;
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                const isEdge = i === 0 || i === 4 || j === 0 || j === 4;
                const isCenter = i === 2 && j === 2;
                matrix[alignPos + i][alignPos + j] = isEdge || isCenter;
            }
        }

        // Data modules from text hash
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }

        let seed = Math.abs(hash);
        function prng() {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        }

        // Fill data area
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                // Skip finder, timing, and alignment areas
                const inFinder =
                    (r < 8 && c < 8) ||
                    (r < 8 && c >= size - 8) ||
                    (r >= size - 8 && c < 8);
                const inTiming = r === 6 || c === 6;
                const inAlignment =
                    r >= alignPos && r < alignPos + 5 && c >= alignPos && c < alignPos + 5;

                if (!inFinder && !inTiming && !inAlignment && !matrix[r][c]) {
                    matrix[r][c] = prng() < 0.45;
                }
            }
        }

        return matrix;
    }

    // ─── Copy Address ─────────────────────────────────────────
    async function copyAddress() {
        if (!currentSession) return;

        try {
            await navigator.clipboard.writeText(currentSession.depositAddress);
            $copyText.textContent = 'Copied!';
            showToast('Address copied');

            setTimeout(() => {
                $copyText.textContent = 'Copy';
            }, 2000);
        } catch {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = currentSession.depositAddress;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            $copyText.textContent = 'Copied!';
            showToast('Address copied');
            setTimeout(() => ($copyText.textContent = 'Copy'), 2000);
        }
    }

    // ─── Toast ────────────────────────────────────────────────
    function showToast(message) {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ─── Utilities ────────────────────────────────────────────
    function truncateHash(hash) {
        if (!hash) return '';
        if (hash.length <= 16) return hash;
        return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
    }

    function cleanup() {
        if (ws) {
            ws.close();
            ws = null;
        }
        clearInterval(timerInterval);
        currentSession = null;

        $statusDot.classList.remove('connected');
        $statusText.textContent = 'Idle';
    }

    async function updateServerStatus() {
        try {
            const res = await fetch(`${API_BASE}/health`);
            const data = await res.json();
            if (data.success) {
                $statusDot.classList.add('connected');
                $statusText.textContent = 'Online';
            }
        } catch {
            $statusText.textContent = 'Offline';
        }
    }

    // ─── Polling fallback for verification ────────────────────
    // In case WebSocket disconnects, we also poll the session status
    function startPollingFallback() {
        const pollInterval = setInterval(async () => {
            if (currentStep !== 'deposit' || !currentSession) {
                clearInterval(pollInterval);
                return;
            }

            try {
                const res = await fetch(
                    `${API_BASE}/session/${currentSession.sessionId}`
                );
                const data = await res.json();

                if (data.success && data.data.status === 'VERIFIED') {
                    clearInterval(pollInterval);
                    handleVerified({
                        session_id: currentSession.sessionId,
                        status: 'verified',
                        tx_hash: data.data.txHash,
                    });
                } else if (data.success && data.data.status === 'EXPIRED') {
                    clearInterval(pollInterval);
                    handleExpired();
                }
            } catch {
                // Ignore polling errors
            }
        }, 5000);
    }

    // Start polling as backup when creating session
    const originalCreateSession = createSession;

    // Override to also start polling
    createSession = async function (chain) {
        await originalCreateSession(chain);
        if (currentSession) {
            startPollingFallback();
        }
    };

    // ─── Boot ─────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);
})();
