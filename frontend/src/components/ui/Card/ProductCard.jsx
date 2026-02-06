<div className={styles.card}>
    <div className={styles.imageWrapper}>
    <Image
        src={product.images[0]}
        alt={product.name}
        width={260}
        height={260}
    />
    </div>

    <h3 className={styles.name}>{product.name}</h3>

    {/* PRECIOS */}
    <div className={styles.prices}>
    {product.transferPrice && (
        <>
        <div className={styles.transferPrice}>
            ${product.transferPrice.toLocaleString("es-AR")}
            <span>Transferencia</span>
        </div>

        <div className={styles.savings}>
            Ahorrás $
            {(product.price - product.transferPrice).toLocaleString("es-AR")}
        </div>
        </>
    )}

    <div className={styles.listPrice}>
        ${product.price.toLocaleString("es-AR")}
        <span>Débito / Crédito</span>
    </div>
    </div>

    {/* CTAs */}
    <div className={styles.cta}>
    <button
        className={styles.addToCart}
        onClick={() => addItem(product)}
    >
        Agregar al carrito
    </button>

    <Link
        href={`/producto/${product.slug}`}
        className={styles.detail}
    >
        Ver detalle
    </Link>
    </div>
</div>

