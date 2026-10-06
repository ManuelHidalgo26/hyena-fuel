"use client";

import { useState } from "react";
import { AdminButton } from "../../../components/admin";
import styles from "../../../components/admin/admin.module.css";

/** Código del vendedor bien visible, con botón para copiarlo y compartirlo. */
export default function SellerCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: el código igual queda visible para copiarlo a mano.
    }
  }

  return (
    <div className={styles.sellerCodeDisplay}>
      <span className={styles.sellerCodeValue}>{code}</span>
      <AdminButton size="sm" variant="secondary" onClick={handleCopy}>
        {copied ? "¡Copiado!" : "Copiar"}
      </AdminButton>
    </div>
  );
}
