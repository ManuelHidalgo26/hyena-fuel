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

    <div className={styles.price}>${product.price}</div>

  {/* CONTENEDOR DE CTAs */}
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
