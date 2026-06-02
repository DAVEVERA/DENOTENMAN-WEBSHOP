type ProductGalleryProps = {
  image?: string | null;
  name: string;
};

export function ProductGallery({ image, name }: ProductGalleryProps) {
  if (image) {
    return (
      <div className="product-media-placeholder product-media-placeholder--image">
        <img src={image} alt={name} />
      </div>
    );
  }

  return <div className="product-media-placeholder">Productafbeelding</div>;
}
