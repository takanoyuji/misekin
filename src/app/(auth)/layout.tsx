export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">みせ勤</h1>
          <p className="text-sm text-muted-foreground mt-1">勤怠管理システム</p>
        </div>
        {children}
      </div>
    </div>
  );
}
