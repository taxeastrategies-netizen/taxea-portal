export default function FutureBackdrop() {
  return (
    <div className="taxea-future-atmosphere" aria-hidden="true">
      <div className="taxea-ambient taxea-ambient-crimson" />
      <div className="taxea-ambient taxea-ambient-graphite" />
      <div className="taxea-grid-plane" />
      <div className="taxea-data-orb">
        <span className="taxea-data-orb__core" />
        <span className="taxea-data-orb__ring taxea-data-orb__ring--one" />
        <span className="taxea-data-orb__ring taxea-data-orb__ring--two" />
        <span className="taxea-data-orb__ring taxea-data-orb__ring--three" />
      </div>
    </div>
  );
}
