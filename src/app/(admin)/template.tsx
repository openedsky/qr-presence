/** Remonté à chaque navigation : la nouvelle page apparaît en fondu léger. */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
