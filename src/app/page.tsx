export default function Home() {
  return (
    <main className="bg-page flex min-h-svh flex-col items-center justify-center px-6 py-24">
      <article className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-mono uppercase text-ink-muted">
          [a quiet borough · 2026]
        </p>
        <h1 className="mt-3 font-display text-4xl font-black text-ink leading-none">
          Next on Wembley
        </h1>
        <div aria-hidden className="mx-auto mt-3 h-[2px] w-16 bg-accent-sharp" />
        <p className="mt-8 font-display italic text-lg text-ink-secondary">
          A weekly column of what to watch — for two readers, one couch.
        </p>
        <p className="mt-16 font-mono text-mono text-ink-muted">
          [Foundations · M1 in progress]
        </p>
      </article>
    </main>
  );
}
