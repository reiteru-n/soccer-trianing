export default function SchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-8 min-h-screen">
      {children}
    </div>
  );
}
