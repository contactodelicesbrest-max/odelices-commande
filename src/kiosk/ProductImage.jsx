// Photo du produit, ou visuel généré (initiales sur dégradé) si pas de photo.
const HUES = [8, 22, 35, 350, 15, 28];

export function ProductImage({ product, className = "", icon }) {
  if (product.image) return <img className={className} src={product.image} alt="" draggable={false} />;
  const h = HUES[[...product.name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  return (
    <div className={`${className} img-ph`} style={{ "--h": h }}>
      <span>{icon || product.name.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("")}</span>
    </div>
  );
}
