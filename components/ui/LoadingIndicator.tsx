import "./LoadingIndicator.loader.css";

export function LoadingIndicator({ label = "Laden..." }: { label?: string }) {
  return (
    <div className="dn-truckloader" role="status" aria-label={label}>
      <div className="dn-tl-track">
        <div className="dn-tl-floor" />
        <div className="dn-tl-rig">
          <img className="dn-tl-puff dn-tl-puff-base" src="/loader/puff.png" alt="" />
          <img className="dn-tl-puff dn-tl-puff-drift" src="/loader/puff.png" alt="" />
          <div className="dn-tl-bounce">
            <img className="dn-tl-truck" src="/loader/truck.png" alt="" />
            <img className="dn-tl-cargo" src="/loader/cargo.png" alt="" />
            <span className="dn-tl-hub dn-tl-hub-f" />
            <span className="dn-tl-hub dn-tl-hub-r" />
          </div>
        </div>
      </div>
    </div>
  );
}
