import { memo, useState, type CSSProperties } from 'react';
import { probe } from '../../shared/probe';

export type Product = { id: string; name: string; price: number; rating: number };
export type SortKey = 'name' | 'price-asc' | 'price-desc' | 'rating';
export type GridHelpers = {
  /** `query` is already lower-cased and trimmed. */
  matches: (product: Product, query: string) => boolean;
  compare: (a: Product, b: Product, key: SortKey) => number;
};

export const defaultHelpers: GridHelpers = {
  matches: (product, query) => product.name.toLowerCase().includes(query),
  compare: (a, b, key) => {
    if (key === 'price-asc') return a.price - b.price;
    if (key === 'price-desc') return b.price - a.price;
    if (key === 'rating') return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  },
};

// ⚠️ Production code with performance and correctness problems. Review it, then fix it.

export function ProductGrid({ products, helpers = defaultHelpers }: { products: Product[]; helpers?: GridHelpers }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [cartCount, setCartCount] = useState(0);
  const [coupon, setCoupon] = useState('');

  const visible = products
    .sort((a, b) => helpers.compare(a, b, sortKey))
    .filter((p) => helpers.matches(p, query.trim().toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input aria-label="Search products" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Sort by" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="name">Name</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Rating</option>
        </select>
        <input aria-label="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
        <CartBadge count={cartCount} />
      </div>
      <ul aria-label="Products" style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {visible.map((p, i) => (
          <ProductCard
            key={i}
            product={p}
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8, margin: 4 }}
            onAdd={(qty) => setCartCount((c) => c + qty)}
          />
        ))}
      </ul>
    </div>
  );
}

function CartBadge({ count }: { count: number }) {
  probe('CartBadge');
  return <output aria-label="Cart">Cart: {count}</output>;
}

const ProductCard = memo(function ProductCard({
  product,
  style,
  onAdd,
}: {
  product: Product;
  style: CSSProperties;
  onAdd: (qty: number) => void;
}) {
  probe('ProductCard');
  const [qty, setQty] = useState(1);
  return (
    <li style={style}>
      <div>{product.name}</div>
      <div>
        ${product.price} · ★{product.rating}
      </div>
      <input
        type="number"
        min={1}
        aria-label={`Quantity for ${product.name}`}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        style={{ width: 56 }}
      />
      <button onClick={() => onAdd(qty)}>Add {product.name} to cart</button>
    </li>
  );
});
