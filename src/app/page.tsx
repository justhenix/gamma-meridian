import * as m from "@/paraglide/messages.js";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {m.greeting()}
        </h1>
        <p className="text-muted-foreground">
          {m.description()}
        </p>
        <div className="pt-4 text-xs text-muted-foreground border-t border-border flex items-center justify-center gap-2">
          <span>{m.english()}: <strong>{m.greeting({}, { locale: "en" })}</strong></span>
          <span>•</span>
          <span>{m.indonesian()}: <strong>{m.greeting({}, { locale: "id" })}</strong></span>
        </div>
      </div>
    </main>
  );
}
