type QuantitySelectorProps = {
  defaultValue?: number;
};

export function QuantitySelector({ defaultValue = 1 }: QuantitySelectorProps) {
  return (
    <label className="form-field">
      <span>Aantal</span>
      <input type="number" name="quantity" defaultValue={defaultValue} min={1} />
    </label>
  );
}