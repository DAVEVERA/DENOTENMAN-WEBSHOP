type StockStatusProps = {
  status?: string;
};

export function StockStatus({ status = "Op voorraad" }: StockStatusProps) {
  return <span className="badge">{status}</span>;
}