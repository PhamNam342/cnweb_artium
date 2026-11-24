export function Avatar({
  name,
  url,
  size = 36,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials}
    </span>
  );
}
