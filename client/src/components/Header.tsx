import Image from "next/image";
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
                    <Image
                        src="/titan-symbol-white.png"
                        alt="Titan"
                        width={32}
                        height={32}
                        priority
                    />
                </div>
                <span className={styles.name}>FlashChecker</span>
            </div>

            {/* Status removed as requested */}
        </header>
    );
}
