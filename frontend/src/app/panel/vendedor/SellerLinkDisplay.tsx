"use client";

import { useState } from "react";
import { AdminButton } from "../../../components/admin";
import styles from "../../../components/admin/admin.module.css";
import { buildWhatsAppLink } from "../../../lib/whatsapp";

/** Link personal del vendedor (Tanda B): copiable y listo para compartir por WhatsApp. */
export default function SellerLinkDisplay({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: el link igual queda visible para copiarlo a mano.
    }
  }

  const shareMessage = `¡Hola! Te paso la tienda de HYENA FUEL, suplementos deportivos en Córdoba. Comprando desde este link te atiendo yo: ${link}`;

  return (
    <div className={styles.sellerLinkRow}>
      <span className={styles.sellerLinkValue}>{link}</span>
      <div className={styles.credentialActions}>
        <AdminButton size="sm" variant="secondary" onClick={handleCopy}>
          {copied ? "¡Copiado!" : "Copiar link"}
        </AdminButton>
        <a
          className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSm}`}
          href={buildWhatsAppLink(shareMessage)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Compartir por WhatsApp
        </a>
      </div>
    </div>
  );
}
