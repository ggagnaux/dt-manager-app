export function PlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="placeholder-view">
      <div className="placeholder-card">
        <p className="eyebrow">Planned View</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
    </div>
  );
}
