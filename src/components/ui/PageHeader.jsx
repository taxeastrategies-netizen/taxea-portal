export default function PageHeader({ title, subtitle = '', actions = null, children = null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="min-w-0 break-words [overflow-wrap:anywhere]">
        <h1 className="text-xl lg:text-2xl font-jakarta font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {(actions || children) && (
        <div className="min-w-0 max-w-full flex items-center gap-2 flex-wrap">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}


